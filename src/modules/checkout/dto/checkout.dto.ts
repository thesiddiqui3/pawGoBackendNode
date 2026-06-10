import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CheckoutDto {
  @ApiProperty({ format: 'uuid', description: 'Delivery address ID' })
  @IsUUID()
  addressId: string;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.COD })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'Please leave at the door.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
