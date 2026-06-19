import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateHomeVisitDto {
  @ApiProperty({ description: 'Clinic UUID' })
  @IsUUID()
  clinicId: string;

  @ApiProperty({ description: 'Pet UUID' })
  @IsUUID()
  petId: string;

  @ApiProperty({ example: 'Sector 62, Noida' })
  @IsString()
  @MaxLength(500)
  address: string;

  @ApiPropertyOptional({ example: 'Noida' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: '2026-06-20T10:00:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssignDoctorDto {
  @ApiProperty({ description: 'Doctor UUID' })
  @IsUUID()
  doctorId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  fee?: number;
}

export class CancelHomeVisitDto {
  @ApiPropertyOptional({ example: 'Doctor not available' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
