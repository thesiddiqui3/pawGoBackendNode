import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../../common/enums';

export class CreateClinicStaffDto {
  @ApiProperty({ example: 'Priya' })
  @IsString() @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString() @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'priya@clinic.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional() @IsString()
  phone?: string;

  @ApiProperty({ enum: [UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT], example: UserRole.RECEPTIONIST })
  @IsEnum([UserRole.CLINIC_MANAGER, UserRole.RECEPTIONIST, UserRole.ASSISTANT])
  role!: UserRole;
}

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

  @ApiPropertyOptional({ example: 'Motorcycle' })
  @IsOptional() @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'MH01AB1234' })
  @IsOptional() @IsString()
  vehicleNumber?: string;
}
