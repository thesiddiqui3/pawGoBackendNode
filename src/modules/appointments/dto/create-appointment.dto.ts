import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateAppointmentDto {
  @ApiProperty({ example: 'uuid-of-pet' })
  @IsUUID()
  petId: string;

  @ApiProperty({ example: 'uuid-of-clinic' })
  @IsUUID()
  clinicId: string;

  @ApiProperty({ example: 'uuid-of-doctor' })
  @IsUUID()
  doctorId: string;

  @ApiProperty({ example: '2026-06-15', description: 'YYYY-MM-DD format' })
  @IsDateString()
  appointmentDate: string;

  @ApiProperty({ example: '10:00', description: 'HH:MM 24-hour format' })
  @Matches(TIME_REGEX, { message: 'startTime must be HH:MM format' })
  startTime: string;

  @ApiProperty({ example: 'Annual vaccination' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ example: 'Pet is nervous around strangers' })
  @IsOptional()
  @IsString()
  notes?: string;
}
