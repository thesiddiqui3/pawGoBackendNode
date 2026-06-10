import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReminderStatus } from '../../../common/enums/medical.enum';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PrismaService } from '../../../database/prisma.service';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { PetRepository } from '../../pets/pet.repository';
import { VaccinationRepository } from '../vaccination.repository';
import { VaccinationsService } from '../vaccinations.service';

const mockVaccinationRepository = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findRaw: jest.fn(),
  findMany: jest.fn(),
  findByPet: jest.fn(),
  findUpcoming: jest.fn(),
  findLastVaccination: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createReminders: jest.fn(),
  findReminders: jest.fn(),
  updateReminderStatus: jest.fn(),
});

const mockPetRepository = () => ({
  findById: jest.fn(),
});

const mockCloudinaryService = () => ({
  uploadBuffer: jest.fn(),
  deleteByPublicId: jest.fn(),
});

const mockPrismaService = () => ({
  doctor: { findUnique: jest.fn() },
  pet: { findMany: jest.fn() },
  vaccinationReminder: {
    updateMany: jest.fn(),
  },
  vaccination: { findMany: jest.fn() },
});

const makePet = (overrides = {}) => ({
  id: 'pet-uuid',
  ownerId: 'owner-uuid',
  deletedAt: null,
  ...overrides,
});

const makeVaccination = (overrides = {}) => ({
  id: 'vax-uuid',
  petId: 'pet-uuid',
  vaccineName: 'Rabies',
  doctorId: 'doctor-uuid',
  clinicId: 'clinic-uuid',
  dateAdministered: new Date('2026-06-20'),
  nextDueDate: new Date('2027-06-20'),
  certificatePublicId: null,
  reminders: [],
  pet: { ownerId: 'owner-uuid' },
  doctor: {},
  clinic: {},
  ...overrides,
});

describe('VaccinationsService', () => {
  let service: VaccinationsService;
  let repo: ReturnType<typeof mockVaccinationRepository>;
  let petRepo: ReturnType<typeof mockPetRepository>;
  let cloudinary: ReturnType<typeof mockCloudinaryService>;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaccinationsService,
        { provide: VaccinationRepository, useFactory: mockVaccinationRepository },
        { provide: PetRepository, useFactory: mockPetRepository },
        { provide: CloudinaryService, useFactory: mockCloudinaryService },
        { provide: PrismaService, useFactory: mockPrismaService },
      ],
    }).compile();

    service = module.get(VaccinationsService);
    repo = module.get(VaccinationRepository) as unknown as ReturnType<typeof mockVaccinationRepository>;
    petRepo = module.get(PetRepository) as unknown as ReturnType<typeof mockPetRepository>;
    cloudinary = module.get(CloudinaryService) as unknown as ReturnType<typeof mockCloudinaryService>;
    prisma = module.get(PrismaService) as unknown as ReturnType<typeof mockPrismaService>;
  });

  describe('create', () => {
    const dto = {
      petId: 'pet-uuid',
      vaccineName: 'Rabies',
      dateAdministered: '2026-06-20',
      nextDueDate: '2027-06-20',
    };

    it('creates a vaccination and generates reminders', async () => {
      petRepo.findById.mockResolvedValue(makePet());
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });
      repo.create.mockResolvedValue(makeVaccination());
      repo.createReminders.mockResolvedValue(undefined);

      const result = await service.create(dto as any, 'doctor-user-uuid', UserRole.ASSISTANT);
      expect(result).toMatchObject({ id: 'vax-uuid' });
      expect(repo.createReminders).toHaveBeenCalled();
    });

    it('creates vaccination without reminders when no nextDueDate', async () => {
      petRepo.findById.mockResolvedValue(makePet());
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });
      repo.create.mockResolvedValue(makeVaccination({ nextDueDate: null }));

      await service.create({ ...dto, nextDueDate: undefined } as any, 'doctor-user-uuid', UserRole.ASSISTANT);
      expect(repo.createReminders).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when pet not found', async () => {
      petRepo.findById.mockResolvedValue(null);
      await expect(
        service.create(dto as any, 'doctor-user-uuid', UserRole.ASSISTANT),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows admin to create without a doctor profile', async () => {
      petRepo.findById.mockResolvedValue(makePet());
      repo.create.mockResolvedValue(makeVaccination());
      repo.createReminders.mockResolvedValue(undefined);

      const result = await service.create(dto as any, 'admin-uuid', UserRole.SUPER_ADMIN);
      expect(result).toBeDefined();
    });
  });

  describe('findUpcoming', () => {
    it('returns vaccinations due within N days', async () => {
      repo.findUpcoming.mockResolvedValue([makeVaccination()]);
      const result = await service.findUpcoming({ days: 30 } as any, 'admin-uuid', UserRole.SUPER_ADMIN);
      expect(result).toHaveLength(1);
      expect(repo.findUpcoming).toHaveBeenCalledWith(30, undefined);
    });

    it('scopes to pet for pet owner', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'owner-uuid' }));
      repo.findUpcoming.mockResolvedValue([makeVaccination()]);

      const result = await service.findUpcoming(
        { days: 30, petId: 'pet-uuid' } as any,
        'owner-uuid',
        UserRole.PET_OWNER,
      );
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException for pet owner accessing another user\'s pet', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'other-uuid' }));
      await expect(
        service.findUpcoming(
          { days: 30, petId: 'pet-uuid' } as any,
          'owner-uuid',
          UserRole.PET_OWNER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByPet', () => {
    it('returns vaccination timeline for a pet owner', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'owner-uuid' }));
      repo.findByPet.mockResolvedValue([makeVaccination()]);

      const result = await service.findByPet('pet-uuid', 'owner-uuid', UserRole.PET_OWNER);
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException if owner does not own pet', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'other-uuid' }));
      await expect(
        service.findByPet('pet-uuid', 'owner-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('allows doctor who administered to update', async () => {
      repo.findById.mockResolvedValue(makeVaccination({ doctorId: 'doctor-uuid' }));
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });
      repo.update.mockResolvedValue(makeVaccination({ notes: 'Updated' }));

      const result = await service.update('vax-uuid', { notes: 'Updated' }, 'doctor-user-uuid', UserRole.ASSISTANT);
      expect((result as any).notes).toBe('Updated');
    });

    it('throws ForbiddenException for a different doctor', async () => {
      repo.findById.mockResolvedValue(makeVaccination({ doctorId: 'other-doctor-uuid' }));
      prisma.doctor.findUnique.mockResolvedValue({ id: 'my-doctor-uuid' });

      await expect(
        service.update('vax-uuid', {}, 'my-user-uuid', UserRole.ASSISTANT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('regenerates reminders when nextDueDate is updated', async () => {
      repo.findById.mockResolvedValue(makeVaccination({ doctorId: 'doctor-uuid' }));
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });
      repo.update.mockResolvedValue(makeVaccination({ nextDueDate: new Date('2028-06-20') }));
      prisma.vaccinationReminder.updateMany.mockResolvedValue({ count: 2 });
      petRepo.findById.mockResolvedValue(makePet());
      repo.createReminders.mockResolvedValue(undefined);

      await service.update('vax-uuid', { nextDueDate: '2028-06-20' }, 'doctor-user-uuid', UserRole.ASSISTANT);
      expect(prisma.vaccinationReminder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ReminderStatus.CANCELLED } }),
      );
      expect(repo.createReminders).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes vaccination and cleans certificate', async () => {
      repo.findById.mockResolvedValue(makeVaccination({ certificatePublicId: 'cert/123' }));
      cloudinary.deleteByPublicId.mockResolvedValue(undefined);
      repo.delete.mockResolvedValue(undefined);

      await service.remove('vax-uuid', 'admin-uuid', UserRole.SUPER_ADMIN);
      expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('cert/123');
      expect(repo.delete).toHaveBeenCalledWith('vax-uuid');
    });

    it('throws ForbiddenException for pet owner', async () => {
      repo.findById.mockResolvedValue(makeVaccination());
      await expect(
        service.remove('vax-uuid', 'owner-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('uploadCertificate', () => {
    const mockFile = { buffer: Buffer.from('pdf'), mimetype: 'application/pdf' } as Express.Multer.File;

    it('uploads certificate to Cloudinary replacing old one', async () => {
      repo.findById.mockResolvedValue(makeVaccination({ doctorId: 'doctor-uuid', certificatePublicId: 'old/cert' }));
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });
      cloudinary.deleteByPublicId.mockResolvedValue(undefined);
      cloudinary.uploadBuffer.mockResolvedValue({ url: 'http://cert.url', publicId: 'new/cert' });
      repo.update.mockResolvedValue(makeVaccination({ certificateUrl: 'http://cert.url' }));

      await service.uploadCertificate('vax-uuid', mockFile, 'doctor-user-uuid', UserRole.ASSISTANT);
      expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('old/cert');
      expect(cloudinary.uploadBuffer).toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith('vax-uuid', expect.objectContaining({ certificateUrl: 'http://cert.url' }));
    });
  });

  describe('getPetVaccinationSummary', () => {
    it('returns lastVaccination and upcomingVaccinations', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'owner-uuid' }));
      repo.findLastVaccination.mockResolvedValue(makeVaccination());
      repo.findUpcoming.mockResolvedValue([makeVaccination()]);

      const result = await service.getPetVaccinationSummary('pet-uuid', 'owner-uuid', UserRole.PET_OWNER) as any;
      expect(result.lastVaccination).toBeDefined();
      expect(result.upcomingVaccinations).toHaveLength(1);
    });
  });
});
