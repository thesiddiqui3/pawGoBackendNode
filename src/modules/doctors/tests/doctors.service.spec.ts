import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../../common/enums';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { ClinicRepository } from '../../clinics/clinic.repository';
import { UsersService } from '../../users/users.service';
import { DoctorRepository } from '../doctor.repository';
import { DoctorsService } from '../doctors.service';

const mockDoctorRepository = () => ({
  create: jest.fn(),
  findMany: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  verify: jest.fn(),
  updatePhoto: jest.fn(),
  updateRating: jest.fn(),
  existsByUserId: jest.fn(),
});

const mockUsersService = () => ({
  findByIdOrThrow: jest.fn(),
});

const mockCloudinaryService = () => ({
  uploadBuffer: jest.fn(),
  deleteByPublicId: jest.fn(),
});

const makeDoctor = (overrides = {}) => ({
  id: 'doc-uuid',
  userId: 'user-uuid',
  isActive: true,
  isVerified: false,
  photoPublicId: null,
  ...overrides,
});

const makeUser = (role = UserRole.ASSISTANT) => ({
  id: 'user-uuid',
  role,
  deletedAt: null,
});

describe('DoctorsService', () => {
  let service: DoctorsService;
  let repo: ReturnType<typeof mockDoctorRepository>;
  let usersService: ReturnType<typeof mockUsersService>;
  let cloudinary: ReturnType<typeof mockCloudinaryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DoctorsService,
        { provide: DoctorRepository, useFactory: mockDoctorRepository },
        { provide: UsersService, useFactory: mockUsersService },
        { provide: CloudinaryService, useFactory: mockCloudinaryService },
        { provide: ClinicRepository, useValue: { findByCreatedBy: jest.fn() } },
      ],
    }).compile();

    service = module.get(DoctorsService);
    repo = module.get(DoctorRepository) as unknown as ReturnType<typeof mockDoctorRepository>;
    usersService = module.get(UsersService) as unknown as ReturnType<typeof mockUsersService>;
    cloudinary = module.get(CloudinaryService) as unknown as ReturnType<typeof mockCloudinaryService>;
  });

  describe('create', () => {
    it('allows a DOCTOR user to create own profile', async () => {
      usersService.findByIdOrThrow.mockResolvedValue(makeUser(UserRole.ASSISTANT));
      repo.existsByUserId.mockResolvedValue(false);
      repo.create.mockResolvedValue(makeDoctor());

      const result = await service.create(
        { userId: 'user-uuid' } as any,
        'user-uuid',
        UserRole.ASSISTANT,
      );
      expect(result).toMatchObject({ id: 'doc-uuid' });
    });

    it('throws ForbiddenException when non-admin creates profile for another user', async () => {
      await expect(
        service.create({ userId: 'other-user' } as any, 'user-uuid', UserRole.ASSISTANT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when profile already exists', async () => {
      usersService.findByIdOrThrow.mockResolvedValue(makeUser(UserRole.ASSISTANT));
      repo.existsByUserId.mockResolvedValue(true);

      await expect(
        service.create({ userId: 'user-uuid' } as any, 'user-uuid', UserRole.ASSISTANT),
      ).rejects.toThrow(ConflictException);
    });

    it('allows ADMIN to create profile for any user', async () => {
      usersService.findByIdOrThrow.mockResolvedValue(makeUser(UserRole.PET_OWNER));
      repo.existsByUserId.mockResolvedValue(false);
      repo.create.mockResolvedValue(makeDoctor({ userId: 'other-user' }));

      await expect(
        service.create({ userId: 'other-user' } as any, 'admin-id', UserRole.SUPER_ADMIN),
      ).resolves.toBeDefined();
    });
  });

  describe('findOne', () => {
    it('returns an active doctor', async () => {
      repo.findById.mockResolvedValue(makeDoctor());
      await expect(service.findOne('doc-uuid')).resolves.toMatchObject({ id: 'doc-uuid' });
    });

    it('throws NotFoundException for missing doctor', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for inactive doctor', async () => {
      repo.findById.mockResolvedValue(makeDoctor({ isActive: false }));
      await expect(service.findOne('doc-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('allows owner to update their profile', async () => {
      repo.findById.mockResolvedValue(makeDoctor({ userId: 'user-uuid' }));
      repo.update.mockResolvedValue(makeDoctor({ bio: 'updated' }));

      const result = await service.update('doc-uuid', { bio: 'updated' } as any, 'user-uuid', UserRole.ASSISTANT);
      expect((result as any).bio).toBe('updated');
    });

    it('throws ForbiddenException for non-owner non-admin', async () => {
      repo.findById.mockResolvedValue(makeDoctor({ userId: 'owner-id' }));
      await expect(
        service.update('doc-uuid', {} as any, 'other-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verify', () => {
    it('allows admin to verify a doctor', async () => {
      repo.findById.mockResolvedValue(makeDoctor());
      repo.verify.mockResolvedValue(makeDoctor({ isVerified: true }));

      const result = await service.verify('doc-uuid', UserRole.SUPER_ADMIN);
      expect((result as any).isVerified).toBe(true);
    });

    it('throws ForbiddenException for non-admin', async () => {
      await expect(service.verify('doc-uuid', UserRole.PET_OWNER)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when doctor not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.verify('bad-id', UserRole.SUPER_ADMIN)).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadPhoto', () => {
    const mockFile = { buffer: Buffer.from('img') } as Express.Multer.File;

    it('uploads photo and removes old one', async () => {
      repo.findById.mockResolvedValue(makeDoctor({ userId: 'user-uuid', photoPublicId: 'old/id' }));
      cloudinary.deleteByPublicId.mockResolvedValue(undefined);
      cloudinary.uploadBuffer.mockResolvedValue({ url: 'http://photo.url', publicId: 'new/id' });
      repo.updatePhoto.mockResolvedValue(makeDoctor());

      await service.uploadPhoto('doc-uuid', mockFile, 'user-uuid', UserRole.ASSISTANT);

      expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('old/id');
      expect(cloudinary.uploadBuffer).toHaveBeenCalled();
      expect(repo.updatePhoto).toHaveBeenCalledWith('doc-uuid', 'http://photo.url', 'new/id');
    });

    it('throws ForbiddenException for non-owner non-admin', async () => {
      repo.findById.mockResolvedValue(makeDoctor({ userId: 'owner-id' }));
      await expect(
        service.uploadPhoto('doc-uuid', mockFile, 'other-id', UserRole.PET_OWNER),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
