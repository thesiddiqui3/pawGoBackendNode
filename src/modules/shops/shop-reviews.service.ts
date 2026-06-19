import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewTargetType } from '../../common/enums/clinic.enum';
import { PrismaService } from '../../database/prisma.service';
import { ReviewRepository } from '../reviews/review.repository';

@Injectable()
export class ShopReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  private async resolveShopId(ownerId: string): Promise<string> {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId }, select: { id: true } });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop.id;
  }

  async findShopReviews(ownerId: string, query: Record<string, any>) {
    const shopId = await this.resolveShopId(ownerId);
    return this.reviewRepository.findMany({
      ...query,
      targetType: ReviewTargetType.SHOP as any,
      shopId,
    } as any);
  }

  async addReply(reviewId: string, reply: string, ownerId: string): Promise<any> {
    const review = await this.reviewRepository.findById(reviewId);
    if (!review) throw new NotFoundException('Review not found');

    const shopId = await this.resolveShopId(ownerId);
    if (review.shopId !== shopId) {
      throw new ForbiddenException('You can only reply to reviews of your own shop');
    }

    return this.reviewRepository.addReply(reviewId, reply, ownerId);
  }

  async removeReply(reviewId: string, ownerId: string): Promise<any> {
    const review = await this.reviewRepository.findById(reviewId);
    if (!review) throw new NotFoundException('Review not found');

    const shopId = await this.resolveShopId(ownerId);
    if (review.shopId !== shopId) {
      throw new ForbiddenException('You can only remove replies from your own shop');
    }

    return this.reviewRepository.removeReply(reviewId);
  }
}
