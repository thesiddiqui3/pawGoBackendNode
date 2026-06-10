import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Get Current User ─────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const data = await this.usersService.findByIdOrThrow(user.sub);
    return ApiResponseDto.success(this.usersService.sanitize(data));
  }

  // ─── Update Profile ───────────────────────────────────────────────────────

  @Patch('me')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<ApiResponseDto<object>> {
    const updated = await this.usersService.updateProfile(user.sub, dto);
    return ApiResponseDto.success(updated, 'Profile updated');
  }

  // ─── Upload Avatar ────────────────────────────────────────────────────────

  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload or replace profile avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          cb(new Error('Only JPEG, PNG and WebP images are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    const currentUser = await this.usersService.findByIdOrThrow(user.sub);

    // Delete old avatar from Cloudinary if present
    if (currentUser.avatarPublicId) {
      await this.cloudinaryService.deleteByPublicId(currentUser.avatarPublicId);
    }

    const folder = this.configService.get<string>('cloudinary.avatarFolder', 'pawgo/avatars');
    const { url, publicId } = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      folder,
      `user_${user.sub}`,
      [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    );

    const updated = await this.usersService.updateAvatar(user.sub, url, publicId);
    return ApiResponseDto.success(updated, 'Avatar uploaded');
  }

  // ─── Delete Avatar ────────────────────────────────────────────────────────

  @Delete('avatar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove profile avatar' })
  async deleteAvatar(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<null>> {
    const { avatarPublicId } = await this.usersService.removeAvatar(user.sub);
    if (avatarPublicId) {
      await this.cloudinaryService.deleteByPublicId(avatarPublicId);
    }
    return ApiResponseDto.success(null, 'Avatar removed');
  }
}
