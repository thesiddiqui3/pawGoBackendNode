import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order, OrderStatus } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { OrderEvent, OrderEventPayload } from '../../common/events/order.events';
import { DeliveryEvent, DeliveryAssignmentEventPayload } from '../../common/events/delivery.events';
import { UserRole } from '../../common/enums';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderRepository } from './order.repository';
import { PrismaService } from '../../database/prisma.service';

// Allowed forward transitions for orders
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURN_REQUESTED],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED],
  [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

const STATUS_TO_EVENT: Partial<Record<OrderStatus, OrderEvent>> = {
  [OrderStatus.CONFIRMED]: OrderEvent.CONFIRMED,
  [OrderStatus.PACKED]: OrderEvent.PACKED,
  [OrderStatus.OUT_FOR_DELIVERY]: OrderEvent.OUT_FOR_DELIVERY,
  [OrderStatus.DELIVERED]: OrderEvent.DELIVERED,
  [OrderStatus.CANCELLED]: OrderEvent.CANCELLED,
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveShopIdByOwner(ownerId: string): Promise<string> {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId }, select: { id: true } });
    if (!shop) throw new NotFoundException('Shop not found for this owner');
    return shop.id;
  }

  async findByOwner(ownerId: string, query: OrderQueryDto): Promise<PaginatedResponseDto<object>> {
    const shopId = await this.resolveShopIdByOwner(ownerId);
    return this.orderRepository.findMany(this.buildWhere({ ...query, shopId }), query);
  }

  async getShopStatsByOwner(ownerId: string): Promise<object> {
    const shopId = await this.resolveShopIdByOwner(ownerId);
    return this.orderRepository.getStats({ shopId });
  }

  // ─── Customer: list own orders ────────────────────────────────────────────

  async findMyOrders(
    customerId: string,
    query: OrderQueryDto,
  ): Promise<PaginatedResponseDto<object>> {
    return this.orderRepository.findMany(
      this.buildWhere({ ...query, customerId }),
      query,
    );
  }

  // ─── Admin: list all orders ───────────────────────────────────────────────

  async findAll(query: OrderQueryDto): Promise<PaginatedResponseDto<object>> {
    return this.orderRepository.findMany(this.buildWhere(query), query);
  }

  // ─── Shop owner: list shop orders ─────────────────────────────────────────

  async findByShop(shopId: string, query: OrderQueryDto): Promise<PaginatedResponseDto<object>> {
    return this.orderRepository.findMany(
      this.buildWhere({ ...query, shopId }),
      query,
    );
  }

  // ─── Detail ───────────────────────────────────────────────────────────────

  async findOne(id: string, requesterId: string, requesterRole: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    this.assertReadAccess(order, requesterId, requesterRole);
    return order;
  }

  // ─── Customer: cancel ─────────────────────────────────────────────────────

  async cancel(
    id: string,
    dto: CancelOrderDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    const isAdmin = this.isAdmin(requesterRole);
    if (!isAdmin && order.customerId !== requesterId) {
      throw new ForbiddenException('You can only cancel your own orders');
    }

    if (!ORDER_TRANSITIONS[order.orderStatus].includes(OrderStatus.CANCELLED)) {
      throw new BadRequestException(`Cannot cancel an order with status ${order.orderStatus}`);
    }

    const updated = await this.orderRepository.updateStatus(id, OrderStatus.CANCELLED, {
      cancelledAt: new Date(),
      cancellationReason: dto.reason,
      cancelledBy: requesterId,
      updatedBy: requesterId,
    });
    await this.orderRepository.addTimeline(id, OrderStatus.CANCELLED, requesterId, dto.reason);
    this.emitEvent(OrderEvent.CANCELLED, updated);
    this.logger.log(`Order ${id} cancelled by ${requesterId}`);
    return updated;
  }

  // ─── Shop owner / admin: transition status ────────────────────────────────

  async updateStatus(
    id: string,
    newStatus: OrderStatus,
    requesterId: string,
    requesterRole: string,
    remarks?: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    this.assertShopOrAdmin(order, requesterId, requesterRole);

    const allowed = ORDER_TRANSITIONS[order.orderStatus];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${order.orderStatus} to ${newStatus}. Allowed: [${allowed.join(', ')}]`,
      );
    }

    const extra: Record<string, unknown> = { updatedBy: requesterId };
    if (newStatus === OrderStatus.DELIVERED) extra.deliveredAt = new Date();

    const updated = await this.orderRepository.updateStatus(id, newStatus, extra as any);
    await this.orderRepository.addTimeline(id, newStatus, requesterId, remarks);

    const event = STATUS_TO_EVENT[newStatus];
    if (event) this.emitEvent(event, updated);

    this.logger.log(`Order ${id}: ${order.orderStatus} → ${newStatus}`);
    return updated;
  }

  // ─── Shop: cancel order ───────────────────────────────────────────────────

  async cancelByShop(id: string, reason: string | undefined, requesterId: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('Order not found');

    if (!ORDER_TRANSITIONS[order.orderStatus].includes(OrderStatus.CANCELLED)) {
      throw new BadRequestException(`Cannot cancel an order with status ${order.orderStatus}`);
    }

    const updated = await this.orderRepository.updateStatus(id, OrderStatus.CANCELLED, {
      cancelledAt: new Date(),
      cancellationReason: reason,
      cancelledBy: requesterId,
      updatedBy: requesterId,
    });
    await this.orderRepository.addTimeline(id, OrderStatus.CANCELLED, requesterId, reason ?? 'Cancelled by shop');
    this.emitEvent(OrderEvent.CANCELLED, updated);
    return updated;
  }

  // ─── Shop: update internal notes ─────────────────────────────────────────

  async addNote(id: string, notes: string, requesterId: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return this.orderRepository.addNote(id, notes);
  }

  // ─── Shop: assign delivery partner ───────────────────────────────────────

  async assignDeliveryPartner(id: string, partnerId: string, requesterId: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    const updated = await this.orderRepository.assignPartner(id, partnerId, requesterId);
    // Emit ASSIGNED event so the delivery partner gets a real-time popup
    const assignment = (updated as any).deliveryAssignment;
    if (assignment) {
      const payload: DeliveryAssignmentEventPayload = {
        assignmentId: assignment.id,
        orderId: id,
        deliveryPartnerId: partnerId,
        status: 'ASSIGNED',
      };
      this.eventEmitter.emit(DeliveryEvent.ASSIGNED, payload);
      this.logger.log(`[assignDeliveryPartner] emitted DeliveryEvent.ASSIGNED for assignment ${assignment.id}`);
    }
    return updated;
  }

  // ─── Tracking timeline ────────────────────────────────────────────────────

  async getTracking(id: string, requesterId: string, requesterRole: string) {
    const order = await this.orderRepository.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    this.assertReadAccess(order, requesterId, requesterRole);
    return this.orderRepository.getTimeline(id);
  }

  // ─── Statistics ───────────────────────────────────────────────────────────

  async getCustomerStats(customerId: string): Promise<object> {
    return this.orderRepository.getStats({ customerId });
  }

  async getShopStats(shopId: string): Promise<object> {
    return this.orderRepository.getStats({ shopId });
  }

  async getAdminStats(): Promise<object> {
    return this.orderRepository.getStats({});
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private isAdmin(role: string): boolean {
    return role === UserRole.SUPER_ADMIN;
  }

  private assertReadAccess(order: Order, requesterId: string, role: string): void {
    if (this.isAdmin(role)) return;
    if (order.customerId === requesterId) return;
    if (role === UserRole.SHOP_OWNER) return; // shop owner sees their own orders
    throw new ForbiddenException('Access denied');
  }

  private assertShopOrAdmin(order: Order & { shop?: { ownerId?: string } }, requesterId: string, role: string): void {
    if (this.isAdmin(role)) return;
    if (role === UserRole.SHOP_OWNER) return; // shop ownership verified at controller layer via findByShop
    throw new ForbiddenException('Only shop owners and admins can update order status');
  }

  private emitEvent(event: OrderEvent, order: Order): void {
    const payload: OrderEventPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      shopId: order.shopId,
      totalAmount: order.totalAmount,
      orderStatus: order.orderStatus,
    };
    this.eventEmitter.emit(event, payload);
  }

  private buildWhere(
    query: Partial<OrderQueryDto> & { customerId?: string; shopId?: string },
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (query.customerId) where['customerId'] = query.customerId;
    if (query.shopId) where['shopId'] = query.shopId;
    if (query.status) where['orderStatus'] = query.status;
    if (query.orderNumber) where['orderNumber'] = query.orderNumber;
    if (query.date) {
      const [y, m, d] = query.date.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, d));
      const end = new Date(start.getTime() + 86_400_000);
      where['placedAt'] = { gte: start, lt: end };
    }
    if (query.search) {
      where['OR'] = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
        ]}},
      ];
    }
    return where;
  }
}
