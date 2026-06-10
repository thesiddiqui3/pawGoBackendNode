import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { VehicleType } from '@prisma/client';

export class RegisterDeliveryPartnerDto {
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsString()
  @IsNotEmpty()
  vehicleNumber: string;

  @IsString()
  @IsNotEmpty()
  drivingLicense: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{12}$/, { message: 'Aadhaar number must be 12 digits' })
  aadhaarNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Invalid emergency contact number' })
  emergencyContact: string;

  @IsString()
  @IsOptional()
  profilePhoto?: string;
}
