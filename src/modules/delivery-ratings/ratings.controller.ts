import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

import { UserRole } from '../../common/enums';
import { RatingsService } from './ratings.service';
import { CreateDeliveryRatingDto } from './dto/create-delivery-rating.dto';

@Controller({ path: 'delivery-ratings', version: '1' })
export class RatingsController {
  constructor(private readonly service: RatingsService) {}

  @Post()
  @Roles(UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateDeliveryRatingDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(user.sub, dto);
  }
}
