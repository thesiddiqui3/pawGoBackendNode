import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CreateAssistantDto, CreateDeliveryPartnerDto } from './dto/create-staff.dto';
import { StaffService } from './staff.service';

@ApiTags('Staff Management')
@ApiBearerAuth('access-token')
@Controller({ version: '1' })
export class StaffController {
  constructor(private readonly svc: StaffService) {}

  // ─── Clinic Owner manages Assistants ─────────────────────────────────────

  @Post('my-clinic/assistants')
  @Roles(UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Clinic owner: add an assistant to my clinic' })
  async createAssistant(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAssistantDto,
  ): Promise<ApiResponseDto<object>> {
    const result = await this.svc.createAssistant(user.sub, dto);
    return ApiResponseDto.success(result, 'Assistant created. Share credentials with them.');
  }

  @Get('my-clinic/assistants')
  @Roles(UserRole.CLINIC_OWNER)
  @ApiOperation({ summary: 'Clinic owner: list my clinic assistants' })
  async listAssistants(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.listClinicAssistants(user.sub));
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
  async listDeliveryPartners(@CurrentUser() user: JwtPayload): Promise<ApiResponseDto<object>> {
    return ApiResponseDto.success(await this.svc.listShopDeliveryPartners(user.sub));
  }
}
