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
import { UserRole } from '../../common/enums/user-role.enum';
import { VaccinationsService } from '../vaccinations/vaccinations.service';
import {
  CreateMedicalRecordDto,
  MedicalRecordQueryDto,
  UpdateMedicalRecordDto,
} from './dto';
import { MedicalRecordsService } from './medical-records.service';

const ATTACHMENT_INTERCEPTOR = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

@ApiTags('Medical Records')
@ApiBearerAuth('access-token')
@Controller({ path: 'medical-records', version: '1' })
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  // POST /medical-records
  @Post()
  @Roles(UserRole.ASSISTANT, UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a medical record (doctor, clinic staff, or admin)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMedicalRecordDto,
  ): Promise<ApiResponseDto<object>> {
    const record = await this.medicalRecordsService.create(dto, user.sub, user.role);
    return ApiResponseDto.success(record, 'Medical record created');
  }

  // GET /medical-records
  @Get()
  @Roles(UserRole.ASSISTANT, UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List medical records (doctor → own, clinic staff → clinic-scoped, admin → all)' })
  async findMany(
    @CurrentUser() user: JwtPayload,
    @Query() query: MedicalRecordQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.medicalRecordsService.findMany(query, user.sub, user.role);
    return ApiResponseDto.success(data);
  }

  // GET /medical-records/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get a medical record (owner, doctor, or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const record = await this.medicalRecordsService.findOne(id, user.sub, user.role);
    return ApiResponseDto.success(record);
  }

  // PATCH /medical-records/:id
  @Patch(':id')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a medical record (doctor owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateMedicalRecordDto,
  ): Promise<ApiResponseDto<object>> {
    const record = await this.medicalRecordsService.update(id, dto, user.sub, user.role);
    return ApiResponseDto.success(record, 'Medical record updated');
  }

  // DELETE /medical-records/:id
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a medical record (admin only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.medicalRecordsService.remove(id, user.sub, user.role);
    return ApiResponseDto.success(null, 'Medical record deleted');
  }

  // POST /medical-records/:id/attachments
  @Post(':id/attachments')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @UseInterceptors(ATTACHMENT_INTERCEPTOR)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an attachment to a medical record (PDF/image, max 10 MB)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async uploadAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    const record = await this.medicalRecordsService.uploadAttachment(id, file, user.sub, user.role);
    return ApiResponseDto.success(record, 'Attachment uploaded');
  }

  // DELETE /medical-records/:id/attachments/:attachmentId
  @Delete(':id/attachments/:attachmentId')
  @Roles(UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an attachment from a medical record' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'attachmentId', type: 'string', format: 'uuid' })
  async removeAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.medicalRecordsService.removeAttachment(id, attachmentId, user.sub, user.role);
    return ApiResponseDto.success(null, 'Attachment removed');
  }
}

// ─── Pet-scoped routes (/api/v1/pets/:petId/...) ─────────────────────────────

@ApiTags('Medical Records')
@ApiBearerAuth('access-token')
@Controller({ path: 'pets', version: '1' })
export class PetHealthController {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
    private readonly vaccinationsService: VaccinationsService,
  ) {}

  // GET /pets/:petId/medical-history
  @Get(':petId/medical-history')
  @ApiOperation({ summary: 'Full chronological medical history for a pet' })
  @ApiParam({ name: 'petId', type: 'string', format: 'uuid' })
  async getMedicalHistory(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const records = await this.medicalRecordsService.findPetHistory(petId, user.sub, user.role);
    return ApiResponseDto.success(records);
  }

  // GET /pets/:petId/health-summary
  @Get(':petId/health-summary')
  @ApiOperation({ summary: 'Health summary: last visit, active treatments, upcoming vaccinations' })
  @ApiParam({ name: 'petId', type: 'string', format: 'uuid' })
  async getHealthSummary(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const [base, vaccinationSummary] = await Promise.all([
      this.medicalRecordsService.getHealthSummary(petId, user.sub, user.role),
      this.vaccinationsService.getPetVaccinationSummary(petId, user.sub, user.role),
    ]);
    return ApiResponseDto.success({ ...(base as object), ...vaccinationSummary });
  }
}
