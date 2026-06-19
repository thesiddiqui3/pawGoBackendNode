import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // ─── Notifications ────────────────────────────────────────────────────────

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query() query: NotificationQueryDto) {
    return this.service.findAll(user.sub, query);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.service.getUnreadCount(user.sub);
  }

  // ─── Preferences (must be before :id routes) ─────────────────────────────

  @Get('preferences')
  getPreferences(@CurrentUser() user: JwtPayload) {
    return this.service.getPreferences(user.sub);
  }

  @Patch('preferences')
  updatePreferences(@Body() dto: UpdatePreferenceDto, @CurrentUser() user: JwtPayload) {
    return this.service.updatePreferences(user.sub, dto);
  }

  // ─── Device tokens (must be before :id routes) ───────────────────────────

  @Post('device')
  registerDevice(@Body() dto: RegisterDeviceDto, @CurrentUser() user: JwtPayload) {
    return this.service.registerDevice(user.sub, dto);
  }

  @Get('device/list')
  getDevices(@CurrentUser() user: JwtPayload) {
    return this.service.getDevices(user.sub);
  }

  @Delete('device/:deviceId')
  removeDevice(@Param('deviceId') deviceId: string, @CurrentUser() user: JwtPayload) {
    return this.service.removeDevice(user.sub, deviceId);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.service.markAllRead(user.sub);
  }

  // ─── Single notification (wildcard — keep last) ───────────────────────────

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user.sub);
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markRead(id, user.sub);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user.sub);
  }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

@Controller({ path: 'admin/notifications', version: '1' })
export class AdminNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post('broadcast')
  @Roles(UserRole.SUPER_ADMIN)
  broadcast(@Body() dto: BroadcastNotificationDto, @CurrentUser() user: JwtPayload) {
    return this.service.broadcast(dto, user.sub);
  }
}
