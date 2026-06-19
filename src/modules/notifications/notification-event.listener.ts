import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { AppointmentEvent, AppointmentEventPayload } from '../../common/events/appointment.events';
import { OrderEvent, OrderEventPayload } from '../../common/events/order.events';
import { DeliveryEvent, DeliveryAssignmentEventPayload } from '../../common/events/delivery.events';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(
    private readonly notifService: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationGateway,
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
    this.logger.log(`[ASSIGNED] event received: assignmentId=${payload.assignmentId} orderId=${payload.orderId} partnerId=${payload.deliveryPartnerId}`);
    await this.safe('delivery.assigned', async () => {
      const order = await this.prisma.order.findUnique({
        where: { id: payload.orderId },
        select: {
          customerId: true,
          orderNumber: true,
          totalAmount: true,
          customer: { select: { firstName: true, lastName: true, phone: true } },
          address: { select: { addressLine1: true, addressLine2: true, city: true } },
          items: { take: 1, select: { product: { select: { name: true } } } },
        },
      });
      this.logger.log(`[ASSIGNED] order found: ${order?.orderNumber ?? 'NULL'}`);
      if (order) {
        await this.notifService.notify({
          userId: order.customerId,
          title: 'Delivery Partner Assigned',
          message: `A delivery partner has been assigned to your order ${order.orderNumber}.`,
          type: NotificationType.DELIVERY_ASSIGNED,
          data: { assignmentId: payload.assignmentId, orderId: payload.orderId },
        });

        const partner = await this.prisma.deliveryPartner.findUnique({
          where: { id: payload.deliveryPartnerId },
          select: { userId: true },
        });
        this.logger.log(`[ASSIGNED] partner userId: ${partner?.userId ?? 'NULL'}`);
        if (partner) {
          const addrParts = [order.address?.addressLine1, order.address?.addressLine2, order.address?.city].filter(Boolean);
          const socketPayload = {
            assignmentId: payload.assignmentId,
            orderId: payload.orderId,
            orderNumber: order.orderNumber,
            customerName: `${order.customer?.firstName ?? ''} ${order.customer?.lastName ?? ''}`.trim(),
            customerPhone: order.customer?.phone ?? '',
            productName: order.items[0]?.product?.name ?? 'Pet items',
            deliveryAddress: addrParts.join(', '),
            totalAmount: order.totalAmount,
          };
          this.logger.log(`[ASSIGNED] emitting delivery:new_assignment to user:${partner.userId}`);
          this.gateway.sendToUser(partner.userId, 'delivery:new_assignment', socketPayload);
        }
      }
    });
  }

  @OnEvent(DeliveryEvent.REJECTED)
  async onDeliveryRejected(payload: DeliveryAssignmentEventPayload) {
    this.logger.log(`[REJECTED] assignmentId=${payload.assignmentId} orderId=${payload.orderId}`);
    await this.safe('delivery.rejected', async () => {
      const order = await this.prisma.order.findUnique({
        where: { id: payload.orderId },
        select: {
          orderNumber: true,
          shop: { select: { ownerId: true } },
          items: { take: 1, select: { product: { select: { name: true } } } },
        },
      });
      if (!order?.shop?.ownerId) {
        this.logger.warn(`[REJECTED] shop owner not found for order ${payload.orderId}`);
        return;
      }
      const ownerId = order.shop.ownerId;
      this.logger.log(`[REJECTED] emitting delivery:rejected to shop owner ${ownerId}`);
      this.gateway.sendToUser(ownerId, 'delivery:rejected', {
        assignmentId: payload.assignmentId,
        orderId: payload.orderId,
        orderNumber: order.orderNumber,
        productName: order.items[0]?.product?.name ?? 'Pet items',
      });
      await this.notifService.notify({
        userId: ownerId,
        title: 'Delivery Rejected — Reassign Required',
        message: `Order ${order.orderNumber} was rejected by the delivery partner. Please assign a new partner.`,
        type: NotificationType.DELIVERY_ASSIGNED,
        data: { orderId: payload.orderId, assignmentId: payload.assignmentId },
      });
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

  @OnEvent(AppointmentEvent.DECLINED)
  async onAppointmentDeclined(payload: AppointmentEventPayload) {
    await this.safe('appointment.declined', async () => {
      const apt = await this.prisma.appointment.findUnique({
        where: { id: payload.appointmentId },
        include: {
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          pet: { select: { name: true, species: true } },
        },
      });
      if (!apt) return;

      // Clinic owner is stored in ClinicStaff with role CLINIC_OWNER
      const ownerStaff = await this.prisma.clinicStaff.findFirst({
        where: { clinicId: apt.clinicId, role: 'CLINIC_OWNER', isActive: true },
        select: { userId: true },
      });
      if (!ownerStaff) return;
      const ownerId = ownerStaff.userId;

      const petLabel = apt.pet ? `${apt.pet.name} (${apt.pet.species})` : 'a pet';
      const doctorName = apt.doctor?.user
        ? `${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`.trim()
        : '';
      this.gateway.sendToUser(ownerId, 'appointment:declined', {
        appointmentId: apt.id,
        appointmentNumber: apt.appointmentNumber,
        petName: petLabel,
        doctorName,
        date: this.fmtDate(apt.appointmentDate),
      });
      await this.notifService.notify({
        userId: ownerId,
        title: 'Appointment Declined — Reassign Required',
        message: `Appointment ${apt.appointmentNumber} for ${petLabel} on ${this.fmtDate(apt.appointmentDate)} was declined by staff. Please reassign.`,
        type: NotificationType.BOOKING_CANCELLED,
        data: { appointmentId: apt.id },
      });
    });
  }

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
