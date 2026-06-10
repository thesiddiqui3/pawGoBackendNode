import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { EMAIL_SERVICE } from '../../../shared/email/email.interface';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';

// Mock the entire bcryptjs module so its exports are jest functions —
// this avoids the "Cannot redefine property" error that occurs when
// jest.spyOn tries to overwrite bcryptjs's non-configurable exports.
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('$2a$12$mockedHash'),
  genSalt: jest.fn().mockResolvedValue('$2a$12$salt'),
}));

import * as bcrypt from 'bcryptjs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-uuid-1',
  email: 'john@example.com',
  passwordHash: '$2a$12$hashedpassword',
  firstName: 'John',
  lastName: 'Doe',
  role: 'PET_OWNER',
  status: 'ACTIVE',
  isEmailVerified: true,
  deletedAt: null,
};

const mockPrisma = {
  user: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  passwordResetToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  emailVerification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((ops) => Promise.all(ops)),
};

const mockUsersService = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  findByIdOrThrow: jest.fn(),
  existsByEmail: jest.fn(),
  existsByUsername: jest.fn(),
  updateLastLogin: jest.fn(),
  updatePassword: jest.fn(),
  sanitize: jest.fn((u) => ({ ...u, passwordHash: undefined })),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.access.token'),
};

const mockConfigService = {
  get: jest.fn((key: string, def?: unknown) => {
    const cfg: Record<string, unknown> = {
      'jwt.accessSecret': 'test_access_secret',
      'jwt.refreshSecret': 'test_refresh_secret',
      'jwt.accessExpiresIn': '15m',
      'jwt.refreshExpiresIn': '7d',
      'app.frontendUrl': 'http://localhost:3001',
    };
    return cfg[key] ?? def;
  }),
  getOrThrow: jest.fn((key: string) => {
    const cfg: Record<string, unknown> = {
      'jwt.accessSecret': 'test_access_secret',
      'jwt.refreshSecret': 'test_refresh_secret',
    };
    if (!cfg[key]) throw new Error(`Config key not found: ${key}`);
    return cfg[key];
  }),
};

const mockEmailService = { send: jest.fn().mockResolvedValue(undefined) };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EMAIL_SERVICE, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ─── Register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'Password123!',
    };

    it('registers a new user successfully', async () => {
      mockUsersService.existsByEmail.mockResolvedValue(false);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, id: 'new-id' });
      mockPrisma.emailVerification.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerification.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(result.message).toContain('Registration successful');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      expect(mockEmailService.send).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException if email already exists', async () => {
      mockUsersService.existsByEmail.mockResolvedValue(true);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException if username already exists', async () => {
      mockUsersService.existsByEmail.mockResolvedValue(false);
      mockUsersService.existsByUsername.mockResolvedValue(true);

      await expect(service.register({ ...dto, username: 'taken' })).rejects.toThrow(ConflictException);
    });
  });

  // ─── Login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto = { email: 'john@example.com', password: 'Password123!' };

    it('returns tokens and user on valid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockUsersService.updateLastLogin.mockResolvedValue(undefined);

      const result = await service.login(dto);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toBeDefined();
    });

    it('throws UnauthorizedException for unknown email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for suspended account', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Logout ──────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the given refresh token', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('user-uuid-1', 'some-raw-refresh-token');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-uuid-1' }),
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('logoutAll', () => {
    it('revokes all refresh tokens for the user', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.logoutAll('user-uuid-1');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-uuid-1', revokedAt: null },
        }),
      );
    });
  });

  // ─── Forgot Password ──────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('sends reset email when user exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.forgotPassword('john@example.com');

      expect(result.message).toContain('reset link');
      expect(mockEmailService.send).toHaveBeenCalledTimes(1);
    });

    it('returns same message when user does NOT exist (no enumeration)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('unknown@example.com');

      expect(result.message).toContain('reset link');
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });
  });

  // ─── Change Password ──────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('changes password and revokes all tokens', async () => {
      mockUsersService.findByIdOrThrow.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUsersService.updatePassword.mockResolvedValue(undefined);
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.changePassword('user-uuid-1', 'OldPass123!', 'NewPass123!');

      expect(result.message).toContain('Password changed');
      expect(mockUsersService.updatePassword).toHaveBeenCalledTimes(1);
    });

    it('throws UnauthorizedException for incorrect current password', async () => {
      mockUsersService.findByIdOrThrow.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-uuid-1', 'WrongPass!', 'NewPass123!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Verify Email ─────────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('verifies email with valid token', async () => {
      mockPrisma.emailVerification.findUnique.mockResolvedValue({
        id: 'ver-1',
        userId: 'user-uuid-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60000),
      });
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.verifyEmail('valid-token');
      expect(result.message).toContain('verified');
    });

    it('throws UnauthorizedException for expired token', async () => {
      mockPrisma.emailVerification.findUnique.mockResolvedValue({
        id: 'ver-1',
        userId: 'user-uuid-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60000),
      });

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for already-used token', async () => {
      mockPrisma.emailVerification.findUnique.mockResolvedValue({
        id: 'ver-1',
        userId: 'user-uuid-1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(service.verifyEmail('used-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
