import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAssistantDto {
  @ApiProperty({ example: 'Ravi' })
  @IsString() @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Kumar' })
  @IsString() @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'ravi@clinic.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional() @IsString()
  phone?: string;
}

export class CreateDeliveryPartnerDto {
  @ApiProperty({ example: 'Suresh' })
  @IsString() @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Yadav' })
  @IsString() @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'suresh@delivery.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  phone?: string;
}
