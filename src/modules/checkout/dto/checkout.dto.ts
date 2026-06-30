import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUppercase, MaxLength } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CheckoutDto {
  @ApiProperty({ format: 'uuid', description: 'Delivery address ID' })
  @IsString()
  addressId: string;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.COD })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'SAVE10', description: 'Coupon code to apply' })
  @IsOptional()
  @IsString()
  @IsUppercase()
  @MaxLength(50)
  couponCode?: string;

  @ApiPropertyOptional({ example: 'Please leave at the door.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
