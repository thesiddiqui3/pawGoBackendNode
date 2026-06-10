import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { UploadGalleryImageDto } from './dto';
import { PetGalleryService } from './pet-gallery.service';

const UPLOAD_CONFIG = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, ok: boolean) => void) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'), false);
      return;
    }
    cb(null, true);
  },
};

@ApiTags('Pet Gallery')
@ApiBearerAuth('access-token')
@Controller({ version: '1' })
export class PetGalleryController {
  constructor(private readonly galleryService: PetGalleryService) {}

  // POST /pets/:petId/gallery
  @Post('pets/:petId/gallery')
  @Roles(UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload an image to the pet gallery (max 20 images)' })
  @ApiParam({ name: 'petId', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        caption: { type: 'string', maxLength: 200 },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', UPLOAD_CONFIG))
  async upload(
    @Param('petId', ParseUUIDPipe) petId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadGalleryImageDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    if (!file) throw new BadRequestException('Image file is required (JPEG, PNG or WebP)');
    const image = await this.galleryService.upload(petId, file, dto, user.sub, user.role);
    return ApiResponseDto.success(image, 'Image uploaded to gallery');
  }

  // GET /pets/:petId/gallery
  @Get('pets/:petId/gallery')
  @Roles(UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all gallery images for a pet' })
  @ApiParam({ name: 'petId', type: 'string', format: 'uuid' })
  async findByPet(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const images = await this.galleryService.findByPet(petId, user.sub, user.role);
    return ApiResponseDto.success(images);
  }

  // DELETE /gallery/:id
  @Delete('gallery/:id')
  @Roles(UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a gallery image' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.galleryService.remove(id, user.sub, user.role);
    return ApiResponseDto.success(null, 'Gallery image deleted');
  }
}
