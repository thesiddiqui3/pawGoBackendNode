import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Used on the refresh-token endpoint — bypasses the standard JWT guard
// and delegates to the 'jwt-refresh' Passport strategy (registered in Phase 1)
@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {}
