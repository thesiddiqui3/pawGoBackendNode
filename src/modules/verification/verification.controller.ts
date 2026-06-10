import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { VerificationService, VerifyAction } from './verification.service';

class PageQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

class VerifyActionDto {
  @ApiProperty({ enum: ['approve', 'reject', 'request_docs'] })
  @IsOptional()
  @IsEnum(['approve', 'reject', 'request_docs'])
  action?: VerifyAction;

  // Frontend may send status:"approved"/"rejected"/"request_docs" instead of action field
  @ApiPropertyOptional({ enum: ['approved', 'rejected', 'request_docs'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNotes?: string;

  // Resolved action regardless of which field the frontend used
  get resolvedAction(): VerifyAction {
    if (this.action) return this.action;
    if (this.status === 'approved') return 'approve';
    if (this.status === 'rejected') return 'reject';
    if (this.status === 'request_docs') return 'request_docs';
    throw new Error('Either action or status must be provided');
  }
}

@ApiTags('Verification')
@ApiBearerAuth('access-token')
@Roles(UserRole.SUPER_ADMIN)
@Controller({ path: 'admin/verification', version: '1' })
export class VerificationController {
  constructor(private readonly svc: VerificationService) {}

  // ─── Clinics ──────────────────────────────────────────────────────────────

  @Get('clinics')
  @ApiOperation({ summary: 'List clinics pending verification' })
  async pendingClinics(@Query() query: PageQueryDto): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.listPendingClinics(query));
  }

  @Get('clinics/:id')
  @ApiOperation({ summary: 'Clinic verification detail' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async clinicDetail(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getClinicVerificationDetail(id));
  }

  @Patch('clinics/:id')
  @ApiOperation({ summary: 'Approve or reject clinic' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async verifyClinic(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyActionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const action = dto.resolvedAction;
    const result = await this.svc.verifyClinic(id, { ...dto, action }, user.sub);
    return ApiResponseDto.success(result, `Clinic ${action}d`);
  }

  // ─── Shops ────────────────────────────────────────────────────────────────

  @Get('shops')
  @ApiOperation({ summary: 'List shops pending verification' })
  async pendingShops(@Query() query: PageQueryDto): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.listPendingShops(query));
  }

  @Get('shops/:id')
  @ApiOperation({ summary: 'Shop verification detail' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async shopDetail(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getShopVerificationDetail(id));
  }

  @Patch('shops/:id')
  @ApiOperation({ summary: 'Approve or reject shop' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async verifyShop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyActionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const action = dto.resolvedAction;
    const result = await this.svc.verifyShop(id, { ...dto, action }, user.sub);
    return ApiResponseDto.success(result, `Shop ${action}d`);
  }

  // ─── KYC ─────────────────────────────────────────────────────────────────

  @Get('kyc')
  @ApiOperation({ summary: 'List delivery partners pending KYC' })
  async pendingKyc(@Query() query: PageQueryDto): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.listPendingKyc(query));
  }

  @Get('kyc/:id')
  @ApiOperation({ summary: 'Delivery partner KYC detail' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async kycDetail(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getKycDetail(id));
  }

  @Patch('kyc/:id')
  @ApiOperation({ summary: 'Approve or reject KYC' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async verifyKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyActionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const action = dto.resolvedAction;
    const result = await this.svc.verifyKyc(id, { ...dto, action }, user.sub);
    return ApiResponseDto.success(result, `KYC ${action}d`);
  }
}
