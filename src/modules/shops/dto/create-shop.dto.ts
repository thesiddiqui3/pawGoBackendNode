import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsJSON, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateShopDto {
  @ApiProperty({ example: 'Pawsome Treats' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Premium pet food and accessories' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'shop@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '12, Market Road' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Maharashtra' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '400001' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,10}$/, { message: 'Invalid pincode' })
  pincode?: string;

  // ── Location ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 28.6139 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 77.2090 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  // ── Delivery ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryCharge?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  freeDeliveryAbove?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  serviceRadius?: number;

  // ── Working hours (JSON) ──────────────────────────────────────────────────

  @ApiPropertyOptional()
  @IsOptional()
  workingHours?: Record<string, { open: boolean; from: string; to: string }>;

  // ── Legal ─────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: '27AABCU9603R1ZX' })
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional({ example: 'SHOP12345' })
  @IsOptional()
  @IsString()
  shopRegNumber?: string;

  // ── Bank details ──────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'HDFC Bank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '50100123456789' })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ example: 'HDFC0001234' })
  @IsOptional()
  @IsString()
  bankIfsc?: string;
}
