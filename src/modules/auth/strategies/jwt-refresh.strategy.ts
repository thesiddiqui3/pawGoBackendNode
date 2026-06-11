import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';

export interface RefreshJwtPayload extends JwtPayload {
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async validate(req: Request): Promise<RefreshJwtPayload> {
    const authHeader = req.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const rawToken = authHeader.replace('Bearer ', '').trim();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return {
      sub: stored.user.id,
      email: stored.user.email,
      role: stored.user.role as any,
      refreshToken: rawToken,
    };
  }
}
