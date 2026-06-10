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
@Roles(UserRole.CLINIC_OWNER)
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

  @Patch(':id/review')
  @ApiOperation({ summary: 'Approve or reject a verification document' })
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
