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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CreatePrescriptionDto, PrescriptionQueryDto, UpdatePrescriptionDto } from './dto';
import { PrescriptionsService } from './prescriptions.service';

@ApiTags('Prescriptions')
@ApiBearerAuth('access-token')
@Controller({ path: 'prescriptions', version: '1' })
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a standalone prescription' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePrescriptionDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.prescriptionsService.create(dto, user.sub, user.role);
    return ApiResponseDto.success(data, 'Prescription created');
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  @Get()
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List prescriptions with filters (scoped to clinic)' })
  async findMany(
    @CurrentUser() user: JwtPayload,
    @Query() query: PrescriptionQueryDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.prescriptionsService.findMany(query, user.sub, user.role);
    return ApiResponseDto.success(data);
  }

  // ─── By Pet ───────────────────────────────────────────────────────────────

  @Get('pet/:petId')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "List a pet's prescriptions (scoped to clinic)" })
  @ApiParam({ name: 'petId', type: 'string', format: 'uuid' })
  async findByPet(
    @Param('petId', ParseUUIDPipe) petId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.prescriptionsService.findByPet(petId, user.sub, user.role);
    return ApiResponseDto.success(data);
  }

  // ─── Detail ───────────────────────────────────────────────────────────────

  @Get(':id')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get prescription detail' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.prescriptionsService.findOne(id, user.sub, user.role);
    return ApiResponseDto.success(data);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update prescription (status, dosage, notes, etc.)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdatePrescriptionDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.prescriptionsService.update(id, dto, user.sub, user.role);
    return ApiResponseDto.success(data, 'Prescription updated');
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a prescription (clinic owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.prescriptionsService.delete(id, user.sub, user.role);
    return ApiResponseDto.success(null, 'Prescription deleted');
  }

  // ─── PDF Export ───────────────────────────────────────────────────────────

  @Get(':id/pdf')
  @Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export prescription as PDF' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async exportPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.prescriptionsService.generatePdf(id, user.sub, user.role);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="prescription-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
