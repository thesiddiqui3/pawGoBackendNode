import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateVaccinationDto {
  @ApiProperty({ example: 'uuid-of-pet' })
  @IsUUID()
  petId: string;

  @ApiProperty({ example: 'Rabies' })
  @IsString()
  @IsNotEmpty()
  vaccineName: string;

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

  @ApiPropertyOptional({ example: 'uuid-of-clinic' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ example: 'Pet handled well' })
  @IsOptional()
  @IsString()
  notes?: string;
}
