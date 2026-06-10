import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { DeviceTokenRepository } from '../device-token.repository';
import { NotificationRepository } from '../notification.repository';
import { PreferenceRepository } from '../preference.repository';
import { NotificationsService, PUSH_QUEUE } from '../notifications.service';
import { BroadcastTarget } from '../dto/broadcast-notification.dto';

const mockNotifRepo = () => ({
  create: jest.fn(),
  createMany: jest.fn(),
  findById: jest.fn(),
  findMany: jest.fn(),
  countUnread: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  delete: jest.fn(),
  createLog: jest.fn(),
});

const mockDeviceRepo = () => ({
  upsert: jest.fn(),
  findAll: jest.fn(),
  deactivate: jest.fn(),
  findActiveTokensByUser: jest.fn(),
  findActiveTokensByUsers: jest.fn(),
});

const mockPrefRepo = () => ({
  getOrCreate: jest.fn(),
  update: jest.fn(),
  isEnabled: jest.fn(),
});

const mockPrisma = () => ({
  user: { findMany: jest.fn() },
  shop: { findUnique: jest.fn() },
});

const mockQueue = () => ({ add: jest.fn() });

const makeNotification = (overrides: Record<string, unknown> = {}) => ({
  id: 'notif-uuid',
  userId: 'user-id',
  title: 'Test',
  message: 'Test body',
  type: NotificationType.SYSTEM_ANNOUNCEMENT,
  isRead: false,
  readAt: null,
  createdAt: new Date(),
  ...overrides,
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifRepo: ReturnType<typeof mockNotifRepo>;
  let deviceRepo: ReturnType<typeof mockDeviceRepo>;
  let prefRepo: ReturnType<typeof mockPrefRepo>;
  let prisma: ReturnType<typeof mockPrisma>;
  let queue: ReturnType<typeof mockQueue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: NotificationRepository, useFactory: mockNotifRepo },
        { provide: DeviceTokenRepository, useFactory: mockDeviceRepo },
        { provide: PreferenceRepository, useFactory: mockPrefRepo },
        { provide: PrismaService, useFactory: mockPrisma },
        { provide: getQueueToken(PUSH_QUEUE), useFactory: mockQueue },
      ],
    }).compile();

    service = module.get(NotificationsService);
    notifRepo = module.get(NotificationRepository) as unknown as ReturnType<typeof mockNotifRepo>;
    deviceRepo = module.get(DeviceTokenRepository) as unknown as ReturnType<typeof mockDeviceRepo>;
    prefRepo = module.get(PreferenceRepository) as unknown as ReturnType<typeof mockPrefRepo>;
    prisma = module.get(PrismaService) as unknown as ReturnType<typeof mockPrisma>;
    queue = module.get(getQueueToken(PUSH_QUEUE)) as unknown as ReturnType<typeof mockQueue>;
  });

  describe('notify', () => {
    it('creates in-app notification and enqueues push', async () => {
      notifRepo.create.mockResolvedValue(makeNotification());
      queue.add.mockResolvedValue({});

      await service.notify({ userId: 'user-id', title: 'Test', message: 'Body', type: NotificationType.SYSTEM_ANNOUNCEMENT });

      expect(notifRepo.create).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith('send-push', expect.any(Object), expect.any(Object));
    });
  });

  describe('findOne', () => {
    it('returns notification for owner', async () => {
      notifRepo.findById.mockResolvedValue(makeNotification());
      const result = await service.findOne('notif-uuid', 'user-id');
      expect((result as any).id).toBe('notif-uuid');
    });

    it('throws NotFoundException when not found', async () => {
      notifRepo.findById.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'user-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for wrong user', async () => {
      notifRepo.findById.mockResolvedValue(makeNotification({ userId: 'other-user' }));
      await expect(service.findOne('notif-uuid', 'user-id')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markRead', () => {
    it('marks notification as read', async () => {
      notifRepo.findById.mockResolvedValue(makeNotification());
      notifRepo.markRead.mockResolvedValue({ count: 1 });

      const result = await service.markRead('notif-uuid', 'user-id');
      expect(result.success).toBe(true);
      expect(notifRepo.markRead).toHaveBeenCalledWith('notif-uuid', 'user-id');
    });
  });

  describe('markAllRead', () => {
    it('marks all notifications read for user', async () => {
      notifRepo.markAllRead.mockResolvedValue({ count: 5 });
      const result = await service.markAllRead('user-id');
      expect(result.success).toBe(true);
      expect(notifRepo.markAllRead).toHaveBeenCalledWith('user-id');
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      notifRepo.countUnread.mockResolvedValue(7);
      const result = await service.getUnreadCount('user-id');
      expect(result.count).toBe(7);
    });
  });

  describe('registerDevice', () => {
    it('upserts device token', async () => {
      const token = { id: 'dev-uuid', userId: 'user-id', deviceId: 'dev-1', platform: 'ANDROID', fcmToken: 'token', isActive: true };
      deviceRepo.upsert.mockResolvedValue(token);

      const result = await service.registerDevice('user-id', { deviceId: 'dev-1', platform: 'ANDROID' as any, fcmToken: 'token' });
      expect((result as any).platform).toBe('ANDROID');
    });
  });

  describe('broadcast', () => {
    it('sends to all active users and returns count', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      notifRepo.createMany.mockResolvedValue({ count: 2 });
      queue.add.mockResolvedValue({});

      const result = await service.broadcast(
        { title: 'Maintenance', message: 'Tonight', target: BroadcastTarget.ALL_USERS },
        'admin-id',
      );
      expect((result as any).sent).toBe(2);
    });

    it('returns 0 when no matching users', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      const result = await service.broadcast(
        { title: 'Test', message: 'Test', target: BroadcastTarget.DOCTORS },
        'admin-id',
      );
      expect((result as any).sent).toBe(0);
    });
  });
});
