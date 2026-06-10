import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../../common/enums';
import { ReviewTargetType } from '../../../common/enums/clinic.enum';
import { ClinicRepository } from '../../clinics/clinic.repository';
import { DoctorRepository } from '../../doctors/doctor.repository';
import { ReviewRepository } from '../review.repository';
import { ReviewsService } from '../reviews.service';

const mockReviewRepository = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByUserAndTarget: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  aggregateRating: jest.fn(),
});

const mockClinicRepository = () => ({
  findById: jest.fn(),
  updateRating: jest.fn(),
});

const mockDoctorRepository = () => ({
  findById: jest.fn(),
  updateRating: jest.fn(),
});

const makeReview = (overrides = {}) => ({
  id: 'review-uuid',
  userId: 'user-uuid',
  targetType: ReviewTargetType.CLINIC,
  targetId: 'clinic-uuid',
  rating: 4,
  comment: 'Great clinic',
  ...overrides,
});

const makeAgg = (avgRating: number | null, count: number) => ({
  _avg: { rating: avgRating },
  _count: { rating: count },
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewRepo: ReturnType<typeof mockReviewRepository>;
  let clinicRepo: ReturnType<typeof mockClinicRepository>;
  let doctorRepo: ReturnType<typeof mockDoctorRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: ReviewRepository, useFactory: mockReviewRepository },
        { provide: ClinicRepository, useFactory: mockClinicRepository },
        { provide: DoctorRepository, useFactory: mockDoctorRepository },
      ],
    }).compile();

    service = module.get(ReviewsService);
    reviewRepo = module.get(ReviewRepository) as unknown as ReturnType<typeof mockReviewRepository>;
    clinicRepo = module.get(ClinicRepository) as unknown as ReturnType<typeof mockClinicRepository>;
    doctorRepo = module.get(DoctorRepository) as unknown as ReturnType<typeof mockDoctorRepository>;
  });

  describe('create', () => {
    it('creates a clinic review and propagates rating', async () => {
      clinicRepo.findById.mockResolvedValue({ id: 'clinic-uuid', deletedAt: null });
      reviewRepo.findByUserAndTarget.mockResolvedValue(null);
      reviewRepo.create.mockResolvedValue(makeReview());
      reviewRepo.aggregateRating.mockResolvedValue(makeAgg(4.0, 1));
      clinicRepo.updateRating.mockResolvedValue(undefined);

      const result = await service.create('user-uuid', {
        targetType: ReviewTargetType.CLINIC,
        targetId: 'clinic-uuid',
        rating: 4,
      } as any);

      expect(result).toMatchObject({ id: 'review-uuid' });
      expect(clinicRepo.updateRating).toHaveBeenCalledWith('clinic-uuid', 4, 1);
    });

    it('throws ConflictException when review already exists', async () => {
      clinicRepo.findById.mockResolvedValue({ id: 'clinic-uuid', deletedAt: null });
      reviewRepo.findByUserAndTarget.mockResolvedValue(makeReview());

      await expect(
        service.create('user-uuid', {
          targetType: ReviewTargetType.CLINIC,
          targetId: 'clinic-uuid',
          rating: 4,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when clinic target not found', async () => {
      clinicRepo.findById.mockResolvedValue(null);

      await expect(
        service.create('user-uuid', {
          targetType: ReviewTargetType.CLINIC,
          targetId: 'bad-id',
          rating: 4,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a doctor review and propagates rating to doctor', async () => {
      doctorRepo.findById.mockResolvedValue({ id: 'doc-uuid', isActive: true });
      reviewRepo.findByUserAndTarget.mockResolvedValue(null);
      reviewRepo.create.mockResolvedValue(makeReview({ targetType: ReviewTargetType.ASSISTANT, targetId: 'doc-uuid' }));
      reviewRepo.aggregateRating.mockResolvedValue(makeAgg(5.0, 2));
      doctorRepo.updateRating.mockResolvedValue(undefined);

      await service.create('user-uuid', {
        targetType: ReviewTargetType.ASSISTANT,
        targetId: 'doc-uuid',
        rating: 5,
      } as any);

      expect(doctorRepo.updateRating).toHaveBeenCalledWith('doc-uuid', 5, 2);
    });
  });

  describe('update', () => {
    it('allows owner to update review and propagates rating', async () => {
      const review = makeReview();
      reviewRepo.findById.mockResolvedValue(review);
      reviewRepo.update.mockResolvedValue({ ...review, rating: 3 });
      reviewRepo.aggregateRating.mockResolvedValue(makeAgg(3.0, 1));
      clinicRepo.updateRating.mockResolvedValue(undefined);

      const result = await service.update('review-uuid', { rating: 3 } as any, 'user-uuid', UserRole.PET_OWNER);
      expect((result as any).rating).toBe(3);
      expect(clinicRepo.updateRating).toHaveBeenCalledWith('clinic-uuid', 3, 1);
    });

    it('allows admin to update any review', async () => {
      reviewRepo.findById.mockResolvedValue(makeReview({ userId: 'owner-id' }));
      reviewRepo.update.mockResolvedValue(makeReview({ rating: 2 }));
      reviewRepo.aggregateRating.mockResolvedValue(makeAgg(2.0, 1));
      clinicRepo.updateRating.mockResolvedValue(undefined);

      await expect(
        service.update('review-uuid', { rating: 2 } as any, 'admin-id', UserRole.SUPER_ADMIN),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException for non-owner', async () => {
      reviewRepo.findById.mockResolvedValue(makeReview({ userId: 'owner-id' }));
      await expect(
        service.update('review-uuid', {} as any, 'other-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when review not found', async () => {
      reviewRepo.findById.mockResolvedValue(null);
      await expect(
        service.update('bad-id', {} as any, 'user-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('allows owner to delete review and recalculates rating', async () => {
      reviewRepo.findById.mockResolvedValue(makeReview());
      reviewRepo.delete.mockResolvedValue(undefined);
      reviewRepo.aggregateRating.mockResolvedValue(makeAgg(null, 0));
      clinicRepo.updateRating.mockResolvedValue(undefined);

      await service.remove('review-uuid', 'user-uuid', UserRole.PET_OWNER);

      expect(reviewRepo.delete).toHaveBeenCalledWith('review-uuid');
      expect(clinicRepo.updateRating).toHaveBeenCalledWith('clinic-uuid', 0, 0);
    });

    it('throws ForbiddenException for non-owner non-admin', async () => {
      reviewRepo.findById.mockResolvedValue(makeReview({ userId: 'owner-id' }));
      await expect(
        service.remove('review-uuid', 'other-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sets rating to 0 when last review is deleted', async () => {
      reviewRepo.findById.mockResolvedValue(makeReview());
      reviewRepo.delete.mockResolvedValue(undefined);
      reviewRepo.aggregateRating.mockResolvedValue(makeAgg(null, 0));
      clinicRepo.updateRating.mockResolvedValue(undefined);

      await service.remove('review-uuid', 'user-uuid', UserRole.PET_OWNER);

      expect(clinicRepo.updateRating).toHaveBeenCalledWith('clinic-uuid', 0, 0);
    });
  });
});
