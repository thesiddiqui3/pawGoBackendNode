import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../../common/enums';
import { DayOfWeek } from '../../../common/enums/clinic.enum';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { ClinicRepository } from '../../clinics/clinic.repository';
import { UsersService } from '../../users/users.service';
import { DoctorRepository } from '../doctor.repository';
import { DoctorsService } from '../doctors.service';

const mockDoctorRepository = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  updatePhoto: jest.fn(),
  verify: jest.fn(),
  updateRating: jest.fn(),
  existsByUserId: jest.fn(),
  findByClinic: jest.fn(),
  deactivate: jest.fn(),
  upsertAvailability: jest.fn(),
  deleteAvailability: jest.fn(),
  getAvailability: jest.fn(),
});

const mockClinicRepository = () => ({
  findByCreatedBy: jest.fn(),
});

const mockUsersService = () => ({ findByIdOrThrow: jest.fn() });
const mockCloudinaryService = () => ({ uploadBuffer: jest.fn(), deleteByPublicId: jest.fn() });

const makeDoctor = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-uuid',
  userId: 'user-uuid',
  clinicId: 'clinic-uuid',
  isActive: true,
  photoPublicId: null,
  ...overrides,
});

const makeClinic = (overrides: Record<string, unknown> = {}) => ({
  id: 'clinic-uuid',
  createdBy: 'owner-id',
  ...overrides,
});

describe('DoctorsService — Phase 6', () => {
  let service: DoctorsService;
  let doctorRepo: ReturnType<typeof mockDoctorRepository>;
  let clinicRepo: ReturnType<typeof mockClinicRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorsService,
        { provide: DoctorRepository, useFactory: mockDoctorRepository },
        { provide: ClinicRepository, useFactory: mockClinicRepository },
        { provide: UsersService, useFactory: mockUsersService },
        { provide: CloudinaryService, useFactory: mockCloudinaryService },
      ],
    }).compile();

    service = module.get(DoctorsService);
    doctorRepo = module.get(DoctorRepository) as unknown as ReturnType<typeof mockDoctorRepository>;
    clinicRepo = module.get(ClinicRepository) as unknown as ReturnType<typeof mockClinicRepository>;
  });

  // ─── deactivateByClinicOwner ───────────────────────────────────────────────

  describe('deactivateByClinicOwner', () => {
    it('admin can deactivate any doctor', async () => {
      doctorRepo.findById.mockResolvedValue(makeDoctor({ clinicId: 'other-clinic' }));
      doctorRepo.deactivate.mockResolvedValue(makeDoctor({ isActive: false }));

      const result = await service.deactivateByClinicOwner('doc-uuid', 'admin-id', UserRole.SUPER_ADMIN);
      expect((result as any).isActive).toBe(false);
    });

    it('clinic owner can deactivate a doctor at their own clinic', async () => {
      doctorRepo.findById.mockResolvedValue(makeDoctor({ clinicId: 'clinic-uuid' }));
      clinicRepo.findByCreatedBy.mockResolvedValue(makeClinic());
      doctorRepo.deactivate.mockResolvedValue(makeDoctor({ isActive: false }));

      const result = await service.deactivateByClinicOwner('doc-uuid', 'owner-id', UserRole.CLINIC_OWNER);
      expect((result as any).isActive).toBe(false);
    });

    it('throws ForbiddenException when clinic owner tries to deactivate doctor at another clinic', async () => {
      doctorRepo.findById.mockResolvedValue(makeDoctor({ clinicId: 'other-clinic' }));
      clinicRepo.findByCreatedBy.mockResolvedValue(makeClinic({ id: 'clinic-uuid' }));

      await expect(
        service.deactivateByClinicOwner('doc-uuid', 'owner-id', UserRole.CLINIC_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when doctor not found', async () => {
      doctorRepo.findById.mockResolvedValue(null);
      await expect(
        service.deactivateByClinicOwner('bad-id', 'admin-id', UserRole.SUPER_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when doctor already inactive', async () => {
      doctorRepo.findById.mockResolvedValue(makeDoctor({ isActive: false }));
      await expect(
        service.deactivateByClinicOwner('doc-uuid', 'admin-id', UserRole.SUPER_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getAvailability ──────────────────────────────────────────────────────

  describe('getAvailability', () => {
    it('returns availability schedule for an existing doctor', async () => {
      const schedule = [{ day: DayOfWeek.MONDAY, startTime: '09:00', endTime: '17:00' }];
      doctorRepo.findById.mockResolvedValue(makeDoctor());
      doctorRepo.getAvailability.mockResolvedValue(schedule);

      const result = await service.getAvailability('doc-uuid');
      expect(result).toEqual(schedule);
    });

    it('throws NotFoundException for missing doctor', async () => {
      doctorRepo.findById.mockResolvedValue(null);
      await expect(service.getAvailability('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── upsertAvailability ───────────────────────────────────────────────────

  describe('upsertAvailability', () => {
    const dto = { startTime: '09:00', endTime: '17:00' };

    it('allows doctor owner to upsert their own availability', async () => {
      const doc = makeDoctor({ userId: 'user-uuid' });
      const slotResult = { ...dto, day: DayOfWeek.MONDAY };
      doctorRepo.findById.mockResolvedValue(doc);
      doctorRepo.upsertAvailability.mockResolvedValue(slotResult);

      const result = await service.upsertAvailability('doc-uuid', DayOfWeek.MONDAY, dto, 'user-uuid', UserRole.ASSISTANT);
      expect(result).toEqual(slotResult);
    });

    it('allows admin to upsert any doctor availability', async () => {
      doctorRepo.findById.mockResolvedValue(makeDoctor({ userId: 'user-uuid' }));
      doctorRepo.upsertAvailability.mockResolvedValue({});

      await expect(
        service.upsertAvailability('doc-uuid', DayOfWeek.TUESDAY, dto, 'admin-id', UserRole.SUPER_ADMIN),
      ).resolves.toBeDefined();
    });

    it('throws ForbiddenException when another doctor tries to upsert', async () => {
      doctorRepo.findById.mockResolvedValue(makeDoctor({ userId: 'user-uuid' }));

      await expect(
        service.upsertAvailability('doc-uuid', DayOfWeek.MONDAY, dto, 'other-user', UserRole.ASSISTANT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── deleteAvailability ───────────────────────────────────────────────────

  describe('deleteAvailability', () => {
    it('allows doctor to delete their own availability slot', async () => {
      doctorRepo.findById.mockResolvedValue(makeDoctor({ userId: 'user-uuid' }));
      doctorRepo.deleteAvailability.mockResolvedValue(undefined);

      await expect(
        service.deleteAvailability('doc-uuid', DayOfWeek.WEDNESDAY, 'user-uuid', UserRole.ASSISTANT),
      ).resolves.toBeUndefined();
      expect(doctorRepo.deleteAvailability).toHaveBeenCalledWith('doc-uuid', DayOfWeek.WEDNESDAY);
    });

    it('throws ForbiddenException for non-owner non-admin', async () => {
      doctorRepo.findById.mockResolvedValue(makeDoctor({ userId: 'user-uuid' }));

      await expect(
        service.deleteAvailability('doc-uuid', DayOfWeek.MONDAY, 'random-user', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── findMyClinicDoctors ──────────────────────────────────────────────────

  describe('findMyClinicDoctors', () => {
    it('returns paginated doctors for the clinic owner', async () => {
      clinicRepo.findByCreatedBy.mockResolvedValue(makeClinic());
      const paginated = { items: [makeDoctor()], total: 1, page: 1, limit: 20, totalPages: 1 };
      doctorRepo.findMany.mockResolvedValue(paginated);

      const result = await service.findMyClinicDoctors('owner-id', {} as any);
      expect(result).toEqual(paginated);
      expect(doctorRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ clinicId: 'clinic-uuid' }));
    });

    it('throws NotFoundException when owner has no clinic', async () => {
      clinicRepo.findByCreatedBy.mockResolvedValue(null);
      await expect(service.findMyClinicDoctors('owner-id', {} as any)).rejects.toThrow(NotFoundException);
    });
  });
});
