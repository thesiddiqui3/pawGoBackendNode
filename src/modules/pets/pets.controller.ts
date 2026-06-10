import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CreatePetDto, PetQueryDto, UpdatePetDto } from './dto';
import { PetsService } from './pets.service';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('Pets')
@ApiBearerAuth('access-token')
@Controller({ path: 'pets', version: '1' })
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  // ─── Create Pet ───────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new pet' })
  @ApiResponse({ status: 201, description: 'Pet created successfully' })
  @ApiResponse({ status: 409, description: 'Microchip number already registered' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePetDto,
  ): Promise<ApiResponseDto<object>> {
    const pet = await this.petsService.create(user.sub, dto);
    return ApiResponseDto.success(pet, 'Pet created successfully');
  }

  // ─── Get My Pets ──────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Get all pets for the current user',
    description: 'Supports pagination (?page=1&limit=10), filtering (?species=DOG&gender=MALE), and search (?search=bruno)',
  })
  async getMyPets(
    @CurrentUser() user: JwtPayload,
    @Query() query: PetQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.petsService.findMyPets(user.sub, query);
    return ApiResponseDto.success(data);
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard')
  @Roles(UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Pet owner dashboard statistics',
    description: 'Returns total pets, breakdown by species, upcoming vaccinations (next 30 days), and total medical records.',
  })
  async getDashboard(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const data = await this.petsService.getDashboard(user.sub);
    return ApiResponseDto.success(data);
  }

  // ─── Get Pet Details ──────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a single pet (owner or admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const pet = await this.petsService.findOne(id, user.sub, user.role);
    return ApiResponseDto.success(pet);
  }

  // ─── Update Pet ───────────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update pet details (owner or admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePetDto,
  ): Promise<ApiResponseDto<object>> {
    const pet = await this.petsService.update(id, dto, user.sub, user.role);
    return ApiResponseDto.success(pet, 'Pet updated successfully');
  }

  // ─── Delete Pet ───────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a pet (owner or admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.petsService.remove(id, user.sub, user.role);
    return ApiResponseDto.success(null, 'Pet deleted successfully');
  }

  // ─── Upload Pet Photo ─────────────────────────────────────────────────────

  @Post(':id/photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload or replace pet photo (owner or admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or too large' })
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
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    const pet = await this.petsService.uploadPhoto(id, file, user.sub, user.role);
    return ApiResponseDto.success(pet, 'Photo uploaded successfully');
  }

  // ─── Delete Pet Photo ─────────────────────────────────────────────────────

  @Delete(':id/photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove pet photo (owner or admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const pet = await this.petsService.removePhoto(id, user.sub, user.role);
    return ApiResponseDto.success(pet, 'Photo removed successfully');
  }
}
