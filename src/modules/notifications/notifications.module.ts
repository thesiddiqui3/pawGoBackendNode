import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { FirebaseModule } from '../../shared/firebase/firebase.module';
import { PushNotificationProcessor, PUSH_QUEUE } from '../../shared/notification-queue/push-notification.processor';
import { NotificationRepository } from './notification.repository';
import { DeviceTokenRepository } from './device-token.repository';
import { PreferenceRepository } from './preference.repository';
import { NotificationsService, PUSH_QUEUE as SVC_PUSH_QUEUE } from './notifications.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationEventListener } from './notification-event.listener';
import { VaccinationReminderCron } from './vaccination-reminder.cron';
import { AdminNotificationsController, NotificationsController } from './notifications.controller';

@Module({
  imports: [
    FirebaseModule,
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: PUSH_QUEUE }),
  ],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [
    NotificationsService,
    NotificationRepository,
    DeviceTokenRepository,
    PreferenceRepository,
    NotificationGateway,
    NotificationEventListener,
    VaccinationReminderCron,
    PushNotificationProcessor,
  ],
  exports: [NotificationsService, NotificationGateway],
})
export class NotificationsModule {}
