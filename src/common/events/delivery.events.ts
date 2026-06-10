export enum DeliveryEvent {
  ASSIGNED = 'delivery.assigned',
  ACCEPTED = 'delivery.accepted',
  PICKED_UP = 'delivery.picked_up',
  STARTED = 'delivery.started',
  COMPLETED = 'delivery.completed',
  FAILED = 'delivery.failed',
  PARTNER_ONLINE = 'partner.online',
  PARTNER_OFFLINE = 'partner.offline',
  LOCATION_UPDATED = 'location.updated',
}

export interface DeliveryAssignmentEventPayload {
  assignmentId: string;
  orderId: string;
  deliveryPartnerId: string;
  status: string;
}

export interface LocationUpdatedEventPayload {
  deliveryPartnerId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
}
