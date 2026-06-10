import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
import { AssignmentRepository } from '../delivery-assignments/assignment.repository';
import { DeliveryPartnerRepository } from '../delivery-partners/delivery-partner.repository';
import { RatingRepository } from './rating.repository';
import { CreateDeliveryRatingDto } from './dto/create-delivery-rating.dto';

@Injectable()
export class RatingsService {
  constructor(
    private readonly ratingRepository: RatingRepository,
    private readonly assignmentRepository: AssignmentRepository,
    private readonly partnerRepository: DeliveryPartnerRepository,
  ) {}

  async create(customerId: string, dto: CreateDeliveryRatingDto) {
    const assignment = await this.assignmentRepository.findById(dto.assignmentId);
    if (!assignment) throw new NotFoundException('Assignment not found');

    // Only rate after successful delivery
    if (assignment.status !== DeliveryStatus.DELIVERED) {
      throw new BadRequestException('Ratings are only allowed after successful delivery');
    }

    // Verify the customer placed the order (order.customerId checked via assignment's order relation)
    const order = (assignment as any).order;
    if (order?.customerId && order.customerId !== customerId) {
      throw new ForbiddenException('You can only rate your own deliveries');
    }

    const alreadyRated = await this.ratingRepository.existsByAssignment(dto.assignmentId);
    if (alreadyRated) throw new ConflictException('You have already rated this delivery');

    const rating = await this.ratingRepository.create({
      assignment: { connect: { id: dto.assignmentId } },
      customer: { connect: { id: customerId } },
      deliveryPartner: { connect: { id: assignment.deliveryPartnerId } },
      rating: dto.rating,
      review: dto.review,
    });

    // Recalculate partner's average rating
    await this.recalculatePartnerRating(assignment.deliveryPartnerId);

    return rating;
  }

  private async recalculatePartnerRating(partnerId: string) {
    const stats = await this.ratingRepository.getPartnerStats(partnerId);
    const avg = stats._avg.rating ?? 0;
    const total = stats._count.id;
    await this.partnerRepository.updateRating(partnerId, Math.round(avg * 10) / 10, total);
  }
}
