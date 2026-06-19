import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CreateAssistantDto, CreateClinicStaffDto, CreateDeliveryPartnerDto } from './dto/create-staff.dto';
import { StaffService } from './staff.service';

@ApiTags('Staff Management')
@ApiBearerAuth('access-token')
@Controller({ version: '1' })
export class StaffController {
  constructor(private readonly svc: StaffService) {}

  // ─── Clinic Owner manages ALL staff (manager/receptionist/assistant) ────────

  @Post('my-clinic/staff')
  @Roles(UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Create clinic staff (manager/receptionist/assistant)' })
  async createClinicStaff(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateClinicStaffDto,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.createClinicStaff(user.sub, dto);
    return ApiResponseDto.success(result, 'Staff created. Share credentials with them.');
  }

  @Get('my-clinic/staff')
  @Roles(UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'List all staff at my clinic' })
  async listClinicStaff(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.listAllClinicStaff(user.sub));
  }

  @Patch('my-clinic/staff/:userId/deactivate')
  @Roles(UserRole.CLINIC_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a clinic staff member' })
  async deactivateStaff(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) staffUserId: string,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.deactivateClinicStaff(user.sub, staffUserId);
    return ApiResponseDto.success(result);
  }

  @Delete('my-clinic/staff/:userId')
  @Roles(UserRole.CLINIC_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a clinic staff member' })
  async removeStaff(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) staffUserId: string,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.removeClinicStaff(user.sub, staffUserId);
    return ApiResponseDto.success(result);
  }

  // ─── Clinic Owner manages Assistants (legacy, kept for compatibility) ────

  @Post('my-clinic/assistants')
  @Roles(UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Clinic owner: add an assistant (legacy endpoint)' })
  async createAssistant(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAssistantDto,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.createAssistant(user.sub, dto);
    return ApiResponseDto.success(result, 'Assistant created. Share credentials with them.');
  }

  @Get('my-clinic/assistants')
  @Roles(UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Clinic owner: list my clinic assistants (legacy)' })
  async listAssistants(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.listClinicAssistants(user.sub));
  }

  @Get('my-clinic/assistants/:doctorId')
  @Roles(UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Clinic owner: get assistant by doctor ID' })
  async getAssistant(
    @CurrentUser() user: JwtPayload,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getClinicAssistantById(user.sub, doctorId));
  }

  @Patch('my-clinic/assistants/:userId/activate')
  @Roles(UserRole.CLINIC_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a clinic assistant' })
  async activateAssistant(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) staffUserId: string,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.activateClinicStaff(user.sub, staffUserId));
  }

  // ─── Shop Owner manages Delivery Partners ─────────────────────────────────

  @Post('my-shop/delivery-partners')
  @Roles(UserRole.SHOP_OWNER)
  @ApiOperation({ summary: 'Shop owner: add a delivery partner to my shop' })
  async createDeliveryPartner(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDeliveryPartnerDto,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.createDeliveryPartner(user.sub, dto);
    return ApiResponseDto.success(result, 'Delivery partner created. Share credentials with them.');
  }

  @Get('my-shop/delivery-partners')
  @Roles(UserRole.SHOP_OWNER)
  @ApiOperation({ summary: 'Shop owner: list my shop delivery partners' })
  async listDeliveryPartners(
    @CurrentUser() user: JwtPayload,
    @Query() query: Record<string, any>,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.listShopDeliveryPartners(user.sub, query));
  }

  @Get('my-shop/delivery-partners/:id')
  @Roles(UserRole.SHOP_OWNER)
  @ApiOperation({ summary: 'Shop owner: get a delivery partner by ID' })
  async getDeliveryPartner(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.getShopDeliveryPartnerById(user.sub, id));
  }

  @Patch('my-shop/delivery-partners/:id')
  @Roles(UserRole.SHOP_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shop owner: update a delivery partner' })
  async updateDeliveryPartner(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Record<string, any>,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.updateShopDeliveryPartner(user.sub, id, dto));
  }

  @Patch('my-shop/delivery-partners/:id/status')
  @Roles(UserRole.SHOP_OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shop owner: suspend or activate a delivery partner' })
  async updateDeliveryPartnerStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.updateShopDeliveryPartnerStatus(user.sub, id, status));
  }
}
