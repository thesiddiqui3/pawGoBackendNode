import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PrescriptionDto } from './prescription.dto';

export class CreateMedicalRecordDto {
  @ApiPropertyOptional({ description: 'Pet UUID — omit for walk-in / unregistered pets' })
  @IsOptional()
  @IsUUID()
  petId?: string;

  @ApiPropertyOptional({ description: 'Walk-in pet name (when petId is not provided)' })
  @IsOptional()
  @IsString()
  petName?: string;

  @ApiPropertyOptional({ description: 'Pet species/type' })
  @IsOptional()
  @IsString()
  petType?: string;

  @ApiPropertyOptional({ description: 'Owner name for walk-in' })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional({ description: 'Clinic UUID — auto-resolved from token if omitted' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ description: 'Doctor UUID — required when clinic owner is creating' })
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Appointment UUID (omit if no linked appointment)' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({ example: '2026-06-15', description: 'Visit date YYYY-MM-DD' })
  @IsDateString()
  visitDate: string;

  @ApiProperty({ example: 'Loss of appetite' })
  @IsString()
  @IsNotEmpty()
  chiefComplaint: string;

  @ApiPropertyOptional({ type: [String], example: ['vomiting', 'weakness'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @ApiPropertyOptional({ type: [String], example: ['stomach infection'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diagnosis?: string[];

  @ApiPropertyOptional({ example: '7-day medication course' })
  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional({ type: [PrescriptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionDto)
  prescriptions?: PrescriptionDto[];
}
