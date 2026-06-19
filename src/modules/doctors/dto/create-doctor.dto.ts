import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DoctorSpecialization } from '../../../common/enums/clinic.enum';
import { AvailabilityDto } from './availability.dto';
import { CertificationDto, EducationDto } from './education.dto';

export class CreateDoctorDto {
  @ApiPropertyOptional({ description: 'User ID — must be a user with DOCTOR role' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  // ─── Inline doctor creation fields (when userId is not provided) ────────────
  @ApiPropertyOptional({ example: 'Dr. Arjun Sharma' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'doctor@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'MBBS, BVSc' })
  @IsOptional()
  @IsString()
  qualification?: string;

  @ApiPropertyOptional({ description: 'Clinic to associate with' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ enum: DoctorSpecialization, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(DoctorSpecialization, { each: true })
  specializations?: DoctorSpecialization[];

  @ApiPropertyOptional({ description: 'Single specialization string (alternative to specializations array)' })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number;

  @ApiPropertyOptional({ example: 5, description: 'Alias for experienceYears' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  experience?: number;

  @ApiPropertyOptional({ example: 500, description: 'Consultation fee in local currency' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number;

  @ApiPropertyOptional({ example: 'Specialist in small animal surgery with 5 years of experience.' })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  bio?: string;

  @ApiPropertyOptional({ example: ['English', 'Hindi'], isArray: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ type: [AvailabilityDto], description: 'Weekly schedule slots. String values (e.g. "available") are ignored.' })
  @IsOptional()
  availability?: AvailabilityDto[] | string;

  @ApiPropertyOptional({ description: 'Doctor status (ignored on create)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Rating (ignored on create)' })
  @IsOptional()
  @IsNumber()
  rating?: number;

  @ApiPropertyOptional({ type: [EducationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  education?: EducationDto[];

  @ApiPropertyOptional({ type: [CertificationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  certifications?: CertificationDto[];
}
