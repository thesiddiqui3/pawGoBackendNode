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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { ClinicsService } from './clinics.service';
import { ClinicQueryDto, CreateClinicDto, NearbyClinicDto, UpdateClinicDto } from './dto';

const UPLOAD_CONFIG = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, accept: boolean) => void) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG and WebP are allowed'), false);
      return;
    }
    cb(null, true);
  },
};

const FILE_BODY_SCHEMA = {
  schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
};

@ApiTags('Clinics')
@Controller({ path: 'clinics', version: '1' })
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  @Post()
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Create a new clinic (admin or clinic owner — one per owner)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateClinicDto,
  ): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsService.create(dto, user.sub, user.role);
    return ApiResponseDto.success(clinic, 'Clinic created successfully');
  }

  // ─── My clinic (clinic owner) ─────────────────────────────────────────────

  @Get('my')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Get my clinic (clinic owner)' })
  async findMyClinic(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsService.findMyClinic(user.sub);
    return ApiResponseDto.success(clinic);
  }

  // ─── List (public) ────────────────────────────────────────────────────────

  @Public()
  @Get()
  @ApiOperation({ summary: 'List clinics with filtering and pagination' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'service', required: false })
  @ApiQuery({ name: 'verified', required: false, type: Boolean })
  async findMany(@Query() query: ClinicQueryDto, @CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    const data = await this.clinicsService.findMany(query, user?.role);
    return ApiResponseDto.success(data);
  }

  // ─── Nearby (public) ──────────────────────────────────────────────────────

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Find clinics near a coordinate (Haversine, sorted by distance)' })
  @ApiQuery({ name: 'lat', required: true, example: 28.6139 })
  @ApiQuery({ name: 'lng', required: true, example: 77.209 })
  @ApiQuery({ name: 'radius', required: false, description: 'Radius in km (default 10)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default 20)' })
  async findNearby(@Query() dto: NearbyClinicDto): Promise<ApiResponseDto<object>> {
    const data = await this.clinicsService.findNearby(dto);
    return ApiResponseDto.success(data);
  }

  // ─── Detail (public) ──────────────────────────────────────────────────────

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get clinic details including doctors and review count' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsService.findOne(id);
    return ApiResponseDto.success(clinic);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Update clinic details (admin or the clinic owner)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateClinicDto,
  ): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsService.update(id, dto, user.sub, user.role);
    return ApiResponseDto.success(clinic, 'Clinic updated');
  }

  // ─── Verify ───────────────────────────────────────────────────────────────

  @Patch(':id/verify')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a clinic (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsService.verify(id, user.sub, user.role);
    return ApiResponseDto.success(clinic, 'Clinic verified');
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a clinic (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.clinicsService.remove(id, user.sub, user.role);
    return ApiResponseDto.success(null, 'Clinic deleted');
  }

  // ─── Suspend ──────────────────────────────────────────────────────────────

  @Patch(':id/suspend')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a clinic — sets isActive: false (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsService.suspend(id, user.sub, user.role);
    return ApiResponseDto.success(clinic, 'Clinic suspended');
  }

  // ─── Activate ─────────────────────────────────────────────────────────────

  @Patch(':id/activate')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a suspended clinic — sets isActive: true (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsService.activate(id, user.sub, user.role);
    return ApiResponseDto.success(clinic, 'Clinic activated');
  }

  // ─── Clinic doctors (public) ──────────────────────────────────────────────

  @Public()
  @Get(':id/doctors')
  @ApiOperation({ summary: 'List active doctors at a specific clinic (public)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findClinicDoctors(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<object>> {
    const doctors = await this.clinicsService.findClinicDoctors(id);
    return ApiResponseDto.success(doctors);
  }

  // ─── Upload Logo ──────────────────────────────────────────────────────────

  @Post(':id/logo')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CLINIC_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload clinic logo (admin or clinic owner)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY_SCHEMA)
  @UseInterceptors(FileInterceptor('file', UPLOAD_CONFIG))
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsService.uploadLogo(id, file, user.sub, user.role);
    return ApiResponseDto.success(clinic, 'Logo uploaded');
  }

  // ─── Upload Banner ────────────────────────────────────────────────────────

  @Post(':id/banner')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CLINIC_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload clinic banner (admin or clinic owner)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY_SCHEMA)
  @UseInterceptors(FileInterceptor('file', UPLOAD_CONFIG))
  async uploadBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    const clinic = await this.clinicsService.uploadBanner(id, file, user.sub, user.role);
    return ApiResponseDto.success(clinic, 'Banner uploaded');
  }
}
