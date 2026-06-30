import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { EMAIL_SERVICE, IEmailService } from '../../shared/email/email.interface';
import { emailTemplates } from '../../shared/email/email-templates';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

const BCRYPT_ROUNDS = 12;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const emailExists = await this.usersService.existsByEmail(dto.email);
    if (emailExists) throw new ConflictException('Email is already registered');

    if (dto.username) {
      const usernameExists = await this.usersService.existsByUsername(dto.username);
      if (usernameExists) throw new ConflictException('Username is already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: dto.role ?? 'PET_OWNER',
      },
    });

    await this.sendEmailVerification(user.id, user.email, user.firstName);

    this.logger.log(`New user registered: ${user.email}`);
    return { message: 'Registration successful. Please verify your email.' };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string; mustChangePassword: boolean; user: object }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.logger.warn(`Failed login attempt for: ${dto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account has been suspended');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('EMAIL_NOT_VERIFIED');
    }

    const tokens = await this.generateAndStoreTokens(
      { sub: user.id, email: user.email, role: user.role },
      userAgent,
      ipAddress,
    );

    await this.usersService.updateLastLogin(user.id);
    this.logger.log(`User logged in: ${user.email}`);

    return {
      ...tokens,
      mustChangePassword: user.mustChangePassword,
      user: this.usersService.sanitize(user),
    };
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────

  async refreshTokens(
    userId: string,
    rawRefreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (
      !stored ||
      stored.userId !== userId ||
      stored.revokedAt ||
      stored.expiresAt < new Date()
    ) {
      // Potential token reuse — revoke all tokens for this user
      await this.revokeAllTokens(userId);
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.usersService.findByIdOrThrow(userId);
    return this.generateAndStoreTokens(
      { sub: user.id, email: user.email, role: user.role },
      userAgent,
      ipAddress,
    );
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(userId: string, rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllTokens(userId);
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    // Always return success to avoid email enumeration
    if (!user) return { message: 'If that email exists, a reset link has been sent.' };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Invalidate previous reset tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.passwordResetToken.create({
      data: { tokenHash, userId: user.id, expiresAt },
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl', 'http://localhost:3001');
    await this.emailService.send({
      to: user.email,
      subject: 'Reset your PawGo password',
      html: emailTemplates.forgotPassword(user.firstName, rawToken, frontendUrl),
    });

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(rawToken);

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Reset token is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.emailService.send({
      to: record.user.email,
      subject: 'Your PawGo password has been changed',
      html: emailTemplates.passwordChanged(record.user.firstName),
    });

    return { message: 'Password reset successfully. Please log in again.' };
  }

  // ─── Change Password ──────────────────────────────────────────────────────

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByIdOrThrow(userId);
    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersService.updatePassword(userId, passwordHash);
    // Clear the force-change flag set when admin provisions the account
    await this.prisma.user.update({ where: { id: userId }, data: { mustChangePassword: false } });
    await this.revokeAllTokens(userId);

    return { message: 'Password changed successfully. Please log in again.' };
  }

  // ─── Email Verification ───────────────────────────────────────────────────

  async sendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return { message: 'If that email exists, a verification link has been sent.' };
    if (user.isEmailVerified) return { message: 'Email is already verified.' };

    await this.sendEmailVerification(user.id, user.email, user.firstName);
    return { message: 'Verification email sent.' };
  }

  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(rawToken);

    const record = await this.prisma.emailVerification.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Verification token is invalid or expired');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { isEmailVerified: true, status: 'ACTIVE' },
      }),
    ]);

    return { message: 'Email verified successfully.' };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async generateAndStoreTokens(
    payload: JwtPayload,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m'),
    });

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');
    const expiresAt = new Date(Date.now() + this.parseDuration(refreshExpiresIn));

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: payload.sub,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private async revokeAllTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async sendEmailVerification(
    userId: string,
    email: string,
    firstName: string,
  ): Promise<void> {
    // Invalidate previous verification tokens
    await this.prisma.emailVerification.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.prisma.emailVerification.create({
      data: { tokenHash, userId, expiresAt },
    });

    const frontendUrl = this.configService.get<string>('app.frontendUrl', 'http://localhost:3001');
    await this.emailService.send({
      to: email,
      subject: 'Verify your PawGo email',
      html: emailTemplates.verifyEmail(firstName, rawToken, frontendUrl),
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseDuration(duration: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    return parseInt(match[1], 10) * (units[match[2]] ?? 1000);
  }
}
