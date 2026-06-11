import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const rawToken = authHeader.replace('Bearer ', '').trim();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Attach payload to request so the controller can read it via @CurrentUser()
    (req as any).user = {
      sub: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
      refreshToken: rawToken,
    };

    return true;
  }
}
