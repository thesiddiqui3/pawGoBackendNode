import { Injectable, Logger } from '@nestjs/common';
import { IEmailService, SendEmailOptions } from './email.interface';

// Development email service — logs to console instead of sending real emails
@Injectable()
export class ConsoleEmailService implements IEmailService {
  private readonly logger = new Logger('Email');

  async send(options: SendEmailOptions): Promise<void> {
    this.logger.log(`
╔══════════════════════════════════════╗
║           EMAIL (DEV MODE)           ║
╠══════════════════════════════════════╣
║ To:      ${options.to.padEnd(28)}║
║ Subject: ${options.subject.slice(0, 28).padEnd(28)}║
╚══════════════════════════════════════╝
    `);
    this.logger.debug(options.html);
  }
}
