import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { DayOfWeek } from '../../../common/enums/clinic.enum';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class WorkingHoursDto {
  @ApiProperty({ enum: DayOfWeek, example: DayOfWeek.MONDAY })
  @IsEnum(DayOfWeek)
  day: DayOfWeek;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_REGEX, { message: 'startTime must be HH:MM format (e.g. 09:00)' })
  startTime: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_REGEX, { message: 'endTime must be HH:MM format (e.g. 17:00)' })
  endTime: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
