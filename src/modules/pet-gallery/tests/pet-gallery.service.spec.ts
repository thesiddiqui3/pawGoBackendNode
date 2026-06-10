import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../../common/enums';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { PetRepository } from '../../pets/pet.repository';
import { PetGalleryRepository } from '../pet-gallery.repository';
import { PetGalleryService } from '../pet-gallery.service';

const mockGalleryRepo = () => ({
  create: jest.fn(),
  findByPet: jest.fn(),
  findById: jest.fn(),
  delete: jest.fn(),
  countByPet: jest.fn(),
});

const mockPetRepo = () => ({
  findById: jest.fn(),
});

const mockCloudinary = () => ({
  uploadBuffer: jest.fn(),
  deleteByPublicId: jest.fn(),
});

const makePet = (overrides: Record<string, unknown> = {}) => ({
  id: 'pet-uuid',
  ownerId: 'owner-id',
  deletedAt: null,
  ...overrides,
});

const makeImage = (overrides: Record<string, unknown> = {}) => ({
  id: 'img-uuid',
  petId: 'pet-uuid',
  imageUrl: 'https://cloudinary.com/img.jpg',
  publicId: 'pawgo/pets/gallery/img',
  caption: null,
  uploadedBy: 'owner-id',
  uploadedAt: new Date(),
  ...overrides,
});

const makeFile = (): Express.Multer.File => ({
  buffer: Buffer.from('fake-image'),
  mimetype: 'image/jpeg',
  originalname: 'photo.jpg',
  fieldname: 'file',
  encoding: '7bit',
  size: 1000,
  stream: null as any,
  destination: '',
  filename: '',
  path: '',
});

describe('PetGalleryService', () => {
  let service: PetGalleryService;
  let galleryRepo: ReturnType<typeof mockGalleryRepo>;
  let petRepo: ReturnType<typeof mockPetRepo>;
  let cloudinary: ReturnType<typeof mockCloudinary>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetGalleryService,
        { provide: PetGalleryRepository, useFactory: mockGalleryRepo },
        { provide: PetRepository, useFactory: mockPetRepo },
        { provide: CloudinaryService, useFactory: mockCloudinary },
      ],
    }).compile();

    service = module.get(PetGalleryService);
    galleryRepo = module.get(PetGalleryRepository) as unknown as ReturnType<typeof mockGalleryRepo>;
    petRepo = module.get(PetRepository) as unknown as ReturnType<typeof mockPetRepo>;
    cloudinary = module.get(CloudinaryService) as unknown as ReturnType<typeof mockCloudinary>;
  });

  // ─── upload ───────────────────────────────────────────────────────────────

  describe('upload', () => {
    it('uploads an image to the gallery', async () => {
      petRepo.findById.mockResolvedValue(makePet());
      galleryRepo.countByPet.mockResolvedValue(3);
      cloudinary.uploadBuffer.mockResolvedValue({ url: 'https://cdn.com/img.jpg', publicId: 'pub/123' });
      const image = makeImage();
      galleryRepo.create.mockResolvedValue(image);

      const result = await service.upload('pet-uuid', makeFile(), {}, 'owner-id', UserRole.PET_OWNER);
      expect(result).toEqual(image);
      expect(cloudinary.uploadBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        'pawgo/pets/gallery',
        expect.stringContaining('pet_pet-uuid'),
      );
    });

    it('throws BadRequestException when gallery is at the 20-image limit', async () => {
      petRepo.findById.mockResolvedValue(makePet());
      galleryRepo.countByPet.mockResolvedValue(20);

      await expect(
        service.upload('pet-uuid', makeFile(), {}, 'owner-id', UserRole.PET_OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when pet does not exist', async () => {
      petRepo.findById.mockResolvedValue(null);
      await expect(
        service.upload('bad-id', makeFile(), {}, 'owner-id', UserRole.PET_OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for soft-deleted pet', async () => {
      petRepo.findById.mockResolvedValue(makePet({ deletedAt: new Date() }));
      await expect(
        service.upload('pet-uuid', makeFile(), {}, 'owner-id', UserRole.PET_OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-owner tries to upload', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'other-owner' }));
      galleryRepo.countByPet.mockResolvedValue(0);

      await expect(
        service.upload('pet-uuid', makeFile(), {}, 'intruder-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to upload to any pet gallery', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'other-owner' }));
      galleryRepo.countByPet.mockResolvedValue(0);
      cloudinary.uploadBuffer.mockResolvedValue({ url: 'https://cdn.com/img.jpg', publicId: 'pub/123' });
      galleryRepo.create.mockResolvedValue(makeImage());

      await expect(
        service.upload('pet-uuid', makeFile(), {}, 'admin-id', UserRole.SUPER_ADMIN),
      ).resolves.toBeDefined();
    });
  });

  // ─── findByPet ────────────────────────────────────────────────────────────

  describe('findByPet', () => {
    it('returns gallery images for owner', async () => {
      const images = [makeImage(), makeImage({ id: 'img-2' })];
      petRepo.findById.mockResolvedValue(makePet());
      galleryRepo.findByPet.mockResolvedValue(images);

      const result = await service.findByPet('pet-uuid', 'owner-id', UserRole.PET_OWNER);
      expect(result).toEqual(images);
    });

    it('throws ForbiddenException for non-owner', async () => {
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'other-owner' }));

      await expect(
        service.findByPet('pet-uuid', 'intruder-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes gallery image and removes from Cloudinary', async () => {
      galleryRepo.findById.mockResolvedValue(makeImage());
      petRepo.findById.mockResolvedValue(makePet());
      cloudinary.deleteByPublicId.mockResolvedValue(undefined);
      galleryRepo.delete.mockResolvedValue(undefined);

      await service.remove('img-uuid', 'owner-id', UserRole.PET_OWNER);

      expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('pawgo/pets/gallery/img');
      expect(galleryRepo.delete).toHaveBeenCalledWith('img-uuid');
    });

    it('throws NotFoundException when image does not exist', async () => {
      galleryRepo.findById.mockResolvedValue(null);
      await expect(
        service.remove('bad-id', 'owner-id', UserRole.PET_OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-owner tries to delete', async () => {
      galleryRepo.findById.mockResolvedValue(makeImage());
      petRepo.findById.mockResolvedValue(makePet({ ownerId: 'real-owner' }));

      await expect(
        service.remove('img-uuid', 'intruder-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
