import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsPhoneNumber, IsString, IsUUID, MaxLength } from 'class-validator';

export class WalkInAppointmentDto {
  @ApiPropertyOptional({ description: 'Pet ID (if registered in system)' })
  @IsOptional()
  @IsUUID()
  petId?: string;

  @ApiPropertyOptional({ description: 'Owner user ID (if registered)' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Walk-in owner name (for unregistered visitors)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  walkinOwnerName?: string;

  @ApiPropertyOptional({ description: 'Walk-in phone number' })
  @IsOptional()
  @IsString()
  walkinPhone?: string;

  @ApiProperty({ description: 'Doctor UUID' })
  @IsUUID()
  doctorId: string;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  appointmentDate: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  startTime: string;

  @ApiPropertyOptional({ example: '10:30' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiProperty({ example: 'General checkup' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
