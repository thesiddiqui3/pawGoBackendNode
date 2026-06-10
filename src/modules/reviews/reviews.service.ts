import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Review } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { ReviewTargetType } from '../../common/enums/clinic.enum';
import { ClinicRepository } from '../clinics/clinic.repository';
import { DoctorRepository } from '../doctors/doctor.repository';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewRepository } from './review.repository';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly clinicRepository: ClinicRepository,
    private readonly doctorRepository: DoctorRepository,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const existing = await this.reviewRepository.findByUserAndTarget(
      userId,
      dto.targetType,
      dto.targetId,
    );
    if (existing) {
      throw new ConflictException('You have already reviewed this. Use PATCH to update.');
    }

    const review = await this.reviewRepository.create(userId, dto);
    await this.propagateRating(dto.targetType, dto.targetId);

    this.logger.log(`Review created: ${review.id} by ${userId}`);
    return review;
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async findMany(query: ReviewQueryDto): Promise<PaginatedResponseDto<Review>> {
    return this.reviewRepository.findMany(query);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateReviewDto,
    requesterId: string,
    requesterRole: string,
  ): Promise<Review> {
    const review = await this.findOrThrow(id);
    this.assertOwnerOrAdmin(review.userId, requesterId, requesterRole, 'update');

    const updated = await this.reviewRepository.update(id, dto);
    await this.propagateRating(review.targetType as ReviewTargetType, review.targetId);

    return updated;
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async remove(id: string, requesterId: string, requesterRole: string): Promise<void> {
    const review = await this.findOrThrow(id);
    this.assertOwnerOrAdmin(review.userId, requesterId, requesterRole, 'delete');

    await this.reviewRepository.delete(id);
    await this.propagateRating(review.targetType as ReviewTargetType, review.targetId);

    this.logger.log(`Review deleted: ${id}`);
  }

  // ─── Rating aggregation ───────────────────────────────────────────────────

  private async propagateRating(
    targetType: ReviewTargetType,
    targetId: string,
  ): Promise<void> {
    const agg = await this.reviewRepository.aggregateRating(targetType, targetId);
    const rating = Math.round((agg._avg.rating ?? 0) * 10) / 10; // 1 decimal
    const totalReviews = agg._count.rating;

    if (targetType === ReviewTargetType.CLINIC) {
      await this.clinicRepository.updateRating(targetId, rating, totalReviews);
    } else {
      await this.doctorRepository.updateRating(targetId, rating, totalReviews);
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async assertTargetExists(targetType: ReviewTargetType, targetId: string): Promise<void> {
    if (targetType === ReviewTargetType.CLINIC) {
      const clinic = await this.clinicRepository.findById(targetId);
      if (!clinic || clinic.deletedAt) {
        throw new NotFoundException('Clinic not found');
      }
    } else {
      const doctor = await this.doctorRepository.findById(targetId);
      if (!doctor || !doctor.isActive) {
        throw new NotFoundException('Doctor not found');
      }
    }
  }

  private async findOrThrow(id: string): Promise<Review> {
    const review = await this.reviewRepository.findById(id);
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  private assertOwnerOrAdmin(
    ownerId: string,
    requesterId: string,
    role: string,
    action: string,
  ): void {
    const isAdmin = role === UserRole.SUPER_ADMIN;
    if (ownerId !== requesterId && !isAdmin) {
      throw new ForbiddenException(`You do not have permission to ${action} this review`);
    }
  }
}
