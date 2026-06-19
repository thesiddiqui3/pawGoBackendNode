import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';

interface UserQuery {
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
  search?: string;
}

interface RevenueQuery {
  from?: string;
  to?: string;
  groupBy?: 'day' | 'month';
}

interface BroadcastDto {
  title: string;
  message: string;
  type?: string;
  roles?: string[];
}

@Injectable()
export class AdminUserService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Users ────────────────────────────────────────────────────────────────

  async listUsers(query: UserQuery) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);

    const where: any = {
      deletedAt: null,
      ...(query.role && { role: query.role }),
      ...(query.status && { status: query.status }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, firstName: true, lastName: true,
          email: true, phone: true, role: true, status: true,
          isEmailVerified: true, mustChangePassword: true,
          lastLoginAt: true, createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, role: true, status: true,
        isEmailVerified: true, mustChangePassword: true,
        avatarUrl: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { status: status as any },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true },
    });
  }

  async bulkSetUserStatus(ids: string[], status: 'ACTIVE' | 'SUSPENDED') {
    await this.prisma.user.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { status: status as any },
    });
    return { updated: ids.length, status };
  }

  async updateUser(id: string, data: { firstName?: string; lastName?: string; phone?: string; email?: string }) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true },
    });
  }

  async resetUserPassword(id: string): Promise<{ temporaryPassword: string }> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    let temporaryPassword = 'A1@';
    for (let i = 0; i < 7; i++) temporaryPassword += chars[Math.floor(Math.random() * chars.length)];
    temporaryPassword = temporaryPassword.split('').sort(() => Math.random() - 0.5).join('');

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    return { temporaryPassword };
  }

  // ─── Doctors ──────────────────────────────────────────────────────────────

  async listDoctors(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);

    const where: any = {
      ...(query.search && {
        user: {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      }),
      ...(query.status && { user: { status: query.status } }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.doctor.findMany({
        skip, take,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
          clinic: { select: { id: true, name: true, city: true } },
        },
      }),
      this.prisma.doctor.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  // ─── Delivery Partners ────────────────────────────────────────────────────

  async listDeliveryPartners(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);

    const where: any = {
      ...(query.search && {
        user: {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      }),
      ...(query.status && { user: { status: query.status } }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.deliveryPartner.findMany({
        skip, take,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
        },
      }),
      this.prisma.deliveryPartner.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  // ─── Pets ─────────────────────────────────────────────────────────────────

  async listPets(query: { page?: number; limit?: number; search?: string; ownerId?: string }) {
    const { skip, take, page, pageSize } = getPaginationMeta(query);

    const where: any = {
      deletedAt: null,
      ...(query.ownerId && { ownerId: query.ownerId }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { species: { contains: query.search, mode: 'insensitive' } },
          { breed: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.pet.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.pet.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, pageSize);
  }

  // ─── Revenue Reports ──────────────────────────────────────────────────────

  async getRevenueReport(query: RevenueQuery) {
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const dateWhere = { createdAt: { gte: from, lte: to }, orderStatus: { notIn: [OrderStatus.CANCELLED] } };

    const [totalRevenue, orderCount, revenueByShop, dailyRevenue] = await this.prisma.$transaction([
      // Total revenue in range
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: dateWhere,
      }),
      // Order count in range
      this.prisma.order.count({ where: dateWhere }),
      // Revenue by shop (top 10)
      this.prisma.order.groupBy({
        by: ['shopId'],
        _sum: { totalAmount: true },
        _count: { id: true },
        where: dateWhere,
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
      // Daily revenue breakdown
      this.prisma.order.findMany({
        where: dateWhere,
        select: { totalAmount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Group daily revenue by date string
    const dailyMap: Record<string, number> = {};
    for (const o of dailyRevenue) {
      const key = o.createdAt.toISOString().split('T')[0];
      dailyMap[key] = (dailyMap[key] ?? 0) + o.totalAmount;
    }

    // Fetch shop names for top shops
    const shopIds = revenueByShop.map(r => r.shopId);
    const shops = await this.prisma.shop.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, name: true, city: true },
    });
    const shopMap = Object.fromEntries(shops.map(s => [s.id, s]));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalRevenue: totalRevenue._sum.totalAmount ?? 0,
        orderCount,
      },
      topShops: revenueByShop.map(r => ({
        shop: shopMap[r.shopId] ?? { id: r.shopId },
        revenue: r._sum?.totalAmount ?? 0,
        orders: (r._count as any).id,
      })),
      daily: Object.entries(dailyMap).map(([date, revenue]) => ({ date, revenue })),
    };
  }

  // ─── CSV Export ───────────────────────────────────────────────────────────

  async getRevenueCsv(query: RevenueQuery): Promise<string> {
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to }, orderStatus: { notIn: [OrderStatus.CANCELLED] } },
      select: {
        id: true, orderNumber: true, totalAmount: true,
        orderStatus: true, createdAt: true,
        shop: { select: { name: true, city: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows = [
      ['Order Number', 'Shop', 'City', 'Amount', 'Status', 'Date'].join(','),
      ...orders.map(o =>
        [o.orderNumber, o.shop.name, o.shop.city, o.totalAmount, o.orderStatus, o.createdAt.toISOString()].join(',')
      ),
    ];

    return rows.join('\n');
  }

  // ─── Broadcast Notification ───────────────────────────────────────────────

  async broadcastNotification(dto: BroadcastDto) {
    const where: any = { deletedAt: null, status: { notIn: ['SUSPENDED'] } };
    if (dto.roles?.length) where.role = { in: dto.roles };

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    if (!users.length) return { sent: 0 };

    await this.prisma.notification.createMany({
      data: users.map(u => ({
        userId: u.id,
        title: dto.title,
        message: dto.message,
        type: (dto.type ?? 'SYSTEM_ANNOUNCEMENT') as any,
      })),
      skipDuplicates: false,
    });

    return { sent: users.length };
  }

  async getPet(id: string) {
    return this.prisma.pet.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });
  }

  async revenueByClinic(query: RevenueQuery) {
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const rows = await this.prisma.appointment.groupBy({
      by: ['clinicId'],
      _count: { id: true },
      where: {
        createdAt: { gte: from, lte: to },
        status: { notIn: ['CANCELLED'] as any },
      },
      orderBy: { _count: { id: 'desc' } },
    });

    const clinicIds = rows.map((r) => r.clinicId);
    const clinics = await this.prisma.clinic.findMany({
      where: { id: { in: clinicIds } },
      select: { id: true, name: true, city: true },
    });
    const clinicMap = Object.fromEntries(clinics.map((c) => [c.id, c]));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      data: rows.map((r) => ({
        clinic: clinicMap[r.clinicId] ?? { id: r.clinicId },
        appointments: (r._count as any).id,
      })),
    };
  }

  async revenueByShop(query: RevenueQuery) {
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();

    const rows = await this.prisma.order.groupBy({
      by: ['shopId'],
      _sum: { totalAmount: true },
      _count: { id: true },
      where: {
        createdAt: { gte: from, lte: to },
        orderStatus: { notIn: ['CANCELLED'] as any },
      },
      orderBy: { _sum: { totalAmount: 'desc' } },
    });

    const shopIds = rows.map((r) => r.shopId);
    const shops = await this.prisma.shop.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, name: true, city: true },
    });
    const shopMap = Object.fromEntries(shops.map((s) => [s.id, s]));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      data: rows.map((r) => ({
        shop: shopMap[r.shopId] ?? { id: r.shopId },
        revenue: r._sum?.totalAmount ?? 0,
        orders: (r._count as any).id,
      })),
    };
  }
}
