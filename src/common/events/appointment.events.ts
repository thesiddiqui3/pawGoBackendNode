export enum AppointmentEvent {
  CREATED = 'appointment.created',
  CONFIRMED = 'appointment.confirmed',
  CANCELLED = 'appointment.cancelled',
  COMPLETED = 'appointment.completed',
  NO_SHOW = 'appointment.no_show',
  RESCHEDULED = 'appointment.rescheduled',
  STATUS_CHANGED = 'appointment.status_changed',
  DECLINED = 'appointment.declined',
}

export interface AppointmentEventPayload {
  appointmentId: string;
  appointmentNumber: string;
  ownerId: string;
  doctorId: string;
  clinicId: string;
  petId: string;
  status: string;
  appointmentDate: Date;
  startTime: string;
}
