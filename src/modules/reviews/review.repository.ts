import { Injectable } from '@nestjs/common';
import { Prisma, Review, ReviewTargetType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginatedResponse, getPaginationMeta } from '../../common/utils/pagination.helper';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

export interface RatingAggregate {
  _avg: { rating: number | null };
  _count: { rating: number };
}

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    return this.prisma.review.create({
      data: {
        userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        rating: dto.rating,
        comment: dto.comment,
        ...(dto.targetType === ReviewTargetType.CLINIC && { clinicId: dto.targetId }),
        ...(dto.targetType === ReviewTargetType.ASSISTANT && { doctorId: dto.targetId }),
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async findById(id: string): Promise<Review | null> {
    return this.prisma.review.findUnique({
      where: { id },
      include: { user: { select: USER_SELECT } },
    });
  }

  async findByUserAndTarget(
    userId: string,
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<Review | null> {
    return this.prisma.review.findUnique({
      where: { userId_targetType_targetId: { userId, targetType, targetId } },
    });
  }

  async findMany(query: ReviewQueryDto): Promise<PaginatedResponseDto<any>> {
    const { skip, take, page, pageSize } = getPaginationMeta(query);

    // clinicId/shopId are convenience aliases for targetId
    const effectiveTargetId = query.targetId ?? query.clinicId ?? query.shopId;

    const where: Prisma.ReviewWhereInput = {
      ...(query.targetType && { targetType: query.targetType }),
      ...(effectiveTargetId && { targetId: effectiveTargetId }),
      ...(query.rating !== undefined && { rating: query.rating }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: USER_SELECT },
          clinic: { select: { id: true, name: true } },
          doctor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    // Flatten target name into a consistent `targetName` field
    const mapped = items.map((r: any) => ({
      ...r,
      targetName: r.clinic?.name
        ?? (r.doctor ? `Dr. ${r.doctor.user.firstName} ${r.doctor.user.lastName}` : null)
        ?? r.targetId,
    }));

    return buildPaginatedResponse(mapped, total, page, pageSize);
  }

  async update(id: string, dto: UpdateReviewDto): Promise<Review> {
    return this.prisma.review.update({
      where: { id },
      data: {
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.comment !== undefined && { comment: dto.comment }),
      },
      include: { user: { select: USER_SELECT } },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.review.delete({ where: { id } });
  }

  async aggregateRating(targetType: ReviewTargetType, targetId: string): Promise<RatingAggregate> {
    const where = { targetType, targetId };
    const [agg, count] = await this.prisma.$transaction([
      this.prisma.review.aggregate({ where, _avg: { rating: true } }),
      this.prisma.review.count({ where }),
    ]);
    return {
      _avg: { rating: agg._avg?.rating ?? null },
      _count: { rating: count },
    };
  }
}
