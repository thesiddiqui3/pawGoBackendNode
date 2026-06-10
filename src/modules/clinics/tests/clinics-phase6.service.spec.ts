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
  findByCreatedBy: jest.fn(),
  existsByCreatedBy: jest.fn(),
  existsBySlug: jest.fn(),
  update: jest.fn(),
  verify: jest.fn(),
  softDelete: jest.fn(),
  updateLogo: jest.fn(),
  updateBanner: jest.fn(),
  updateRating: jest.fn(),
  setActive: jest.fn(),
  findDoctors: jest.fn(),
});

const mockCloudinaryService = () => ({
  uploadBuffer: jest.fn(),
  deleteByPublicId: jest.fn(),
});

const makeClinic = (overrides: Record<string, unknown> = {}) => ({
  id: 'clinic-uuid',
  name: 'Paw Clinic',
  slug: 'paw-clinic',
  createdBy: 'owner-id',
  isActive: true,
  logoPublicId: null,
  bannerPublicId: null,
  deletedAt: null,
  workingHours: [],
  _count: { doctors: 0, reviews: 0 },
  ...overrides,
});

describe('ClinicsService — Phase 6 (CLINIC_OWNER features)', () => {
  let service: ClinicsService;
  let repo: ReturnType<typeof mockClinicRepository>;

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
  });

  // ─── create — one-per-owner enforcement ──────────────────────────────────

  describe('create (CLINIC_OWNER role)', () => {
    it('allows CLINIC_OWNER to create their first clinic', async () => {
      repo.existsBySlug.mockResolvedValue(false);
      repo.existsByCreatedBy.mockResolvedValue(false);
      repo.create.mockResolvedValue(makeClinic());

      const result = await service.create({ name: 'Paw Clinic' } as any, 'owner-id', UserRole.CLINIC_OWNER);
      expect(result).toMatchObject({ name: 'Paw Clinic' });
    });

    it('throws ConflictException when CLINIC_OWNER already has a clinic', async () => {
      repo.existsBySlug.mockResolvedValue(false);
      repo.existsByCreatedBy.mockResolvedValue(true);

      await expect(
        service.create({ name: 'Second Clinic' } as any, 'owner-id', UserRole.CLINIC_OWNER),
      ).rejects.toThrow(ConflictException);
    });

    it('does NOT enforce one-per-owner for ADMIN', async () => {
      repo.existsBySlug.mockResolvedValue(false);
      repo.existsByCreatedBy.mockResolvedValue(true); // even if owner has one
      repo.create.mockResolvedValue(makeClinic());

      // Admin should not hit the ConflictException — existsByCreatedBy should not be consulted
      await expect(
        service.create({ name: 'Admin Clinic' } as any, 'admin-id', UserRole.SUPER_ADMIN),
      ).resolves.toBeDefined();
    });
  });

  // ─── findMyClinic ─────────────────────────────────────────────────────────

  describe('findMyClinic', () => {
    it('returns the clinic owned by the requester', async () => {
      const clinic = makeClinic();
      repo.findByCreatedBy.mockResolvedValue(clinic);

      const result = await service.findMyClinic('owner-id');
      expect(result).toEqual(clinic);
      expect(repo.findByCreatedBy).toHaveBeenCalledWith('owner-id');
    });

    it('throws NotFoundException when owner has no clinic', async () => {
      repo.findByCreatedBy.mockResolvedValue(null);
      await expect(service.findMyClinic('owner-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update — owner can update their own clinic ───────────────────────────

  describe('update (CLINIC_OWNER)', () => {
    it('allows clinic owner to update their own clinic', async () => {
      repo.findById.mockResolvedValue(makeClinic({ createdBy: 'owner-id' }));
      repo.update.mockResolvedValue(makeClinic({ name: 'Updated' }));

      const result = await service.update('clinic-uuid', { name: 'Updated' } as any, 'owner-id', UserRole.CLINIC_OWNER);
      expect((result as any).name).toBe('Updated');
    });

    it('throws ForbiddenException when owner tries to update another clinic', async () => {
      repo.findById.mockResolvedValue(makeClinic({ createdBy: 'other-owner' }));

      await expect(
        service.update('clinic-uuid', {} as any, 'owner-id', UserRole.CLINIC_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── suspend / activate ───────────────────────────────────────────────────

  describe('suspend', () => {
    it('admin can suspend an active clinic', async () => {
      repo.findById.mockResolvedValue(makeClinic());
      repo.setActive.mockResolvedValue(makeClinic({ isActive: false }));

      const result = await service.suspend('clinic-uuid', 'admin-id', UserRole.SUPER_ADMIN);
      expect((result as any).isActive).toBe(false);
      expect(repo.setActive).toHaveBeenCalledWith('clinic-uuid', false, 'admin-id');
    });

    it('throws ForbiddenException when non-admin tries to suspend', async () => {
      repo.findById.mockResolvedValue(makeClinic());

      await expect(
        service.suspend('clinic-uuid', 'owner-id', UserRole.CLINIC_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when clinic not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.suspend('bad-id', 'admin-id', UserRole.SUPER_ADMIN)).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('admin can activate a suspended clinic', async () => {
      repo.findById.mockResolvedValue(makeClinic({ isActive: false }));
      repo.setActive.mockResolvedValue(makeClinic({ isActive: true }));

      const result = await service.activate('clinic-uuid', 'admin-id', UserRole.SUPER_ADMIN);
      expect((result as any).isActive).toBe(true);
      expect(repo.setActive).toHaveBeenCalledWith('clinic-uuid', true, 'admin-id');
    });

    it('throws ForbiddenException for non-admin', async () => {
      repo.findById.mockResolvedValue(makeClinic({ isActive: false }));
      await expect(
        service.activate('clinic-uuid', 'owner-id', UserRole.CLINIC_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── findClinicDoctors ────────────────────────────────────────────────────

  describe('findClinicDoctors', () => {
    it('returns doctors for the clinic', async () => {
      const doctors = [{ id: 'doc-1' }, { id: 'doc-2' }];
      repo.findById.mockResolvedValue(makeClinic());
      repo.findDoctors.mockResolvedValue(doctors);

      const result = await service.findClinicDoctors('clinic-uuid');
      expect(result).toEqual(doctors);
      expect(repo.findDoctors).toHaveBeenCalledWith('clinic-uuid');
    });

    it('throws NotFoundException when clinic not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findClinicDoctors('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
