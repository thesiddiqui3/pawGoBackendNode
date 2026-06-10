import { Injectable } from '@nestjs/common';
import { UserRole, OrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const startOf7DaysAgo = new Date(now);
    startOf7DaysAgo.setDate(now.getDate() - 6);
    startOf7DaysAgo.setHours(0, 0, 0, 0);

    // ─── All counts + revenue in one transaction ──────────────────────────
    const [
      totalCustomers,
      totalClinicOwners,
      totalShopOwners,
      totalAssistants,
      totalDeliveryPartners,
      totalAppointments,
      totalOrders,
      revenueResult,
      recentAppointments,
      recentOrders,
      monthlyRevenueRaw,
      appointmentsTrendRaw,
      ordersTrendRaw,
      topClinicsRaw,
      topShopsRaw,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: UserRole.PET_OWNER, deletedAt: null } }),
      this.prisma.user.count({ where: { role: UserRole.CLINIC_OWNER, deletedAt: null } }),
      this.prisma.user.count({ where: { role: UserRole.SHOP_OWNER, deletedAt: null } }),
      this.prisma.user.count({ where: { role: UserRole.ASSISTANT, deletedAt: null } }),
      this.prisma.user.count({ where: { role: UserRole.DELIVERY_PARTNER, deletedAt: null } }),
      this.prisma.appointment.count({ where: {} }),
      this.prisma.order.count({ where: {} }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { orderStatus: { notIn: [OrderStatus.CANCELLED] } },
      }),
      this.prisma.appointment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, appointmentDate: true, status: true, createdAt: true,
          pet: { select: { name: true, species: true } },
          doctor: { select: { user: { select: { firstName: true, lastName: true } } } },
          clinic: { select: { name: true } },
        },
      }),
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, orderNumber: true, orderStatus: true, totalAmount: true, createdAt: true,
          customer: { select: { firstName: true, lastName: true, email: true } },
          shop: { select: { name: true } },
        },
      }),
      // Monthly revenue — last 6 months via raw groupBy
      this.prisma.order.groupBy({
        by: ['createdAt'],
        _sum: { totalAmount: true },
        where: {
          orderStatus: { notIn: [OrderStatus.CANCELLED] },
          createdAt: { gte: this.startOfMonthsAgo(5) },
        },
        orderBy: { createdAt: 'asc' },
      }),
      // Daily appointments trend — last 7 days
      this.prisma.appointment.findMany({
        where: { createdAt: { gte: startOf7DaysAgo } },
        select: { createdAt: true },
      }),
      // Daily orders trend — last 7 days
      this.prisma.order.findMany({
        where: { createdAt: { gte: startOf7DaysAgo } },
        select: { createdAt: true },
      }),
      // Top clinics by appointments
      this.prisma.appointment.groupBy({
        by: ['clinicId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      // Top shops by order count
      this.prisma.order.groupBy({
        by: ['shopId'],
        _count: { id: true },
        _sum: { totalAmount: true },
        where: { orderStatus: { notIn: [OrderStatus.CANCELLED] } },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    // ─── Post-process monthly revenue ────────────────────────────────────
    const monthlyRevenue = this.buildMonthlyRevenue(
      monthlyRevenueRaw.map((r) => ({ createdAt: r.createdAt, _sum: { totalAmount: (r._sum?.totalAmount ?? null) } })),
    );

    // ─── Post-process daily trends ────────────────────────────────────────
    const appointmentsTrend = this.buildDailyTrend(appointmentsTrendRaw.map((r) => r.createdAt));
    const ordersTrend = this.buildDailyTrend(ordersTrendRaw.map((r) => r.createdAt));

    // ─── Enrich top clinics with names ────────────────────────────────────
    const clinicIds = topClinicsRaw.map((r) => r.clinicId);
    const clinics = await this.prisma.clinic.findMany({
      where: { id: { in: clinicIds } },
      select: { id: true, name: true },
    });
    const clinicMap = Object.fromEntries(clinics.map((c) => [c.id, c.name]));

    const topClinics = topClinicsRaw.map((r) => ({
      clinicId: r.clinicId,
      clinicName: clinicMap[r.clinicId] ?? 'Unknown',
      appointments: (r._count as { id: number }).id,
    }));

    // ─── Enrich top shops with names ──────────────────────────────────────
    const shopIds = topShopsRaw.map((r) => r.shopId);
    const shops = await this.prisma.shop.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, name: true },
    });
    const shopMap = Object.fromEntries(shops.map((s) => [s.id, s.name]));

    const topShops = topShopsRaw.map((r) => ({
      shopId: r.shopId,
      shopName: shopMap[r.shopId] ?? 'Unknown',
      orders: (r._count as { id: number }).id,
      revenue: (r._sum as { totalAmount: number | null }).totalAmount ?? 0,
    }));

    return {
      users: {
        totalCustomers,
        totalClinicOwners,
        totalShopOwners,
        totalAssistants,
        totalDeliveryPartners,
        total: totalCustomers + totalClinicOwners + totalShopOwners + totalAssistants + totalDeliveryPartners,
      },
      totalAppointments,
      totalOrders,
      totalRevenue: revenueResult._sum.totalAmount ?? 0,
      monthlyRevenue,
      appointmentsTrend,
      ordersTrend,
      recentAppointments,
      recentOrders,
      topClinics,
      topShops,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private startOfMonthsAgo(months: number): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private buildMonthlyRevenue(rows: { createdAt: Date; _sum: { totalAmount: number | null } }[]) {
    const map: Record<string, number> = {};
    for (const row of rows) {
      const key = `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] ?? 0) + (row._sum.totalAmount ?? 0);
    }
    // Build last 6 months labels
    const result: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      result.push({ month: label, revenue: map[key] ?? 0 });
    }
    return result;
  }

  private buildDailyTrend(dates: Date[]): { date: string; count: number }[] {
    const map: Record<string, number> = {};
    for (const d of dates) {
      const key = d.toISOString().slice(0, 10);
      map[key] = (map[key] ?? 0) + 1;
    }
    const result: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, count: map[key] ?? 0 });
    }
    return result;
  }
}
