import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RatingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.DeliveryRatingCreateInput) {
    return this.prisma.deliveryRating.create({
      data,
      include: { assignment: { select: { id: true, orderId: true } } },
    });
  }

  async existsByAssignment(assignmentId: string): Promise<boolean> {
    const count = await this.prisma.deliveryRating.count({ where: { assignmentId } });
    return count > 0;
  }

  async getPartnerStats(deliveryPartnerId: string) {
    return this.prisma.deliveryRating.aggregate({
      where: { deliveryPartnerId },
      _avg: { rating: true },
      _count: { id: true },
    });
  }
}
