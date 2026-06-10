import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { VehicleType } from '@prisma/client';

export class UpdateDeliveryPartnerDto {
  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @IsString()
  @IsOptional()
  vehicleNumber?: string;

  @IsString()
  @IsOptional()
  drivingLicense?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Invalid emergency contact number' })
  emergencyContact?: string;

  @IsString()
  @IsOptional()
  profilePhoto?: string;
}
