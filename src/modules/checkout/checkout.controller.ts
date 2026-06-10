import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutService } from './checkout.service';

@ApiTags('Checkout')
@ApiBearerAuth('access-token')
@Roles(UserRole.PET_OWNER, UserRole.SUPER_ADMIN)
@Controller({ path: 'checkout', version: '1' })
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Place order(s) from current cart',
    description:
      'Validates stock, refreshes prices, creates one order per shop, deducts stock atomically, and clears the cart.',
  })
  async checkout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CheckoutDto,
  ): Promise<ApiResponseDto<object>> {
    const orders = await this.checkoutService.checkout(user.sub, dto);
    return ApiResponseDto.success(orders, `${orders.length} order(s) placed successfully`);
  }
}
