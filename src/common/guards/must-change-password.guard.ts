import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { JwtPayload } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../constants';

/**
 * Blocks any request from a user with mustChangePassword=true, except:
 *  - Public routes
 *  - PATCH /api/v1/auth/change-password
 */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: JwtPayload; path?: string; method?: string }>();
    const user = req.user;
    if (!user) return true; // JwtAuthGuard will handle unauthenticated separately

    // Allow change-password endpoint to pass through
    const path: string = req.path ?? '';
    if (path.includes('/auth/change-password')) return true;

    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { mustChangePassword: true } });
    if (dbUser?.mustChangePassword) {
      throw new ForbiddenException('You must change your password before continuing.');
    }

    return true;
  }
}
