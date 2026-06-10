import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationType, Prisma, UserRole as PrismaUserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';
import { NotificationRepository } from './notification.repository';
import { DeviceTokenRepository } from './device-token.repository';
import { PreferenceRepository } from './preference.repository';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { BroadcastNotificationDto, BroadcastTarget } from './dto/broadcast-notification.dto';

export const PUSH_QUEUE = 'push-notification-queue';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly deviceTokenRepo: DeviceTokenRepository,
    private readonly preferenceRepo: PreferenceRepository,
    private readonly prisma: PrismaService,
    @InjectQueue(PUSH_QUEUE) private readonly pushQueue: Queue,
  ) {}

  // ─── Core: create in-app + enqueue push ──────────────────────────────────

  async notify(dto: CreateNotificationDto): Promise<void> {
    const notification = await this.notificationRepo.create({
      user: { connect: { id: dto.userId } },
      title: dto.title,
      message: dto.message,
      type: dto.type,
      imageUrl: dto.imageUrl,
      data: (dto.data ?? {}) as Prisma.InputJsonValue,
    });

    // Enqueue FCM push asynchronously — failures don't block in-app delivery
    await this.pushQueue.add(
      'send-push',
      { notificationId: notification.id, userId: dto.userId, title: dto.title, message: dto.message, imageUrl: dto.imageUrl, data: dto.data },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true },
    );
  }

  async notifyMany(userIds: string[], dto: Omit<CreateNotificationDto, 'userId'>): Promise<void> {
    await this.notificationRepo.createMany(
      userIds.map((userId) => ({
        userId,
        title: dto.title,
        message: dto.message,
        type: dto.type,
        imageUrl: dto.imageUrl,
        data: (dto.data ?? {}) as Prisma.InputJsonValue,
      })),
    );
    await this.pushQueue.add(
      'send-push-bulk',
      { userIds, title: dto.title, message: dto.message, imageUrl: dto.imageUrl, data: dto.data },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true },
    );
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  async findAll(userId: string, query: NotificationQueryDto) {
    const where: Record<string, unknown> = { userId };
    if (query.type) where['type'] = query.type;
    if (query.isRead !== undefined) where['isRead'] = query.isRead;
    return this.notificationRepo.findMany(where, query);
  }

  async findOne(id: string, userId: string) {
    const n = await this.notificationRepo.findById(id);
    if (!n) throw new NotFoundException('Notification not found');
    if (n.userId !== userId) throw new ForbiddenException('Access denied');
    return n;
  }

  async getUnreadCount(userId: string) {
    const count = await this.notificationRepo.countUnread(userId);
    return { count };
  }

  // ─── Mark read ────────────────────────────────────────────────────────────

  async markRead(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.notificationRepo.markRead(id, userId);
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.notificationRepo.markAllRead(userId);
    return { success: true };
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.notificationRepo.delete(id, userId);
    return { success: true };
  }

  // ─── Device tokens ────────────────────────────────────────────────────────

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    return this.deviceTokenRepo.upsert(userId, dto.deviceId, dto.platform, dto.fcmToken);
  }

  async removeDevice(userId: string, deviceId: string) {
    await this.deviceTokenRepo.deactivate(userId, deviceId);
    return { success: true };
  }

  async getDevices(userId: string) {
    return this.deviceTokenRepo.findAll(userId);
  }

  // ─── Preferences ─────────────────────────────────────────────────────────

  async getPreferences(userId: string) {
    return this.preferenceRepo.getOrCreate(userId);
  }

  async updatePreferences(userId: string, dto: UpdatePreferenceDto) {
    return this.preferenceRepo.update(userId, dto);
  }

  // ─── Admin: broadcast ─────────────────────────────────────────────────────

  async broadcast(dto: BroadcastNotificationDto, adminId: string) {
    const roleMap: Record<BroadcastTarget, PrismaUserRole | null> = {
      [BroadcastTarget.ALL_USERS]: null,
      [BroadcastTarget.PET_OWNERS]: PrismaUserRole.PET_OWNER,
      [BroadcastTarget.DOCTORS]: PrismaUserRole.ASSISTANT,
      [BroadcastTarget.SHOP_OWNERS]: PrismaUserRole.SHOP_OWNER,
      [BroadcastTarget.DELIVERY_PARTNERS]: PrismaUserRole.DELIVERY_PARTNER,
    };

    const role = roleMap[dto.target];
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        ...(role ? { role } : {}),
      },
      select: { id: true },
    });

    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return { sent: 0 };

    await this.notifyMany(userIds, {
      title: dto.title,
      message: dto.message,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      imageUrl: dto.imageUrl,
    });

    this.logger.log(`Broadcast to ${userIds.length} users by admin ${adminId}`);
    return { sent: userIds.length };
  }
}
