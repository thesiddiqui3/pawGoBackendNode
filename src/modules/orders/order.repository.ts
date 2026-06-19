import { Injectable } from '@nestjs/common';
import { Order, OrderStatus, OrderTimeline, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { OrderQueryDto } from './dto/order-query.dto';

const ORDER_INCLUDE: Prisma.OrderInclude = {
  items: {
    include: { product: { select: { id: true, name: true, imageUrl: true, slug: true } } },
  },
  address: true,
  shop: { select: { id: true, name: true, slug: true, phone: true } },
  customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  timeline: { orderBy: { createdAt: 'asc' } },
  deliveryAssignment: {
    include: { deliveryPartner: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } } },
  },
};

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.prisma.$queryRaw<[{ seq: bigint }]>`
      INSERT INTO order_counters (year, seq) VALUES (${year}, 1)
      ON CONFLICT (year) DO UPDATE SET seq = order_counters.seq + 1
      RETURNING seq
    `;
    const seq = Number(result[0].seq);
    return `PGO-${year}-${String(seq).padStart(6, '0')}`;
  }

  async create(data: Prisma.OrderCreateInput): Promise<Order> {
    return this.prisma.order.create({ data, include: ORDER_INCLUDE });
  }

  async findById(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  }

  async findMany(
    where: Prisma.OrderWhereInput,
    query: OrderQueryDto,
  ): Promise<PaginatedResponseDto<object>> {
    const { skip, take, page, pageSize } = getPaginationMeta(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { placedAt: 'desc' },
        include: ORDER_INCLUDE,
      }),
      this.prisma.order.count({ where }),
    ]);
    return buildPaginatedResponse(items as object[], total, page, pageSize);
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    extra?: Partial<{
      deliveredAt: Date;
      cancelledAt: Date;
      cancellationReason: string;
      cancelledBy: string;
      updatedBy: string;
    }>,
  ): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data: { orderStatus: status, ...extra },
      include: ORDER_INCLUDE,
    });
  }

  async addTimeline(
    orderId: string,
    status: OrderStatus,
    createdBy: string,
    remarks?: string,
  ): Promise<OrderTimeline> {
    return this.prisma.orderTimeline.create({
      data: { orderId, status, createdBy, remarks },
    });
  }

  async getTimeline(orderId: string): Promise<OrderTimeline[]> {
    return this.prisma.orderTimeline.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addNote(id: string, notes: string): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data: { notes },
      include: ORDER_INCLUDE,
    });
  }

  async assignPartner(orderId: string, deliveryPartnerId: string, assignedBy: string): Promise<Order> {
    await this.prisma.deliveryAssignment.upsert({
      where: { orderId },
      create: { orderId, deliveryPartnerId, assignedBy },
      update: { deliveryPartnerId, assignedBy },
    });
    return this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE }) as Promise<Order>;
  }

  async getStats(where: Prisma.OrderWhereInput): Promise<object> {
    const [total, pending, confirmed, packed, delivered, cancelled, revenue] =
      await this.prisma.$transaction([
        this.prisma.order.count({ where }),
        this.prisma.order.count({ where: { ...where, orderStatus: OrderStatus.PENDING } }),
        this.prisma.order.count({ where: { ...where, orderStatus: OrderStatus.CONFIRMED } }),
        this.prisma.order.count({ where: { ...where, orderStatus: OrderStatus.PACKED } }),
        this.prisma.order.count({ where: { ...where, orderStatus: OrderStatus.DELIVERED } }),
        this.prisma.order.count({ where: { ...where, orderStatus: OrderStatus.CANCELLED } }),
        this.prisma.order.aggregate({
          where: { ...where, orderStatus: OrderStatus.DELIVERED },
          _sum: { totalAmount: true },
        }),
      ]);

    return {
      totalOrders: total,
      pendingOrders: pending,
      confirmedOrders: confirmed,
      packedOrders: packed,
      deliveredOrders: delivered,
      cancelledOrders: cancelled,
      revenue: revenue._sum.totalAmount ?? 0,
    };
  }
}
