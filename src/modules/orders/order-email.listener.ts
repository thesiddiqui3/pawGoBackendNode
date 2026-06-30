import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EMAIL_SERVICE, IEmailService } from '../../shared/email/email.interface';
import { emailTemplates } from '../../shared/email/email-templates';
import { OrderEvent, OrderEventPayload } from '../../common/events/order.events';
import { OrderRepository } from './order.repository';

const STATUS_MESSAGE: Record<string, string> = {
  CONFIRMED: 'Your order has been confirmed by the shop and is being prepared.',
  PACKED: 'Your order has been packed and is ready for pickup by a delivery partner.',
  OUT_FOR_DELIVERY: 'Your order is on its way! The delivery partner is heading to your address.',
  DELIVERED: 'Your order has been delivered. We hope you enjoy your purchase!',
  CANCELLED: 'Your order has been cancelled.',
};

@Injectable()
export class OrderEmailListener {
  private readonly logger = new Logger(OrderEmailListener.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
  ) {}

  @OnEvent(OrderEvent.CREATED)
  async onOrderCreated(payload: OrderEventPayload) {
    const order = await this.orderRepository.findById(payload.orderId).catch(() => null);
    if (!order) return;

    const customer = (order as any).customer;
    const shop = (order as any).shop;
    const items = ((order as any).items ?? []) as Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
    }>;
    const address = (order as any).address;

    if (!customer?.email) return;

    const addressStr = address
      ? [address.line1, address.city, address.state, address.pincode].filter(Boolean).join(', ')
      : 'Address on file';

    const html = emailTemplates.orderPlaced(
      customer.firstName ?? 'Customer',
      order.orderNumber,
      shop?.name ?? 'Shop',
      items.map((i) => ({ name: i.productName, qty: i.quantity, price: i.unitPrice })),
      order.subtotal,
      order.discount ?? 0,
      order.totalAmount,
      addressStr,
      order.paymentMethod,
    );

    this.emailService
      .send({
        to: customer.email,
        subject: `Order Placed — #${order.orderNumber}`,
        html,
      })
      .catch((err: Error) => this.logger.error(`orderPlaced email failed for ${order.id}: ${err?.message}`));
  }

  @OnEvent(OrderEvent.CONFIRMED)
  async onOrderConfirmed(payload: OrderEventPayload) {
    await this.sendStatusEmail(payload.orderId, 'CONFIRMED');
  }

  @OnEvent(OrderEvent.PACKED)
  async onOrderPacked(payload: OrderEventPayload) {
    await this.sendStatusEmail(payload.orderId, 'PACKED');
  }

  @OnEvent(OrderEvent.OUT_FOR_DELIVERY)
  async onOrderOutForDelivery(payload: OrderEventPayload) {
    await this.sendStatusEmail(payload.orderId, 'OUT_FOR_DELIVERY');
  }

  @OnEvent(OrderEvent.DELIVERED)
  async onOrderDelivered(payload: OrderEventPayload) {
    await this.sendStatusEmail(payload.orderId, 'DELIVERED');
  }

  @OnEvent(OrderEvent.CANCELLED)
  async onOrderCancelled(payload: OrderEventPayload) {
    await this.sendStatusEmail(payload.orderId, 'CANCELLED');
  }

  private async sendStatusEmail(orderId: string, status: string): Promise<void> {
    const order = await this.orderRepository.findById(orderId).catch(() => null);
    if (!order) return;

    const customer = (order as any).customer;
    const shop = (order as any).shop;

    if (!customer?.email) return;

    const html = emailTemplates.orderStatusUpdate(
      customer.firstName ?? 'Customer',
      order.orderNumber,
      shop?.name ?? 'Shop',
      status,
      STATUS_MESSAGE[status] ?? `Your order status has been updated to ${status}.`,
    );

    this.emailService
      .send({
        to: customer.email,
        subject: `Order ${status.replace(/_/g, ' ')} — #${order.orderNumber}`,
        html,
      })
      .catch((err: Error) =>
        this.logger.error(`order status email (${status}) failed for ${orderId}: ${err?.message}`),
      );
  }
}
