import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { ReviewDocDto, UploadDocDto } from './dto/upload-doc.dto';
import { VerificationDocsService } from './verification-docs.service';

// ─── Clinic Owner Routes ───────────────────────────────────────────────────

@ApiTags('Verification Documents')
@ApiBearerAuth('access-token')
@Roles(UserRole.CLINIC_OWNER, UserRole.CLINIC_MANAGER)
@Controller({ path: 'my-clinic/documents', version: '1' })
export class ClinicDocsController {
  constructor(private readonly svc: VerificationDocsService) {}

  @Get()
  @ApiOperation({ summary: 'List my clinic verification documents' })
  async list(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getClinicDocs(user.sub));
  }

  @Post()
  @ApiOperation({ summary: 'Upload a verification document for my clinic' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadDocDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.uploadClinicDoc(user.sub, dto, file), 'Document uploaded');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a verification document' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<object>> {
    await this.svc.deleteClinicDoc(user.sub, id);
    return ApiResponseDto.success(null as unknown as object, 'Document deleted');
  }
}

// ─── Shop Owner Routes ─────────────────────────────────────────────────────

@ApiTags('Verification Documents')
@ApiBearerAuth('access-token')
@Roles(UserRole.SHOP_OWNER)
@Controller({ path: 'my-shop/documents', version: '1' })
export class ShopDocsController {
  constructor(private readonly svc: VerificationDocsService) {}

  @Get()
  @ApiOperation({ summary: 'List my shop verification documents' })
  async list(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getShopDocs(user.sub));
  }

  @Post()
  @ApiOperation({ summary: 'Upload a verification document for my shop' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadDocDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.uploadShopDoc(user.sub, dto, file), 'Document uploaded');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a verification document' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<object>> {
    await this.svc.deleteShopDoc(user.sub, id);
    return ApiResponseDto.success(null as unknown as object, 'Document deleted');
  }
}

// ─── Doctor Docs — Clinic Owner Routes ────────────────────────────────────

@ApiTags('Verification Documents')
@ApiBearerAuth('access-token')
@Roles(UserRole.CLINIC_OWNER)
@Controller({ version: '1' })
export class DoctorDocsController {
  constructor(private readonly svc: VerificationDocsService) {}

  @Get('doctors/:doctorId/documents')
  @ApiOperation({ summary: "List doctor's verification documents (clinic owner)" })
  @ApiParam({ name: 'doctorId', type: 'string', format: 'uuid' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getDoctorDocs(user.sub, doctorId));
  }

  @Post('doctors/:doctorId/documents')
  @ApiOperation({ summary: 'Upload a verification document for a doctor (clinic owner)' })
  @ApiParam({ name: 'doctorId', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: JwtPayload,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Body() dto: UploadDocDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.uploadDoctorDoc(user.sub, doctorId, dto, file), 'Document uploaded');
  }

  @Delete('doctors/:doctorId/documents/:docId')
  @ApiOperation({ summary: 'Delete a doctor verification document (clinic owner)' })
  @ApiParam({ name: 'doctorId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('docId', ParseUUIDPipe) docId: string,
  ): Promise<ApiResponseDto<object>> {
    await this.svc.deleteDoctorDoc(user.sub, docId);
    return ApiResponseDto.success(null as unknown as object, 'Document deleted');
  }
}

// ─── Delivery Partner Docs — Shop Owner Routes ─────────────────────────────

@ApiTags('Verification Documents')
@ApiBearerAuth('access-token')
@Roles(UserRole.SHOP_OWNER)
@Controller({ version: '1' })
export class DeliveryPartnerDocsController {
  constructor(private readonly svc: VerificationDocsService) {}

  @Get('my-shop/delivery-partners/:partnerId/documents')
  @ApiOperation({ summary: "List delivery partner's verification documents (shop owner)" })
  @ApiParam({ name: 'partnerId', type: 'string', format: 'uuid' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Param('partnerId', ParseUUIDPipe) partnerId: string,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getDeliveryPartnerDocs(user.sub, partnerId));
  }

  @Post('my-shop/delivery-partners/:partnerId/documents')
  @ApiOperation({ summary: 'Upload a verification document for a delivery partner (shop owner)' })
  @ApiParam({ name: 'partnerId', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: JwtPayload,
    @Param('partnerId', ParseUUIDPipe) partnerId: string,
    @Body() dto: UploadDocDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.uploadDeliveryPartnerDoc(user.sub, partnerId, dto, file), 'Document uploaded');
  }

  @Delete('my-shop/delivery-partners/:partnerId/documents/:docId')
  @ApiOperation({ summary: 'Delete a delivery partner verification document (shop owner)' })
  @ApiParam({ name: 'partnerId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'docId', type: 'string', format: 'uuid' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('docId', ParseUUIDPipe) docId: string,
  ): Promise<ApiResponseDto<object>> {
    await this.svc.deleteDeliveryPartnerDoc(user.sub, docId);
    return ApiResponseDto.success(null as unknown as object, 'Document deleted');
  }
}

// ─── Admin Routes ──────────────────────────────────────────────────────────

@ApiTags('Admin / Verification Documents')
@ApiBearerAuth('access-token')
@Roles(UserRole.SUPER_ADMIN)
@Controller({ path: 'admin/documents', version: '1' })
export class AdminDocsController {
  constructor(private readonly svc: VerificationDocsService) {}

  @Get('clinics/:clinicId')
  @ApiOperation({ summary: 'List verification docs for a clinic' })
  @ApiParam({ name: 'clinicId', type: 'string', format: 'uuid' })
  async clinicDocs(@Param('clinicId', ParseUUIDPipe) clinicId: string): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getDocsForClinicAdmin(clinicId));
  }

  @Get('shops/:shopId')
  @ApiOperation({ summary: 'List verification docs for a shop' })
  @ApiParam({ name: 'shopId', type: 'string', format: 'uuid' })
  async shopDocs(@Param('shopId', ParseUUIDPipe) shopId: string): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getDocsForShopAdmin(shopId));
  }

  @Get('doctors/:doctorId')
  @ApiOperation({ summary: 'List verification docs for a doctor (admin)' })
  @ApiParam({ name: 'doctorId', type: 'string', format: 'uuid' })
  async doctorDocs(@Param('doctorId', ParseUUIDPipe) doctorId: string): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getDocsForDoctorAdmin(doctorId));
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Approve, reject, or mark under-review a verification document' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDocDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.reviewDoc(id, dto, user.sub);
    return ApiResponseDto.success(result, `Document ${dto.action}d`);
  }
}
