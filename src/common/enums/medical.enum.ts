export enum AttachmentType {
  PDF = 'PDF',
  JPG = 'JPG',
  JPEG = 'JPEG',
  PNG = 'PNG',
  WEBP = 'WEBP',
}

export enum ReminderStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  CANCELLED = 'CANCELLED',
}

export enum ReminderType {
  THIRTY_DAYS = 'THIRTY_DAYS',
  FIFTEEN_DAYS = 'FIFTEEN_DAYS',
  SEVEN_DAYS = 'SEVEN_DAYS',
  DUE_DATE = 'DUE_DATE',
}

export const REMINDER_OFFSETS: Record<ReminderType, number> = {
  [ReminderType.THIRTY_DAYS]: 30,
  [ReminderType.FIFTEEN_DAYS]: 15,
  [ReminderType.SEVEN_DAYS]: 7,
  [ReminderType.DUE_DATE]: 0,
};

export const MIME_TO_ATTACHMENT_TYPE: Record<string, AttachmentType> = {
  'application/pdf': AttachmentType.PDF,
  'image/jpeg': AttachmentType.JPEG,
  'image/jpg': AttachmentType.JPG,
  'image/png': AttachmentType.PNG,
  'image/webp': AttachmentType.WEBP,
};
