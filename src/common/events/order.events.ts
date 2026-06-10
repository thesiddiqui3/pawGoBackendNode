export enum OrderEvent {
  CREATED = 'order.created',
  CONFIRMED = 'order.confirmed',
  PACKED = 'order.packed',
  OUT_FOR_DELIVERY = 'order.out_for_delivery',
  DELIVERED = 'order.delivered',
  CANCELLED = 'order.cancelled',
}

export interface OrderEventPayload {
  orderId: string;
  orderNumber: string;
  customerId: string;
  shopId: string;
  totalAmount: number;
  orderStatus: string;
}
