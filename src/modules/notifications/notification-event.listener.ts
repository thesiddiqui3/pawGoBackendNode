import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { AppointmentEvent, AppointmentEventPayload } from '../../common/events/appointment.events';
import { OrderEvent, OrderEventPayload } from '../../common/events/order.events';
import { DeliveryEvent, DeliveryAssignmentEventPayload } from '../../common/events/delivery.events';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(
    private readonly notifService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Appointment events ───────────────────────────────────────────────────

  @OnEvent(AppointmentEvent.CREATED)
  async onAppointmentCreated(payload: AppointmentEventPayload) {
    await this.safe('appointment.created', async () => {
      const apt = await this.getAppointment(payload.appointmentId);
      if (!apt) return;

      // Notify owner
      await this.notifService.notify({
        userId: apt.ownerId,
        title: 'Appointment Requested',
        message: `Your appointment with Dr. ${apt.doctor?.user?.firstName ?? ''} on ${this.fmtDate(apt.appointmentDate)} has been submitted.`,
        type: NotificationType.BOOKING_CREATED,
        data: { appointmentId: apt.id },
      });

      // Notify doctor
      if (apt.doctor?.userId) {
        await this.notifService.notify({
          userId: apt.doctor.userId,
          title: 'New Appointment Request',
          message: `A new appointment has been booked for ${this.fmtDate(apt.appointmentDate)}.`,
          type: NotificationType.BOOKING_CREATED,
          data: { appointmentId: apt.id },
        });
      }
    });
  }

  @OnEvent(AppointmentEvent.CONFIRMED)
  async onAppointmentConfirmed(payload: AppointmentEventPayload) {
    await this.safe('appointment.confirmed', async () => {
      const apt = await this.getAppointment(payload.appointmentId);
      if (!apt) return;
      await this.notifService.notify({
        userId: apt.ownerId,
        title: 'Appointment Confirmed',
        message: `Your appointment with Dr. ${apt.doctor?.user?.firstName ?? ''} is confirmed for ${this.fmtDate(apt.appointmentDate)}.`,
        type: NotificationType.BOOKING_CONFIRMED,
        data: { appointmentId: apt.id },
      });
    });
  }

  @OnEvent(AppointmentEvent.CANCELLED)
  async onAppointmentCancelled(payload: AppointmentEventPayload) {
    await this.safe('appointment.cancelled', async () => {
      const apt = await this.getAppointment(payload.appointmentId);
      if (!apt) return;
      const notifs = [apt.ownerId];
      if (apt.doctor?.userId) notifs.push(apt.doctor.userId);
      await this.notifService.notifyMany(notifs, {
        title: 'Appointment Cancelled',
        message: `Appointment on ${this.fmtDate(apt.appointmentDate)} has been cancelled.`,
        type: NotificationType.BOOKING_CANCELLED,
        data: { appointmentId: apt.id },
      });
    });
  }

  @OnEvent(AppointmentEvent.COMPLETED)
  async onAppointmentCompleted(payload: AppointmentEventPayload) {
    await this.safe('appointment.completed', async () => {
      const apt = await this.getAppointment(payload.appointmentId);
      if (!apt) return;
      await this.notifService.notify({
        userId: apt.ownerId,
        title: 'Appointment Completed',
        message: `Your appointment with Dr. ${apt.doctor?.user?.firstName ?? ''} is complete.`,
        type: NotificationType.BOOKING_COMPLETED,
        data: { appointmentId: apt.id },
      });
    });
  }

  // ─── Order events ─────────────────────────────────────────────────────────

  @OnEvent(OrderEvent.CREATED)
  async onOrderCreated(payload: OrderEventPayload) {
    await this.safe('order.created', async () => {
      await this.notifService.notify({
        userId: payload.customerId,
        title: 'Order Placed',
        message: `Order ${payload.orderNumber} has been placed. Total: ₹${payload.totalAmount}`,
        type: NotificationType.ORDER_PLACED,
        data: { orderId: payload.orderId, orderNumber: payload.orderNumber },
      });

      // Notify shop owner
      const shop = await this.prisma.shop.findUnique({ where: { id: payload.shopId }, select: { ownerId: true } });
      if (shop?.ownerId) {
        await this.notifService.notify({
          userId: shop.ownerId,
          title: 'New Order Received',
          message: `Order ${payload.orderNumber} received. Total: ₹${payload.totalAmount}`,
          type: NotificationType.ORDER_PLACED,
          data: { orderId: payload.orderId, orderNumber: payload.orderNumber },
        });
      }
    });
  }

  @OnEvent(OrderEvent.DELIVERED)
  async onOrderDelivered(payload: OrderEventPayload) {
    await this.safe('order.delivered', async () => {
      await this.notifService.notify({
        userId: payload.customerId,
        title: 'Order Delivered',
        message: `Your order ${payload.orderNumber} has been delivered!`,
        type: NotificationType.ORDER_DELIVERED,
        data: { orderId: payload.orderId },
      });
    });
  }

  @OnEvent(OrderEvent.CANCELLED)
  async onOrderCancelled(payload: OrderEventPayload) {
    await this.safe('order.cancelled', async () => {
      await this.notifService.notify({
        userId: payload.customerId,
        title: 'Order Cancelled',
        message: `Your order ${payload.orderNumber} has been cancelled.`,
        type: NotificationType.ORDER_CANCELLED,
        data: { orderId: payload.orderId },
      });
    });
  }

  // ─── Delivery events ──────────────────────────────────────────────────────

  @OnEvent(DeliveryEvent.ASSIGNED)
  async onDeliveryAssigned(payload: DeliveryAssignmentEventPayload) {
    await this.safe('delivery.assigned', async () => {
      const order = await this.prisma.order.findUnique({ where: { id: payload.orderId }, select: { customerId: true, orderNumber: true } });
      if (order) {
        await this.notifService.notify({
          userId: order.customerId,
          title: 'Delivery Partner Assigned',
          message: `A delivery partner has been assigned to your order ${order.orderNumber}.`,
          type: NotificationType.DELIVERY_ASSIGNED,
          data: { assignmentId: payload.assignmentId, orderId: payload.orderId },
        });
      }
    });
  }

  @OnEvent(DeliveryEvent.COMPLETED)
  async onDeliveryCompleted(payload: DeliveryAssignmentEventPayload) {
    await this.safe('delivery.completed', async () => {
      const order = await this.prisma.order.findUnique({ where: { id: payload.orderId }, select: { customerId: true, orderNumber: true } });
      if (order) {
        await this.notifService.notify({
          userId: order.customerId,
          title: 'Your Order is Delivered',
          message: `Your order ${order.orderNumber} has been delivered by our partner!`,
          type: NotificationType.DELIVERY_COMPLETED,
          data: { assignmentId: payload.assignmentId, orderId: payload.orderId },
        });
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getAppointment(appointmentId: string) {
    return this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true, id: true } } } },
        pet: { select: { ownerId: true } },
      },
    }).then((apt) => apt ? { ...apt, ownerId: apt.pet?.ownerId ?? apt.ownerId ?? '' } : null);
  }

  private async safe(event: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`Notification listener failed for ${event}`, err);
    }
  }

  private fmtDate(date: Date): string {
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
