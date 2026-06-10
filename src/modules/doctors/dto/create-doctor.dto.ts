import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
  @ApiProperty({ description: 'User ID — must be a user with DOCTOR role' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'Clinic to associate with' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiProperty({ enum: DoctorSpecialization, isArray: true })
  @IsArray()
  @IsEnum(DoctorSpecialization, { each: true })
  specializations: DoctorSpecialization[];

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears: number;

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

  @ApiPropertyOptional({ type: [AvailabilityDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDto)
  availability?: AvailabilityDto[];

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
