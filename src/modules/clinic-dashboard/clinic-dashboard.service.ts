import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';

@Injectable()
export class ClinicDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveClinic(userId: string, role: string, clinicId?: string) {
    if (role === UserRole.SUPER_ADMIN && clinicId) {
      const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
      if (!clinic) throw new NotFoundException('Clinic not found');
      return clinic;
    }
    const clinic = await this.prisma.clinic.findFirst({
      where: { createdBy: userId, deletedAt: null },
    });
    if (!clinic) throw new NotFoundException('You do not have a registered clinic');
    return clinic;
  }

  // ─── Overview ─────────────────────────────────────────────────────────────

  async getOverview(userId: string, role: string, clinicId?: string) {
    const clinic = await this.resolveClinic(userId, role, clinicId);
    const cid = clinic.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      activeDoctors,
      activeAssistants,
      todayAppointments,
      pendingAppointments,
      completedTotal,
      cancelledTotal,
      allTotal,
      avgRating,
      monthlyApptRevenue,
      monthlyServiceRevenue,
    ] = await this.prisma.$transaction([
      this.prisma.doctor.count({ where: { clinicId: cid, isActive: true } }),
      this.prisma.clinicStaff.count({ where: { clinicId: cid, isActive: true, user: { role: UserRole.ASSISTANT } } }),
      this.prisma.appointment.count({ where: { clinicId: cid, appointmentDate: { gte: today, lte: todayEnd } } }),
      this.prisma.appointment.count({ where: { clinicId: cid, status: 'PENDING' } }),
      this.prisma.appointment.count({ where: { clinicId: cid, status: 'COMPLETED' } }),
      this.prisma.appointment.count({ where: { clinicId: cid, status: 'CANCELLED' } }),
      this.prisma.appointment.count({ where: { clinicId: cid } }),
      this.prisma.review.aggregate({ where: { clinicId: cid }, _avg: { rating: true } }),
      this.prisma.appointment.findMany({
        where: { clinicId: cid, status: 'COMPLETED', createdAt: { gte: monthStart } },
        include: { doctor: { select: { consultationFee: true } } },
      }),
      this.prisma.serviceBooking.aggregate({
        where: { service: { clinicId: cid }, status: 'COMPLETED', completedAt: { gte: monthStart } },
        _sum: { totalPrice: true },
      }),
    ]);

    const monthlyRevenue =
      monthlyApptRevenue.reduce((s, a) => s + (a.doctor.consultationFee ?? 0), 0) +
      (monthlyServiceRevenue._sum.totalPrice ?? 0);

    const completionRate = allTotal > 0 ? Math.round((completedTotal / allTotal) * 100) : 0;

    return {
      todayAppointments,
      pendingRequests: pendingAppointments,
      activeDoctors,
      activeAssistants,
      monthlyRevenue,
      averageRating: avgRating._avg.rating ?? 0,
      completionRate,
      totalCompleted: completedTotal,
      totalCancelled: cancelledTotal,
      totalAppointments: allTotal,
    };
  }

  // ─── Revenue ──────────────────────────────────────────────────────────────

  async getRevenue(userId: string, role: string, period: 'today' | 'week' | 'month' | 'year' = 'month', clinicId?: string) {
    const clinic = await this.resolveClinic(userId, role, clinicId);
    const cid = clinic.id;

    const now = new Date();
    let from: Date;
    if (period === 'today') {
      from = new Date(now); from.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      from = new Date(now); from.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = new Date(now.getFullYear(), 0, 1);
    }

    const [completedAppointments, completedBookings] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where: { clinicId: cid, status: 'COMPLETED', createdAt: { gte: from } },
        include: { doctor: { select: { consultationFee: true } } },
      }),
      this.prisma.serviceBooking.findMany({
        where: { service: { clinicId: cid }, status: 'COMPLETED', completedAt: { gte: from } },
        select: { totalPrice: true },
      }),
    ]);

    const appointmentRevenue = completedAppointments.reduce((s, a) => s + (a.doctor.consultationFee ?? 0), 0);
    const serviceRevenue = completedBookings.reduce((s, b) => s + b.totalPrice, 0);

    // Build 12-month trend
    const trend: { month: string; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trend.push({
        month: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        revenue: 0,
      });
    }
    for (const a of completedAppointments) {
      const key = new Date(a.createdAt).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      const entry = trend.find(t => t.month === key);
      if (entry) entry.revenue += a.doctor.consultationFee ?? 0;
    }

    return {
      period,
      from,
      to: now,
      appointmentRevenue,
      serviceRevenue,
      totalRevenue: appointmentRevenue + serviceRevenue,
      completedAppointments: completedAppointments.length,
      completedServiceBookings: completedBookings.length,
      trend,
    };
  }

  // ─── Top Doctors ──────────────────────────────────────────────────────────

  async getTopDoctors(userId: string, role: string, clinicId?: string) {
    const clinic = await this.resolveClinic(userId, role, clinicId);
    const cid = clinic.id;

    const doctors = await this.prisma.doctor.findMany({
      where: { clinicId: cid, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: { appointments: { _count: 'desc' } },
      take: 10,
    });

    return doctors.map((d) => ({
      id: d.id,
      name: `${d.user.firstName} ${d.user.lastName}`,
      avatar: d.user.avatarUrl,
      rating: d.rating,
      appointments: d._count.appointments,
      specializations: d.specializations,
      consultationFee: d.consultationFee,
    }));
  }

  // ─── Top Services ─────────────────────────────────────────────────────────

  async getTopServices(userId: string, role: string, clinicId?: string) {
    const clinic = await this.resolveClinic(userId, role, clinicId);
    const cid = clinic.id;

    const services = await this.prisma.petService.findMany({
      where: { clinicId: cid, isActive: true, deletedAt: null },
      include: { _count: { select: { bookings: true } } },
      orderBy: { bookings: { _count: 'desc' } },
      take: 10,
    });

    return services.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      price: s.price,
      count: s._count.bookings,
    }));
  }

  // ─── Appointment Stats ────────────────────────────────────────────────────

  async getAppointmentStats(userId: string, role: string, clinicId?: string) {
    const clinic = await this.resolveClinic(userId, role, clinicId);
    const cid = clinic.id;

    const statusGroups = await this.prisma.appointment.groupBy({
      by: ['status'],
      where: { clinicId: cid },
      _count: { status: true },
    });

    const byStatus = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count.status]),
    );

    // Last 30 days daily breakdown
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recent = await this.prisma.appointment.findMany({
      where: { clinicId: cid, appointmentDate: { gte: thirtyDaysAgo } },
      select: { appointmentDate: true, status: true },
      orderBy: { appointmentDate: 'asc' },
    });

    const dailyMap: Record<string, number> = {};
    for (const appt of recent) {
      const key = appt.appointmentDate.toISOString().split('T')[0];
      dailyMap[key] = (dailyMap[key] ?? 0) + 1;
    }

    const trend = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    return {
      byStatus,
      pending: byStatus['PENDING'] ?? 0,
      trend,
      last7Days: trend.slice(-7),
    };
  }

  // ─── Recent appointments for this clinic ─────────────────────────────────

  async getRecentAppointments(userId: string, role: string, clinicId?: string) {
    const clinic = await this.resolveClinic(userId, role, clinicId);
    const cid = clinic.id;

    return this.prisma.appointment.findMany({
      where: { clinicId: cid },
      include: {
        owner: { select: { firstName: true, lastName: true, phone: true } },
        pet:   { select: { name: true, species: true } },
        doctor: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  // ─── Upcoming appointments for this clinic ────────────────────────────────

  async getUpcomingAppointments(userId: string, role: string, clinicId?: string) {
    const clinic = await this.resolveClinic(userId, role, clinicId);
    const cid = clinic.id;

    const now = new Date();
    return this.prisma.appointment.findMany({
      where: {
        clinicId: cid,
        appointmentDate: { gte: now },
        status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] },
      },
      include: {
        owner: { select: { firstName: true, lastName: true } },
        pet:   { select: { name: true, species: true } },
        doctor: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { appointmentDate: 'asc' },
      take: 8,
    });
  }
}
