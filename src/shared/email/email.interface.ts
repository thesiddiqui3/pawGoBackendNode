export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IEmailService {
  send(options: SendEmailOptions): Promise<void>;
}

export const EMAIL_SERVICE = 'EMAIL_SERVICE';
