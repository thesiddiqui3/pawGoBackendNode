import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVaccinationDto {
  @ApiPropertyOptional({ example: 'uuid-of-pet', description: 'Pet UUID — omit for walk-in pets' })
  @IsOptional()
  @IsUUID()
  petId?: string;

  @ApiPropertyOptional({ description: 'Walk-in pet name' })
  @IsOptional()
  @IsString()
  petName?: string;

  @ApiPropertyOptional({ description: 'Walk-in pet type/species' })
  @IsOptional()
  @IsString()
  petType?: string;

  @ApiPropertyOptional({ description: 'Walk-in owner name' })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional({ description: 'Walk-in owner phone' })
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiProperty({ example: 'Rabies' })
  @IsString()
  @IsNotEmpty()
  vaccineName: string;

  @ApiPropertyOptional({ example: 'Core' })
  @IsOptional()
  @IsString()
  vaccineType?: string;

  @ApiPropertyOptional({ example: 'Zoetis' })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'BATCH-2026-001' })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiProperty({ example: '2026-06-20', description: 'YYYY-MM-DD' })
  @IsDateString()
  dateAdministered: string;

  @ApiPropertyOptional({ example: '2027-06-20', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @ApiPropertyOptional({ example: 'uuid-of-doctor' })
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-clinic' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ example: 'Pet handled well' })
  @IsOptional()
  @IsString()
  notes?: string;
}
