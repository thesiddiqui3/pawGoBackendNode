import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

import { UserRole } from '../../common/enums';
import { DeliveryPartnersService } from './delivery-partners.service';
import { RegisterDeliveryPartnerDto } from './dto/register-delivery-partner.dto';
import { UpdateDeliveryPartnerDto } from './dto/update-delivery-partner.dto';
import { ToggleOnlineDto } from './dto/toggle-online.dto';
import { DeliveryPartnerQueryDto } from './dto/delivery-partner-query.dto';

@Controller({ path: 'delivery-partners', version: '1' })
export class DeliveryPartnersController {
  constructor(private readonly service: DeliveryPartnersService) {}

  @Post('register')
  @Roles(UserRole.DELIVERY_PARTNER, UserRole.SUPER_ADMIN)
  register(@Body() dto: RegisterDeliveryPartnerDto, @CurrentUser() user: JwtPayload) {
    return this.service.register(user.sub, dto);
  }

  @Get('me')
  @Roles(UserRole.DELIVERY_PARTNER)
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.service.getMyProfile(user.sub);
  }

  @Patch('me')
  @Roles(UserRole.DELIVERY_PARTNER)
  updateProfile(@Body() dto: UpdateDeliveryPartnerDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateProfile(user.sub, dto);
  }

  @Patch('online')
  @Roles(UserRole.DELIVERY_PARTNER)
  toggleOnline(@Body() dto: ToggleOnlineDto, @CurrentUser() user: JwtPayload) {
    return this.service.toggleOnline(user.sub, dto);
  }

  @Patch('availability')
  @Roles(UserRole.DELIVERY_PARTNER)
  toggleAvailability(@CurrentUser() user: JwtPayload) {
    return this.service.toggleAvailability(user.sub);
  }

  @Get('dashboard')
  @Roles(UserRole.DELIVERY_PARTNER)
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.service.getDashboard(user.sub);
  }
}

@Controller({ path: 'admin/delivery-partners', version: '1' })
export class AdminDeliveryPartnersController {
  constructor(private readonly service: DeliveryPartnersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Query() query: DeliveryPartnerQueryDto) {
    return this.service.findAll(query);
  }

  @Get('dashboard')
  @Roles(UserRole.SUPER_ADMIN)
  getAdminDashboard() {
    return this.service.getAdminDashboard();
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPER_ADMIN)
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.approve(id, user.sub);
  }

  @Patch(':id/suspend')
  @Roles(UserRole.SUPER_ADMIN)
  suspend(@Param('id', ParseUUIDPipe) id: string, @Body('reason') reason: string, @CurrentUser() user: JwtPayload) {
    return this.service.suspend(id, user.sub, reason);
  }

  @Patch(':id/activate')
  @Roles(UserRole.SUPER_ADMIN)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.activate(id);
  }
}
