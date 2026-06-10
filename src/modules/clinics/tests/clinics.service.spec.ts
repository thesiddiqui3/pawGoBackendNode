import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../../common/enums';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { ClinicRepository } from '../clinic.repository';
import { ClinicsService } from '../clinics.service';

const mockClinicRepository = () => ({
  create: jest.fn(),
  findMany: jest.fn(),
  findById: jest.fn(),
  findNearby: jest.fn(),
  update: jest.fn(),
  verify: jest.fn(),
  softDelete: jest.fn(),
  updateLogo: jest.fn(),
  updateBanner: jest.fn(),
  updateRating: jest.fn(),
  existsBySlug: jest.fn(),
});

const mockCloudinaryService = () => ({
  uploadBuffer: jest.fn(),
  deleteByPublicId: jest.fn(),
});

const makeClinic = (overrides = {}) => ({
  id: 'clinic-uuid',
  name: 'Paw Clinic',
  slug: 'paw-clinic',
  logoPublicId: null,
  bannerPublicId: null,
  deletedAt: null,
  workingHours: [],
  _count: { doctors: 0, reviews: 0 },
  ...overrides,
});

describe('ClinicsService', () => {
  let service: ClinicsService;
  let repo: ReturnType<typeof mockClinicRepository>;
  let cloudinary: ReturnType<typeof mockCloudinaryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: ClinicRepository, useFactory: mockClinicRepository },
        { provide: CloudinaryService, useFactory: mockCloudinaryService },
      ],
    }).compile();

    service = module.get(ClinicsService);
    repo = module.get(ClinicRepository) as unknown as ReturnType<typeof mockClinicRepository>;
    cloudinary = module.get(CloudinaryService) as unknown as ReturnType<typeof mockCloudinaryService>;
  });

  describe('create', () => {
    it('creates a clinic with a unique slug', async () => {
      repo.existsBySlug.mockResolvedValueOnce(false);
      const clinic = makeClinic();
      repo.create.mockResolvedValue(clinic);

      const result = await service.create(
        { name: 'Paw Clinic' } as any,
        'admin-id',
        'SUPER_ADMIN',
      );

      expect(repo.existsBySlug).toHaveBeenCalledWith('paw-clinic');
      expect(repo.create).toHaveBeenCalledWith(
        { name: 'Paw Clinic' },
        'paw-clinic',
        'admin-id',
      );
      expect(result).toEqual(clinic);
    });

    it('appends counter when slug already exists', async () => {
      repo.existsBySlug
        .mockResolvedValueOnce(true)   // 'paw-clinic' taken
        .mockResolvedValueOnce(false);  // 'paw-clinic-1' free
      repo.create.mockResolvedValue(makeClinic({ slug: 'paw-clinic-1' }));

      await service.create({ name: 'Paw Clinic' } as any, 'admin-id', 'SUPER_ADMIN');

      expect(repo.create).toHaveBeenCalledWith(
        expect.anything(),
        'paw-clinic-1',
        'admin-id',
      );
    });
  });

  describe('findOne', () => {
    it('returns an active clinic', async () => {
      const clinic = makeClinic();
      repo.findById.mockResolvedValue(clinic);

      await expect(service.findOne('clinic-uuid')).resolves.toEqual(clinic);
    });

    it('throws NotFoundException for missing clinic', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for soft-deleted clinic', async () => {
      repo.findById.mockResolvedValue(makeClinic({ deletedAt: new Date() }));
      await expect(service.findOne('clinic-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('allows admin to update', async () => {
      repo.findById.mockResolvedValue(makeClinic());
      repo.update.mockResolvedValue(makeClinic({ name: 'Updated' }));

      const result = await service.update('clinic-uuid', { name: 'Updated' } as any, 'admin-id', UserRole.SUPER_ADMIN);
      expect(result.name).toBe('Updated');
    });

    it('throws ForbiddenException for non-admin', async () => {
      repo.findById.mockResolvedValue(makeClinic());
      await expect(
        service.update('clinic-uuid', {} as any, 'user-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when clinic not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.update('bad-id', {} as any, 'admin-id', UserRole.SUPER_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verify', () => {
    it('allows SUPER_ADMIN to verify', async () => {
      repo.findById.mockResolvedValue(makeClinic());
      repo.verify.mockResolvedValue(makeClinic({ isVerified: true }));

      const result = await service.verify('clinic-uuid', 'admin-id', UserRole.SUPER_ADMIN);
      expect((result as any).isVerified).toBe(true);
    });

    it('throws ForbiddenException for non-admin', async () => {
      repo.findById.mockResolvedValue(makeClinic());
      await expect(
        service.verify('clinic-uuid', 'user-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('soft-deletes clinic and cleans Cloudinary assets', async () => {
      repo.findById.mockResolvedValue(
        makeClinic({ logoPublicId: 'logo/123', bannerPublicId: 'banner/456' }),
      );
      cloudinary.deleteByPublicId.mockResolvedValue(undefined);
      repo.softDelete.mockResolvedValue(undefined);

      await service.remove('clinic-uuid', 'admin-id', UserRole.SUPER_ADMIN);

      expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('logo/123');
      expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('banner/456');
      expect(repo.softDelete).toHaveBeenCalledWith('clinic-uuid', 'admin-id');
    });

    it('throws ForbiddenException for non-admin', async () => {
      repo.findById.mockResolvedValue(makeClinic());
      await expect(
        service.remove('clinic-uuid', 'user-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
