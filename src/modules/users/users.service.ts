import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../../common/enums';
import { UpdateProfileDto } from './dto/update-profile.dto';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByEmailOrThrow(email: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user || user.deletedAt) throw new NotFoundException('User not found');
    return user;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { username } });
    return count > 0;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SafeUser> {
    if (dto.username) {
      const taken = await this.prisma.user.findFirst({
        where: { username: dto.username, id: { not: userId } },
      });
      if (taken) throw new ConflictException('Username is already taken');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
      },
    });

    return this.sanitize(user);
  }

  async updateAvatar(
    userId: string,
    avatarUrl: string,
    avatarPublicId: string,
  ): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl, avatarPublicId },
    });
    return this.sanitize(user);
  }

  async removeAvatar(userId: string): Promise<{ avatarPublicId: string | null }> {
    const user = await this.findByIdOrThrow(userId);
    const publicId = user.avatarPublicId;

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null, avatarPublicId: null },
    });

    return { avatarPublicId: publicId };
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true, status: 'ACTIVE' },
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async findOrCreateDoctorUser(params: {
    email: string;
    firstName: string;
    lastName?: string;
    phone?: string;
  }): Promise<User> {
    const existing = await this.findByEmail(params.email);
    if (existing) return existing;

    const tempPassword = crypto.randomBytes(12).toString('hex');
    const passwordHash = await bcryptjs.hash(tempPassword, 10);

    // Check phone uniqueness before attempting insert
    let safePhone: string | null = params.phone ?? null;
    if (safePhone) {
      const phoneInUse = await this.prisma.user.count({ where: { phone: safePhone } });
      if (phoneInUse > 0) safePhone = null;
    }

    return this.prisma.user.create({
      data: {
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName ?? '',
        phone: safePhone,
        passwordHash,
        role: UserRole.ASSISTANT,
        status: 'ACTIVE' as any,
        isEmailVerified: false,
        mustChangePassword: true,
      },
    });
  }

  sanitize(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
