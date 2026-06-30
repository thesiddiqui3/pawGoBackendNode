import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateRazorpayOrderDto {
  @ApiProperty({ description: 'Amount in paise (e.g. 10000 = ₹100)', example: 10000 })
  amount: number;

  @ApiProperty({ description: 'Optional internal receipt ID' })
  receipt?: string;
}

export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  razorpay_order_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  razorpay_payment_id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  razorpay_signature: string;

  @ApiProperty({ description: 'Internal order IDs to mark as PAID after verification' })
  @IsUUID('4', { each: true })
  orderIds: string[];
}
