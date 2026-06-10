import { Injectable } from '@nestjs/common';
import { DeliveryPartner, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';

const PARTNER_WITH_USER = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true } },
} as const;

@Injectable()
export class DeliveryPartnerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.DeliveryPartnerCreateInput): Promise<DeliveryPartner> {
    return this.prisma.deliveryPartner.create({ data, include: PARTNER_WITH_USER });
  }

  async findByUserId(userId: string) {
    return this.prisma.deliveryPartner.findUnique({ where: { userId }, include: PARTNER_WITH_USER });
  }

  async findById(id: string) {
    return this.prisma.deliveryPartner.findUnique({ where: { id }, include: PARTNER_WITH_USER });
  }

  async existsByUserId(userId: string): Promise<boolean> {
    const count = await this.prisma.deliveryPartner.count({ where: { userId } });
    return count > 0;
  }

  async update(id: string, data: Prisma.DeliveryPartnerUpdateInput) {
    return this.prisma.deliveryPartner.update({ where: { id }, data, include: PARTNER_WITH_USER });
  }

  async findMany(
    where: Prisma.DeliveryPartnerWhereInput,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<object>> {
    const { skip, take, page, pageSize } = getPaginationMeta(pagination);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.deliveryPartner.findMany({
        where,
        skip,
        take,
        include: PARTNER_WITH_USER,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.deliveryPartner.count({ where }),
    ]);

    return buildPaginatedResponse(items as object[], total, page, pageSize);
  }

  // Find approved, online, available partners sorted by proximity (Haversine in JS)
  async findAvailablePartners(): Promise<DeliveryPartner[]> {
    return this.prisma.deliveryPartner.findMany({
      where: { isApproved: true, isOnline: true, isAvailable: true },
      include: PARTNER_WITH_USER,
    });
  }

  async incrementDeliveries(id: string, earnedAmount: number) {
    return this.prisma.deliveryPartner.update({
      where: { id },
      data: { totalDeliveries: { increment: 1 }, totalEarnings: { increment: earnedAmount } },
    });
  }

  async updateRating(id: string, newRating: number, totalRatings: number) {
    return this.prisma.deliveryPartner.update({
      where: { id },
      data: { averageRating: newRating, totalRatings },
    });
  }
}
