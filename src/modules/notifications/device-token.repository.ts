import { Injectable } from '@nestjs/common';
import { DevicePlatform, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DeviceTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, deviceId: string, platform: DevicePlatform, fcmToken: string) {
    return this.prisma.deviceToken.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: { userId, deviceId, platform, fcmToken, isActive: true },
      update: { fcmToken, platform, isActive: true, lastUsedAt: new Date() },
    });
  }

  async findActiveTokensByUser(userId: string): Promise<string[]> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { fcmToken: true },
    });
    return tokens.map((t) => t.fcmToken);
  }

  async findActiveTokensByUsers(userIds: string[]): Promise<string[]> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { fcmToken: true },
    });
    return tokens.map((t) => t.fcmToken);
  }

  async findByUserAndDevice(userId: string, deviceId: string) {
    return this.prisma.deviceToken.findUnique({ where: { userId_deviceId: { userId, deviceId } } });
  }

  async deactivate(userId: string, deviceId: string) {
    return this.prisma.deviceToken.updateMany({
      where: { userId, deviceId },
      data: { isActive: false },
    });
  }

  async findAll(userId: string) {
    return this.prisma.deviceToken.findMany({ where: { userId } });
  }
}
