import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { UserRole } from '../../common/enums';
import { CreateRazorpayOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@Roles(UserRole.PET_OWNER)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('razorpay/create-order')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a Razorpay order before opening the payment sheet' })
  async createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRazorpayOrderDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.paymentsService.createRazorpayOrder(
      dto.amount,
      dto.receipt ?? `u_${user.sub}_${Date.now()}`,
    );
    return ApiResponseDto.success(data, 'Razorpay order created');
  }

  @Post('razorpay/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Razorpay payment signature and mark orders as PAID' })
  async verifyPayment(
    @Body() dto: VerifyPaymentDto,
  ): Promise<ApiResponseDto<object>> {
    const data = await this.paymentsService.verifyAndCapture(
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
      dto.orderIds,
    );
    return ApiResponseDto.success(data, 'Payment verified successfully');
  }
}
