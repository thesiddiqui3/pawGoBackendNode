import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PetGender, PetSpecies } from '../../../common/enums/pet.enum';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { PetRepository } from '../pet.repository';
import { PetsService } from '../pets.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER_ID = 'owner-uuid-1';
const ADMIN_ID = 'admin-uuid-1';
const OTHER_ID = 'other-uuid-1';
const PET_ID = 'pet-uuid-1';

const mockPet = {
  id: PET_ID,
  ownerId: OWNER_ID,
  name: 'Bruno',
  species: PetSpecies.DOG,
  breed: 'Labrador',
  gender: PetGender.MALE,
  dateOfBirth: new Date('2024-05-01'),
  weight: 12.5,
  color: 'Golden',
  microchipNumber: null,
  notes: null,
  photoUrl: null,
  photoPublicId: null,
  isActive: true,
  createdBy: OWNER_ID,
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockPetWithOwner = {
  ...mockPet,
  owner: { id: OWNER_ID, firstName: 'John', lastName: 'Doe', email: 'john@test.com', avatarUrl: null },
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndOwner: jest.fn(),
  findManyByOwner: jest.fn(),
  update: jest.fn(),
  updatePhoto: jest.fn(),
  removePhoto: jest.fn(),
  softDelete: jest.fn(),
  existsByMicrochip: jest.fn(),
};

const mockCloudinary = {
  uploadBuffer: jest.fn(),
  deleteByPublicId: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('pawgo/pets'),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('PetsService', () => {
  let service: PetsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetsService,
        { provide: PetRepository, useValue: mockRepository },
        { provide: CloudinaryService, useValue: mockCloudinary },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PetsService>(PetsService);
    jest.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      name: 'Bruno',
      species: PetSpecies.DOG,
      breed: 'Labrador',
      gender: PetGender.MALE,
    };

    it('creates a pet successfully', async () => {
      mockRepository.existsByMicrochip.mockResolvedValue(false);
      mockRepository.create.mockResolvedValue(mockPet);

      const result = await service.create(OWNER_ID, dto);

      expect(result.id).toBe(PET_ID);
      expect(mockRepository.create).toHaveBeenCalledWith(OWNER_ID, dto, OWNER_ID);
    });

    it('throws ConflictException for duplicate microchip', async () => {
      mockRepository.existsByMicrochip.mockResolvedValue(true);

      await expect(
        service.create(OWNER_ID, { ...dto, microchipNumber: '123456' }),
      ).rejects.toThrow(ConflictException);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns pet for its owner', async () => {
      mockRepository.findById.mockResolvedValue(mockPetWithOwner);

      const result = await service.findOne(PET_ID, OWNER_ID, 'PET_OWNER');

      expect(result.id).toBe(PET_ID);
    });

    it('returns pet for an admin regardless of ownership', async () => {
      mockRepository.findById.mockResolvedValue(mockPetWithOwner);

      const result = await service.findOne(PET_ID, ADMIN_ID, 'SUPER_ADMIN');

      expect(result.id).toBe(PET_ID);
    });

    it('throws ForbiddenException for non-owner non-admin', async () => {
      mockRepository.findById.mockResolvedValue(mockPetWithOwner);

      await expect(service.findOne(PET_ID, OTHER_ID, 'PET_OWNER')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when pet does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.findOne(PET_ID, OWNER_ID, 'PET_OWNER')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for soft-deleted pet', async () => {
      mockRepository.findById.mockResolvedValue({ ...mockPetWithOwner, deletedAt: new Date() });

      await expect(service.findOne(PET_ID, OWNER_ID, 'PET_OWNER')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('allows owner to update their pet', async () => {
      mockRepository.findById.mockResolvedValue(mockPetWithOwner);
      mockRepository.existsByMicrochip.mockResolvedValue(false);
      mockRepository.update.mockResolvedValue({ ...mockPet, name: 'Buddy' });

      const result = await service.update(PET_ID, { name: 'Buddy' }, OWNER_ID, 'PET_OWNER');

      expect(result.name).toBe('Buddy');
    });

    it('allows admin to update any pet', async () => {
      mockRepository.findById.mockResolvedValue(mockPetWithOwner);
      mockRepository.update.mockResolvedValue(mockPet);

      await expect(
        service.update(PET_ID, { name: 'Buddy' }, ADMIN_ID, 'SUPER_ADMIN'),
      ).resolves.toBeDefined();
    });

    it('blocks non-owner from updating', async () => {
      mockRepository.findById.mockResolvedValue(mockPetWithOwner);

      await expect(
        service.update(PET_ID, { name: 'Buddy' }, OTHER_ID, 'PET_OWNER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when new microchip is already taken', async () => {
      mockRepository.findById.mockResolvedValue(mockPetWithOwner);
      mockRepository.existsByMicrochip.mockResolvedValue(true);

      await expect(
        service.update(PET_ID, { microchipNumber: 'taken' }, OWNER_ID, 'PET_OWNER'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes pet for owner', async () => {
      mockRepository.findById.mockResolvedValue(mockPetWithOwner);
      mockRepository.softDelete.mockResolvedValue({ ...mockPet, deletedAt: new Date() });

      await expect(service.remove(PET_ID, OWNER_ID, 'PET_OWNER')).resolves.toBeUndefined();
      expect(mockRepository.softDelete).toHaveBeenCalledWith(PET_ID, OWNER_ID);
    });

    it('deletes Cloudinary photo on pet deletion', async () => {
      const petWithPhoto = { ...mockPetWithOwner, photoPublicId: 'pawgo/pets/pet_1' };
      mockRepository.findById.mockResolvedValue(petWithPhoto);
      mockRepository.softDelete.mockResolvedValue({});

      await service.remove(PET_ID, OWNER_ID, 'PET_OWNER');

      expect(mockCloudinary.deleteByPublicId).toHaveBeenCalledWith('pawgo/pets/pet_1');
    });

    it('blocks non-owner from deleting', async () => {
      mockRepository.findById.mockResolvedValue(mockPetWithOwner);

      await expect(service.remove(PET_ID, OTHER_ID, 'PET_OWNER')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── uploadPhoto ──────────────────────────────────────────────────────────

  describe('uploadPhoto', () => {
    const mockFile = {
      buffer: Buffer.from('fake-image'),
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
    } as Express.Multer.File;

    it('uploads photo and replaces old one', async () => {
      const petWithOldPhoto = { ...mockPetWithOwner, photoPublicId: 'old-public-id' };
      mockRepository.findById.mockResolvedValue(petWithOldPhoto);
      mockCloudinary.deleteByPublicId.mockResolvedValue(undefined);
      mockCloudinary.uploadBuffer.mockResolvedValue({
        url: 'https://res.cloudinary.com/test/new.jpg',
        publicId: 'pawgo/pets/pet_1',
      });
      mockRepository.updatePhoto.mockResolvedValue({
        ...mockPet,
        photoUrl: 'https://res.cloudinary.com/test/new.jpg',
      });

      const result = await service.uploadPhoto(PET_ID, mockFile, OWNER_ID, 'PET_OWNER');

      expect(mockCloudinary.deleteByPublicId).toHaveBeenCalledWith('old-public-id');
      expect(result.photoUrl).toBe('https://res.cloudinary.com/test/new.jpg');
    });

    it('blocks non-owner from uploading photo', async () => {
      mockRepository.findById.mockResolvedValue(mockPetWithOwner);

      await expect(
        service.uploadPhoto(PET_ID, mockFile, OTHER_ID, 'PET_OWNER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
