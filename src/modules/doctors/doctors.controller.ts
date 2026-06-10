import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { DayOfWeek } from '../../common/enums/clinic.enum';
import { CreateDoctorDto, DoctorQueryDto, UpdateDoctorDto, UpsertAvailabilityDto } from './dto';
import { DoctorsService } from './doctors.service';

const UPLOAD_CONFIG = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (err: Error | null, a: boolean) => void) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG and WebP are allowed'), false);
      return;
    }
    cb(null, true);
  },
};

@ApiTags('Doctors')
@Controller({ path: 'doctors', version: '1' })
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN, UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Create a doctor profile (doctor creates own, clinic owner/admin creates for their clinic)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDoctorDto,
  ): Promise<ApiResponseDto<object>> {
    const doctor = await this.doctorsService.create(dto, user.sub, user.role);
    return ApiResponseDto.success(doctor, 'Doctor profile created');
  }

  // GET /doctors/my-clinic — clinic owner sees their clinic's doctors (before /:id)
  @Get('my-clinic')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "List all doctors at the clinic owner's clinic" })
  async findMyClinicDoctors(
    @CurrentUser() user: JwtPayload,
    @Query() query: DoctorQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.doctorsService.findMyClinicDoctors(user.sub, query);
    return ApiResponseDto.success(data);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search and list doctors' })
  async findMany(@Query() query: DoctorQueryDto): Promise<ApiResponseDto<object>> {
    const data = await this.doctorsService.findMany(query);
    return ApiResponseDto.success(data);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get doctor profile details' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    const doctor = await this.doctorsService.findOne(id);
    return ApiResponseDto.success(doctor);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN, UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Update doctor profile (doctor owner, clinic owner, or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDoctorDto,
  ): Promise<ApiResponseDto<object>> {
    const doctor = await this.doctorsService.update(id, dto, user.sub, user.role);
    return ApiResponseDto.success(doctor, 'Doctor profile updated');
  }

  @Patch(':id/verify')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a doctor profile (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const doctor = await this.doctorsService.verify(id, user.role);
    return ApiResponseDto.success(doctor, 'Doctor verified');
  }

  @Post(':id/photo')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload doctor profile photo (owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', UPLOAD_CONFIG))
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    const doctor = await this.doctorsService.uploadPhoto(id, file, user.sub, user.role);
    return ApiResponseDto.success(doctor, 'Photo uploaded');
  }

  // ─── Deactivate (clinic owner removes doctor from their clinic) ────────────

  @Patch(':id/deactivate')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a doctor (clinic owner for own clinic, or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const doctor = await this.doctorsService.deactivateByClinicOwner(id, user.sub, user.role);
    return ApiResponseDto.success(doctor, 'Doctor deactivated');
  }

  // ─── Availability management ──────────────────────────────────────────────

  @Public()
  @Get(':id/availability')
  @ApiOperation({ summary: "Get a doctor's availability schedule (public)" })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.doctorsService.getAvailability(id);
    return ApiResponseDto.success(data);
  }

  @Put(':id/availability/:day')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ASSISTANT, UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Upsert availability for a specific day (doctor, clinic owner, or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'day', enum: DayOfWeek })
  async upsertAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('day', new ParseEnumPipe(DayOfWeek)) day: DayOfWeek,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertAvailabilityDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.doctorsService.upsertAvailability(id, day, dto, user.sub, user.role);
    return ApiResponseDto.success(data, `Availability set for ${day}`);
  }

  @Delete(':id/availability/:day')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ASSISTANT, UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove availability for a specific day' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'day', enum: DayOfWeek })
  async deleteAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('day', new ParseEnumPipe(DayOfWeek)) day: DayOfWeek,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.doctorsService.deleteAvailability(id, day, user.sub, user.role);
    return ApiResponseDto.success(null, `Availability removed for ${day}`);
  }
}
