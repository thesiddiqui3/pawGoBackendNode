import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { EarningsService } from './earnings.service';
import { EarningsQueryDto } from './dto/earnings-query.dto';
import { AdminPayoutActionDto, RequestPayoutDto, UpdateBankAccountDto } from './dto/payout.dto';

@Controller({ path: 'delivery-partners/earnings', version: '1' })
export class EarningsController {
  constructor(private readonly service: EarningsService) {}

  // ─── Earnings ─────────────────────────────────────────────────────────────

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

  // ─── Bank account ──────────────────────────────────────────────────────────

  @Get('bank-account')
  @Roles(UserRole.DELIVERY_PARTNER)
  getBankAccount(@CurrentUser() user: JwtPayload) {
    return this.service.getBankAccount(user.sub);
  }

  @Patch('bank-account')
  @Roles(UserRole.DELIVERY_PARTNER)
  updateBankAccount(@CurrentUser() user: JwtPayload, @Body() dto: UpdateBankAccountDto) {
    return this.service.updateBankAccount(user.sub, dto);
  }

  // ─── Payout requests ──────────────────────────────────────────────────────

  @Get('payouts')
  @Roles(UserRole.DELIVERY_PARTNER)
  listMyPayouts(@CurrentUser() user: JwtPayload) {
    return this.service.listMyPayouts(user.sub);
  }

  @Post('payouts')
  @Roles(UserRole.DELIVERY_PARTNER)
  requestPayout(@CurrentUser() user: JwtPayload, @Body() dto: RequestPayoutDto) {
    return this.service.requestPayout(user.sub, dto);
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  @Get('admin/payouts')
  @Roles(UserRole.SUPER_ADMIN)
  adminListPayouts(@Query('status') status?: string) {
    return this.service.adminListPayouts(status);
  }

  @Patch('admin/payouts/:id')
  @Roles(UserRole.SUPER_ADMIN)
  adminProcessPayout(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: AdminPayoutActionDto,
  ) {
    return this.service.adminProcessPayout(id, admin.sub, dto);
  }
}
