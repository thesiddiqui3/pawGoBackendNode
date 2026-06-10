import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.NotificationCreateInput) {
    return this.prisma.notification.create({ data });
  }

  async createMany(items: Prisma.NotificationCreateManyInput[]) {
    return this.prisma.notification.createMany({ data: items, skipDuplicates: true });
  }

  async findById(id: string) {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  async findMany(
    where: Prisma.NotificationWhereInput,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<object>> {
    const { skip, take, page, pageSize } = getPaginationMeta(pagination);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return buildPaginatedResponse(items as object[], total, page, pageSize);
  }

  async findAllAdmin(
    filters: { type?: string; userId?: string; isRead?: boolean; from?: string; to?: string },
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<object>> {
    const { skip, take, page, pageSize } = getPaginationMeta(pagination);
    const where: Prisma.NotificationWhereInput = {};
    if (filters.type) where.type = filters.type as any;
    if (filters.userId) where.userId = filters.userId;
    if (filters.isRead !== undefined) where.isRead = filters.isRead;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return buildPaginatedResponse(items as object[], total, page, pageSize);
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.notification.deleteMany({ where: { id, userId } });
  }

  async createLog(data: {
    notificationId: string;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
    provider?: string;
    sentAt?: Date;
    error?: string;
  }) {
    return this.prisma.notificationLog.create({ data });
  }
}
