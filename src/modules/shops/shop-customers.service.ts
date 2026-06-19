import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse } from '../../common/utils/pagination.helper';

@Injectable()
export class ShopCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveShopId(ownerId: string): Promise<string> {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId }, select: { id: true } });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop.id;
  }

  async findCustomers(
    ownerId: string,
    query: { page?: number; limit?: number; search?: string },
  ) {
    const shopId = await this.resolveShopId(ownerId);
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.limit ?? 10);
    const skip = (page - 1) * pageSize;

    // Get all unique customers who placed orders at this shop
    const where = {
      shopId,
      customer: query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
              { phone: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : undefined,
    };

    // Get distinct customer IDs with aggregated stats
    const grouped = await this.prisma.order.groupBy({
      by: ['customerId'],
      where,
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const total = grouped.length;
    const pageSlice = grouped.slice(skip, skip + pageSize);

    if (pageSlice.length === 0) {
      return buildPaginatedResponse([], total, page, pageSize);
    }

    const customerIds = pageSlice.map(g => g.customerId);

    // Fetch full customer details
    const [users, deliveredCounts, addresses] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true },
      }),
      this.prisma.order.groupBy({
        by: ['customerId'],
        where: { shopId, customerId: { in: customerIds }, orderStatus: OrderStatus.DELIVERED },
        _count: { id: true },
      }),
      this.prisma.address.findMany({
        where: { userId: { in: customerIds } },
        select: { id: true, userId: true, fullName: true, addressLine1: true, addressLine2: true, city: true, state: true, pincode: true, isDefault: true },
      }),
    ]);

    const deliveredMap = new Map(deliveredCounts.map(d => [d.customerId, d._count.id]));
    const userMap = new Map(users.map(u => [u.id, u]));
    const addressMap = new Map<string, typeof addresses>();
    for (const a of addresses) {
      if (!addressMap.has(a.userId)) addressMap.set(a.userId, []);
      addressMap.get(a.userId)!.push(a);
    }

    const data = pageSlice.map(g => {
      const u = userMap.get(g.customerId);
      const addrs = addressMap.get(g.customerId) ?? [];
      return {
        id: g.customerId,
        firstName: u?.firstName ?? '',
        lastName: u?.lastName ?? '',
        name: u ? `${u.firstName} ${u.lastName}`.trim() : 'Unknown',
        email: u?.email ?? '',
        phone: u?.phone ?? '',
        totalOrders: g._count.id,
        completedOrders: deliveredMap.get(g.customerId) ?? 0,
        totalSpend: Number(g._sum.totalAmount ?? 0),
        registeredAt: u?.createdAt ?? new Date(),
        addresses: addrs.map(a => ({
          id: a.id,
          label: a.isDefault ? 'Default' : 'Delivery',
          line1: a.addressLine1 + (a.addressLine2 ? `, ${a.addressLine2}` : ''),
          city: a.city,
          state: a.state,
          pincode: a.pincode,
        })),
      };
    });

    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async getCustomerById(ownerId: string, customerId: string) {
    const shopId = await this.resolveShopId(ownerId);

    const [user, orderAgg, deliveredAgg, addresses, recentOrders] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: customerId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true },
      }),
      this.prisma.order.aggregate({
        where: { shopId, customerId },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.aggregate({
        where: { shopId, customerId, orderStatus: OrderStatus.DELIVERED },
        _count: { id: true },
      }),
      this.prisma.address.findMany({
        where: { userId: customerId },
        select: { id: true, fullName: true, addressLine1: true, addressLine2: true, city: true, state: true, pincode: true, isDefault: true },
      }),
      this.prisma.order.findMany({
        where: { shopId, customerId },
        orderBy: { placedAt: 'desc' },
        take: 5,
        select: { id: true, orderNumber: true, totalAmount: true, orderStatus: true, placedAt: true },
      }),
    ]);

    if (!user) throw new NotFoundException('Customer not found');

    return {
      id: customerId,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone ?? '',
      totalOrders: orderAgg._count.id,
      completedOrders: deliveredAgg._count.id,
      totalSpend: Number(orderAgg._sum.totalAmount ?? 0),
      registeredAt: user.createdAt,
      addresses: addresses.map(a => ({
        id: a.id,
        label: a.isDefault ? 'Default' : 'Delivery',
        line1: a.addressLine1 + (a.addressLine2 ? `, ${a.addressLine2}` : ''),
        city: a.city,
        state: a.state,
        pincode: a.pincode,
      })),
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: Number(o.totalAmount),
        status: o.orderStatus,
        placedAt: o.placedAt,
      })),
    };
  }
}
