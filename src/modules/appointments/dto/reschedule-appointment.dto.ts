import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({ example: '2026-06-20', description: 'YYYY-MM-DD format' })
  @IsDateString()
  appointmentDate: string;

  @ApiProperty({ example: '14:00', description: 'HH:MM 24-hour format' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be HH:MM format' })
  startTime: string;
}
