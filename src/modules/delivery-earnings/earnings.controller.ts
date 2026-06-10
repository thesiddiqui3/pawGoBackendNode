import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

import { UserRole } from '../../common/enums';
import { EarningsService } from './earnings.service';
import { EarningsQueryDto } from './dto/earnings-query.dto';

@Controller({ path: 'delivery-partners/earnings', version: '1' })
export class EarningsController {
  constructor(private readonly service: EarningsService) {}

  @Get()
  @Roles(UserRole.DELIVERY_PARTNER)
  findMyEarnings(@CurrentUser() user: JwtPayload, @Query() query: EarningsQueryDto) {
    return this.service.findMyEarnings(user.sub, query);
  }

  @Get('summary')
  @Roles(UserRole.DELIVERY_PARTNER)
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.service.getSummary(user.sub);
  }
}
