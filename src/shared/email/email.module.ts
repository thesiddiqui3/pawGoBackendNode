import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleEmailService } from './console-email.service';
import { SmtpEmailService } from './smtp-email.service';
import { EMAIL_SERVICE } from './email.interface';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SERVICE,
      useFactory: (configService: ConfigService) => {
        // Use real SMTP whenever EMAIL_USER is set, regardless of NODE_ENV.
        // Without credentials → console logs the email (safe for local dev).
        const hasCredentials = !!configService.get<string>('email.user');
        return hasCredentials ? new SmtpEmailService(configService) : new ConsoleEmailService();
      },
      inject: [ConfigService],
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
