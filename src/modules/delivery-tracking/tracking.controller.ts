import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

import { UserRole } from '../../common/enums';
import { TrackingService } from './tracking.service';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller({ path: 'delivery-partners', version: '1' })
export class TrackingController {
  constructor(private readonly service: TrackingService) {}

  @Post('location')
  @Roles(UserRole.DELIVERY_PARTNER)
  updateLocation(@Body() dto: UpdateLocationDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateLocation(user.sub, dto);
  }
}

@Controller({ path: 'orders', version: '1' })
export class OrderTrackingController {
  constructor(private readonly service: TrackingService) {}

  @Get(':orderId/live-tracking')
  @Public()
  getLiveTracking(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.service.getLiveTracking(orderId);
  }
}
