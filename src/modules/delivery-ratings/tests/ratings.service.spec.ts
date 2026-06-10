import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryStatus } from '@prisma/client';
import { AssignmentRepository } from '../../delivery-assignments/assignment.repository';
import { DeliveryPartnerRepository } from '../../delivery-partners/delivery-partner.repository';
import { RatingRepository } from '../rating.repository';
import { RatingsService } from '../ratings.service';

const mockRatingRepo = () => ({
  create: jest.fn(),
  existsByAssignment: jest.fn(),
  getPartnerStats: jest.fn(),
});

const mockAssignmentRepo = () => ({
  findById: jest.fn(),
});

const mockPartnerRepo = () => ({
  findById: jest.fn(),
  updateRating: jest.fn(),
});

const makeAssignment = (overrides: Record<string, unknown> = {}) => ({
  id: 'assign-uuid',
  orderId: 'order-uuid',
  deliveryPartnerId: 'partner-uuid',
  status: DeliveryStatus.DELIVERED,
  order: { id: 'order-uuid', customerId: 'customer-id' },
  ...overrides,
});

describe('RatingsService', () => {
  let service: RatingsService;
  let ratingRepo: ReturnType<typeof mockRatingRepo>;
  let assignmentRepo: ReturnType<typeof mockAssignmentRepo>;
  let partnerRepo: ReturnType<typeof mockPartnerRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: RatingRepository, useFactory: mockRatingRepo },
        { provide: AssignmentRepository, useFactory: mockAssignmentRepo },
        { provide: DeliveryPartnerRepository, useFactory: mockPartnerRepo },
      ],
    }).compile();

    service = module.get(RatingsService);
    ratingRepo = module.get(RatingRepository) as unknown as ReturnType<typeof mockRatingRepo>;
    assignmentRepo = module.get(AssignmentRepository) as unknown as ReturnType<typeof mockAssignmentRepo>;
    partnerRepo = module.get(DeliveryPartnerRepository) as unknown as ReturnType<typeof mockPartnerRepo>;
  });

  const dto = { assignmentId: 'assign-uuid', rating: 5, review: 'Great delivery!' };

  it('creates a rating after a delivered assignment', async () => {
    assignmentRepo.findById.mockResolvedValue(makeAssignment());
    ratingRepo.existsByAssignment.mockResolvedValue(false);
    ratingRepo.create.mockResolvedValue({ id: 'rating-uuid', rating: 5, review: 'Great delivery!' });
    ratingRepo.getPartnerStats.mockResolvedValue({ _avg: { rating: 4.8 }, _count: { id: 11 } });
    partnerRepo.updateRating.mockResolvedValue({});

    const result = await service.create('customer-id', dto);
    expect((result as any).rating).toBe(5);
    expect(partnerRepo.updateRating).toHaveBeenCalledWith('partner-uuid', 4.8, 11);
  });

  it('throws NotFoundException when assignment not found', async () => {
    assignmentRepo.findById.mockResolvedValue(null);
    await expect(service.create('customer-id', dto)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when delivery not yet completed', async () => {
    assignmentRepo.findById.mockResolvedValue(makeAssignment({ status: DeliveryStatus.OUT_FOR_DELIVERY }));
    await expect(service.create('customer-id', dto)).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException when non-customer tries to rate', async () => {
    assignmentRepo.findById.mockResolvedValue(makeAssignment({ order: { id: 'order-uuid', customerId: 'real-customer' } }));
    await expect(service.create('intruder', dto)).rejects.toThrow(ForbiddenException);
  });

  it('throws ConflictException when already rated', async () => {
    assignmentRepo.findById.mockResolvedValue(makeAssignment());
    ratingRepo.existsByAssignment.mockResolvedValue(true);
    await expect(service.create('customer-id', dto)).rejects.toThrow(ConflictException);
  });
});
