import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationRepository } from '../../modules/notifications/notification.repository';
import { DeviceTokenRepository } from '../../modules/notifications/device-token.repository';
import { NotificationGateway } from '../../modules/notifications/notification.gateway';

export const PUSH_QUEUE = 'push-notification-queue';

interface PushJobData {
  notificationId?: string;
  userId?: string;
  userIds?: string[];
  title: string;
  message: string;
  imageUrl?: string;
  data?: Record<string, unknown>;
}

@Processor(PUSH_QUEUE)
export class PushNotificationProcessor {
  private readonly logger = new Logger(PushNotificationProcessor.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly notificationRepo: NotificationRepository,
    private readonly deviceTokenRepo: DeviceTokenRepository,
    private readonly gateway: NotificationGateway,
  ) {}

  @Process('send-push')
  async handleSendPush(job: Job<PushJobData>) {
    const { notificationId, userId, title, message, imageUrl, data } = job.data;
    if (!userId) return;

    try {
      const tokens = await this.deviceTokenRepo.findActiveTokensByUser(userId);

      if (tokens.length > 0) {
        const stringData = this.toStringRecord(data);
        const result = await this.firebaseService.sendToMultipleTokens(tokens, {
          title,
          body: message,
          imageUrl,
          data: stringData,
        });

        if (notificationId) {
          const failureCount = result?.failureCount ?? 0;
          await this.notificationRepo.createLog({
            notificationId,
            status: failureCount === tokens.length ? 'FAILED' : 'SENT',
            sentAt: new Date(),
            error: failureCount > 0 ? `${failureCount} token(s) failed` : undefined,
          });
        }
      } else if (notificationId) {
        await this.notificationRepo.createLog({ notificationId, status: 'SKIPPED', error: 'No active device tokens' });
      }

      // Also emit via WebSocket for real-time in-app display
      this.gateway.sendToUser(userId, 'notification:new', { title, message, data });
    } catch (err) {
      this.logger.error(`Push failed for user ${userId}`, err);
      if (notificationId) {
        await this.notificationRepo.createLog({ notificationId, status: 'FAILED', error: String(err) });
      }
      throw err; // BullMQ will retry
    }
  }

  @Process('send-push-bulk')
  async handleSendPushBulk(job: Job<PushJobData>) {
    const { userIds, title, message, imageUrl, data } = job.data;
    if (!userIds?.length) return;

    try {
      const tokens = await this.deviceTokenRepo.findActiveTokensByUsers(userIds);
      if (tokens.length > 0) {
        await this.firebaseService.sendToMultipleTokens(tokens, {
          title,
          body: message,
          imageUrl,
          data: this.toStringRecord(data),
        });
      }

      // Real-time for each user
      for (const uid of userIds) {
        this.gateway.sendToUser(uid, 'notification:new', { title, message, data });
      }
    } catch (err) {
      this.logger.error('Bulk push failed', err);
      throw err;
    }
  }

  private toStringRecord(data?: Record<string, unknown>): Record<string, string> {
    if (!data) return {};
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
  }
}
