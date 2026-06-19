import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../../common/enums/user-role.enum';
import { PrismaService } from '../../../database/prisma.service';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { PetRepository } from '../../pets/pet.repository';
import { MedicalRecordRepository } from '../medical-record.repository';
import { MedicalRecordsService } from '../medical-records.service';

const mockRecordRepository = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findRaw: jest.fn(),
  findMany: jest.fn(),
  findByPet: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addAttachment: jest.fn(),
  removeAttachment: jest.fn(),
  findAttachment: jest.fn(),
  findLastVisit: jest.fn(),
  findActiveTreatments: jest.fn(),
});

const mockPetRepository = () => ({
  findById: jest.fn(),
});

const mockCloudinaryService = () => ({
  uploadBuffer: jest.fn(),
  deleteByPublicId: jest.fn(),
});

const mockPrismaService = () => ({
  doctor: { findUnique: jest.fn(), findFirst: jest.fn() },
});

const makePet = (overrides = {}) => ({
  id: 'pet-uuid',
  ownerId: 'owner-uuid',
  deletedAt: null,
  ...overrides,
});

const makeRecord = (overrides = {}) => ({
  id: 'record-uuid',
  petId: 'pet-uuid',
  doctorId: 'doctor-uuid',
  clinicId: 'clinic-uuid',
  prescriptions: [],
  attachments: [],
  pet: {},
  doctor: { id: 'doctor-uuid' },
  clinic: {},
  appointment: null,
  ...overrides,
});

describe('MedicalRecordsService', () => {
  let service: MedicalRecordsService;
  let recordRepo: ReturnType<typeof mockRecordRepository>;
  let petRepo: ReturnType<typeof mockPetRepository>;
  let cloudinary: ReturnType<typeof mockCloudinaryService>;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalRecordsService,
        { provide: MedicalRecordRepository, useFactory: mockRecordRepository },
        { provide: PetRepository, useFactory: mockPetRepository },
        { provide: CloudinaryService, useFactory: mockCloudinaryService },
        { provide: PrismaService, useFactory: mockPrismaService },
      ],
    }).compile();

    service = module.get(MedicalRecordsService);
    recordRepo = module.get(MedicalRecordRepository) as unknown as ReturnType<typeof mockRecordRepository>;
    petRepo = module.get(PetRepository) as unknown as ReturnType<typeof mockPetRepository>;
    cloudinary = module.get(CloudinaryService) as unknown as ReturnType<typeof mockCloudinaryService>;
    prisma = module.get(PrismaService) as unknown as ReturnType<typeof mockPrismaService>;
  });

  describe('create', () => {
    const dto = {
      petId: 'pet-uuid',
      clinicId: 'clinic-uuid',
      visitDate: '2026-06-15',
      chiefComplaint: 'Loss of appetite',
      symptoms: ['vomiting'],
      diagnosis: ['stomach infection'],
    };

    it('creates a medical record for a doctor', async () => {
      petRepo.findById.mockResolvedValue(makePet());
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });
      recordRepo.create.mockResolvedValue(makeRecord());

      const result = await service.create(dto as any, 'doctor-user-uuid', UserRole.ASSISTANT);
      expect(result).toMatchObject({ id: 'record-uuid' });
      expect(recordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ chiefComplaint: 'Loss of appetite' }),
        [],
        expect.objectContaining({ petId: 'pet-uuid', clinicId: 'clinic-uuid' }),
      );
    });

    it('throws NotFoundException when pet not found', async () => {
      petRepo.findById.mockResolvedValue(null);
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });
      await expect(service.create(dto as any, 'doctor-user-uuid', UserRole.ASSISTANT)).rejects.toThrow(NotFoundException);
    });

    it('creates prescriptions when provided', async () => {
      petRepo.findById.mockResolvedValue(makePet());
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });
      recordRepo.create.mockResolvedValue(makeRecord());

      const dtoWithRx = {
        ...dto,
        prescriptions: [
          { medicineName: 'Amoxicillin', dosage: '250mg', frequency: 'Twice Daily', duration: '7 Days' },
        ],
      };

      await service.create(dtoWithRx as any, 'doctor-user-uuid', UserRole.ASSISTANT);
      expect(recordRepo.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([expect.objectContaining({ medicineName: 'Amoxicillin' })]),
        expect.objectContaining({ petId: 'pet-uuid', clinicId: 'clinic-uuid' }),
      );
    });
  });

  describe('findOne', () => {
    it('allows pet owner to view their pet\'s record', async () => {
      recordRepo.findById.mockResolvedValue(makeRecord());
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'owner-uuid' }));

      const result = await service.findOne('record-uuid', 'owner-uuid', UserRole.PET_OWNER);
      expect(result).toMatchObject({ id: 'record-uuid' });
    });

    it('throws ForbiddenException for non-owner pet owner', async () => {
      recordRepo.findById.mockResolvedValue(makeRecord());
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'other-uuid' }));

      await expect(
        service.findOne('record-uuid', 'owner-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows doctor to view any record', async () => {
      recordRepo.findById.mockResolvedValue(makeRecord());
      const result = await service.findOne('record-uuid', 'any-doctor-uuid', UserRole.ASSISTANT);
      expect(result).toBeDefined();
    });

    it('throws NotFoundException for missing record', async () => {
      recordRepo.findById.mockResolvedValue(null);
      await expect(
        service.findOne('bad-id', 'owner-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPetHistory', () => {
    it('returns chronological history for pet owner', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'owner-uuid' }));
      recordRepo.findByPet.mockResolvedValue([makeRecord()]);

      const result = await service.findPetHistory('pet-uuid', 'owner-uuid', UserRole.PET_OWNER);
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException if owner does not own pet', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'other-uuid' }));
      await expect(
        service.findPetHistory('pet-uuid', 'owner-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('allows the creating doctor to update their record', async () => {
      recordRepo.findById.mockResolvedValue(makeRecord({ doctorId: 'doctor-uuid' }));
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });
      recordRepo.update.mockResolvedValue(makeRecord({ notes: 'Updated' }));

      const result = await service.update(
        'record-uuid',
        { notes: 'Updated' },
        'doctor-user-uuid',
        UserRole.ASSISTANT,
      );
      expect((result as any).notes).toBe('Updated');
    });

    it('throws ForbiddenException for a doctor who did not create the record', async () => {
      recordRepo.findById.mockResolvedValue(makeRecord({ doctorId: 'other-doctor-uuid' }));
      prisma.doctor.findUnique.mockResolvedValue({ id: 'my-doctor-uuid' });

      await expect(
        service.update('record-uuid', { notes: 'X' }, 'my-doctor-user-uuid', UserRole.ASSISTANT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for pet owner trying to update', async () => {
      recordRepo.findById.mockResolvedValue(makeRecord());
      await expect(
        service.update('record-uuid', { notes: 'X' }, 'owner-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('deletes record and cleans Cloudinary attachments', async () => {
      recordRepo.findById.mockResolvedValue(
        makeRecord({ attachments: [{ publicId: 'att/123' }] }),
      );
      cloudinary.deleteByPublicId.mockResolvedValue(undefined);
      recordRepo.delete.mockResolvedValue(undefined);
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });

      await service.remove('record-uuid', 'admin-uuid', UserRole.SUPER_ADMIN);
      expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('att/123');
      expect(recordRepo.delete).toHaveBeenCalledWith('record-uuid');
    });

    it('throws ForbiddenException for pet owner', async () => {
      recordRepo.findById.mockResolvedValue(makeRecord());
      await expect(
        service.remove('record-uuid', 'owner-uuid', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('uploadAttachment', () => {
    const mockFile = {
      buffer: Buffer.from('data'),
      mimetype: 'image/png',
      originalname: 'report.png',
    } as Express.Multer.File;

    it('uploads attachment to Cloudinary and links to record', async () => {
      recordRepo.findById.mockResolvedValue(makeRecord({ doctorId: 'doctor-uuid' }));
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });
      cloudinary.uploadBuffer.mockResolvedValue({ url: 'http://img.url', publicId: 'att/new' });
      recordRepo.addAttachment.mockResolvedValue(makeRecord());

      const result = await service.uploadAttachment('record-uuid', mockFile, 'doctor-user-uuid', UserRole.ASSISTANT);
      expect(cloudinary.uploadBuffer).toHaveBeenCalled();
      expect(recordRepo.addAttachment).toHaveBeenCalledWith(
        'record-uuid',
        'http://img.url',
        'att/new',
        'PNG',
        'report.png',
      );
      expect(result).toBeDefined();
    });

    it('throws ForbiddenException for unsupported mime type', async () => {
      recordRepo.findById.mockResolvedValue(makeRecord({ doctorId: 'doctor-uuid' }));
      prisma.doctor.findUnique.mockResolvedValue({ id: 'doctor-uuid' });

      const badFile = { ...mockFile, mimetype: 'video/mp4' } as Express.Multer.File;
      await expect(
        service.uploadAttachment('record-uuid', badFile, 'doctor-user-uuid', UserRole.ASSISTANT),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getHealthSummary', () => {
    it('returns last visit and active treatments', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'owner-uuid' }));
      recordRepo.findLastVisit.mockResolvedValue(makeRecord());
      recordRepo.findActiveTreatments.mockResolvedValue([]);

      const result = await service.getHealthSummary('pet-uuid', 'owner-uuid', UserRole.PET_OWNER) as any;
      expect(result.lastVisit).toBeDefined();
      expect(result.activeTreatments).toEqual([]);
    });
  });
});
