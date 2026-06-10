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
        const isDev = configService.get<string>('app.nodeEnv') === 'development';
        return isDev ? new ConsoleEmailService() : new SmtpEmailService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
