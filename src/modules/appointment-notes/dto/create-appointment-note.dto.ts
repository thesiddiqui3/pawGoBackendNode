import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAppointmentNoteDto {
  @ApiPropertyOptional({ example: 'Mild upper respiratory infection' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  diagnosis?: string;

  @ApiPropertyOptional({ example: 'Rest and fluids for 5 days' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  treatment?: string;

  @ApiPropertyOptional({ type: [String], example: ['Amoxicillin 250mg', 'Ibuprofen 100mg'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  medications?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional({ example: '2026-07-15' })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional({ example: 'Patient tolerates the medication well.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
