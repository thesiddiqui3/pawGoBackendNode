import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { RefreshTokenGuard } from '../../common/guards/refresh-token.guard';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SendVerificationDto,
  VerifyEmailDto,
} from './dto';
import { RefreshJwtPayload } from './strategies/jwt-refresh.strategy';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 409, description: 'Email or username already taken' })
  async register(@Body() dto: RegisterDto): Promise<ApiResponseDto<null>> {
    const result = await this.authService.register(dto);
    return ApiResponseDto.success(null, result.message);
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful — returns access + refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.authService.login(
      dto,
      req.get('user-agent'),
      req.ip,
    );
    return ApiResponseDto.success(data, 'Login successful');
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────

  @UseGuards(RefreshTokenGuard)
  @Post('refresh-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshTokenGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Rotate refresh token and get new token pair' })
  async refreshToken(
    @CurrentUser() user: RefreshJwtPayload,
    @Req() req: Request,
  ): Promise<ApiResponseDto<object>> {
    const tokens = await this.authService.refreshTokens(
      user.sub,
      user.refreshToken,
      req.get('user-agent'),
      req.ip,
    );
    return ApiResponseDto.success(tokens, 'Tokens refreshed');
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout from current device' })
  async logout(@CurrentUser() user: RefreshJwtPayload): Promise<ApiResponseDto<null>> {
    await this.authService.logout(user.sub, user.refreshToken);
    return ApiResponseDto.success(null, 'Logged out successfully');
  }

  // ─── Logout All ───────────────────────────────────────────────────────────

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<null>> {
    await this.authService.logoutAll(user.sub);
    return ApiResponseDto.success(null, 'Logged out from all devices');
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ApiResponseDto<null>> {
    const result = await this.authService.forgotPassword(dto.email);
    return ApiResponseDto.success(null, result.message);
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using email token' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<ApiResponseDto<null>> {
    const result = await this.authService.resetPassword(dto.token, dto.newPassword);
    return ApiResponseDto.success(null, result.message);
  }

  // ─── Change Password ──────────────────────────────────────────────────────

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change password (requires current password)' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiResponseDto<null>> {
    const result = await this.authService.changePassword(
      user.sub,
      dto.oldPassword,
      dto.newPassword,
    );
    return ApiResponseDto.success(null, result.message);
  }

  // ─── Send Email Verification ──────────────────────────────────────────────

  @Public()
  @Post('send-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send or resend email verification link' })
  async sendVerification(@Body() dto: SendVerificationDto): Promise<ApiResponseDto<null>> {
    const result = await this.authService.sendVerificationEmail(dto.email);
    return ApiResponseDto.success(null, result.message);
  }

  // ─── Verify Email ─────────────────────────────────────────────────────────

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token from email link' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<ApiResponseDto<null>> {
    const result = await this.authService.verifyEmail(dto.token);
    return ApiResponseDto.success(null, result.message);
  }
}
