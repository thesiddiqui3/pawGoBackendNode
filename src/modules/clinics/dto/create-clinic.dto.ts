import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ClinicService } from '../../../common/enums/clinic.enum';
import { WorkingHoursDto } from './working-hours.dto';

export class CreateClinicDto {
  @ApiProperty({ example: 'PawCare Veterinary Clinic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'A full-service pet healthcare clinic' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '+911234567890' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'clinic@pawcare.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '12 MG Road, Connaught Place' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'New Delhi' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Delhi' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: '110001' })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ example: 28.6139, description: 'Decimal latitude' })
  @IsOptional()
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 77.209, description: 'Decimal longitude' })
  @IsOptional()
  @IsNumber()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ enum: ClinicService, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ClinicService, { each: true })
  services?: ClinicService[];

  @ApiPropertyOptional({ type: [WorkingHoursDto] })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, Record<string, unknown>>).map(([day, v]) => ({
        day: day.toUpperCase(),
        startTime: (v.startTime ?? v.from ?? '09:00') as string,
        endTime:   (v.endTime   ?? v.to   ?? '18:00') as string,
        isAvailable: Boolean(v.isAvailable ?? v.open ?? true),
      }));
    }
    return undefined;
  })
  @Type(() => WorkingHoursDto)
  workingHours?: WorkingHoursDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lunchBreakEnabled?: boolean;

  @ApiPropertyOptional({ example: '13:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'lunchBreakFrom must be HH:MM' })
  lunchBreakFrom?: string;

  @ApiPropertyOptional({ example: '14:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'lunchBreakTo must be HH:MM' })
  lunchBreakTo?: string;

  // Frontend sends lunchBreak as a nested object; repository flattens it
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  lunchBreak?: { enabled?: boolean; from?: string; to?: string };

  @ApiPropertyOptional({ example: '10' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  serviceRadius?: number;

  @ApiPropertyOptional({ example: '+911234567890' })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({ example: 'VET-98545' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: '2028-12-31' })
  @IsOptional()
  @IsString()
  licenseExpiry?: string;

  @ApiPropertyOptional({ example: '22ABCDE1234F1Z5' })
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional({ example: 'HDFC Bank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ example: 'HDFC0001234' })
  @IsOptional()
  @IsString()
  bankIfsc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  clinicHolidays?: Array<{ id: string; name: string; date: string; recurring: boolean }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  blockedDates?: string[];

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDailyAppointments?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emergencyAvailable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lunchBreakBlocking?: boolean;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  advanceBookingDays?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minNoticeMinutes?: number;
}
