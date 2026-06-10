import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const DEFAULT_PREFERENCES = {
  bookingNotifications: true,
  orderNotifications: true,
  reviewNotifications: true,
  vaccinationReminders: true,
  marketingNotifications: true,
  systemNotifications: true,
  deliveryNotifications: true,
};

@Injectable()
export class PreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { user: { connect: { id: userId } }, ...DEFAULT_PREFERENCES },
      update: {},
    });
  }

  async update(userId: string, data: Partial<typeof DEFAULT_PREFERENCES>) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { user: { connect: { id: userId } }, ...DEFAULT_PREFERENCES, ...data },
      update: data,
    });
  }

  async isEnabled(userId: string, field: keyof typeof DEFAULT_PREFERENCES): Promise<boolean> {
    const prefs = await this.getOrCreate(userId);
    return Boolean((prefs as Record<string, unknown>)[field]);
  }
}
