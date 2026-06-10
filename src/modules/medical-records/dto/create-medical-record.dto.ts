import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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
  @ApiProperty({ example: 'uuid-of-pet' })
  @IsUUID()
  petId: string;

  @ApiProperty({ example: 'uuid-of-clinic' })
  @IsUUID()
  clinicId: string;

  @ApiPropertyOptional({ example: 'uuid-of-appointment' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiProperty({ example: '2026-06-15', description: 'YYYY-MM-DD' })
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

  @ApiPropertyOptional({ example: 'Patient is anxious' })
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
