import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { UsersService } from '../users.service';

const mockUser = {
  id: 'user-uuid-1',
  email: 'john@example.com',
  passwordHash: 'hashed',
  firstName: 'John',
  lastName: 'Doe',
  username: 'johndoe',
  role: 'PET_OWNER',
  status: 'ACTIVE',
  isEmailVerified: true,
  deletedAt: null,
  phone: null,
  gender: null,
  avatarUrl: null,
  avatarPublicId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  isPhoneVerified: false,
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findByIdOrThrow', () => {
    it('returns user when found and not deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findByIdOrThrow('user-uuid-1');
      expect(result.id).toBe('user-uuid-1');
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findByIdOrThrow('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user is soft-deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, deletedAt: new Date() });
      await expect(service.findByIdOrThrow('user-uuid-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates profile successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, firstName: 'Jane' });

      const result = await service.updateProfile('user-uuid-1', { firstName: 'Jane' });

      expect(result.firstName).toBe('Jane');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws ConflictException when username is taken by another user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'other-user' });

      await expect(
        service.updateProfile('user-uuid-1', { username: 'takenname' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('sanitize', () => {
    it('removes passwordHash from user object', () => {
      const safe = service.sanitize(mockUser as never);
      expect(safe).not.toHaveProperty('passwordHash');
      expect(safe.email).toBe(mockUser.email);
    });
  });
});
