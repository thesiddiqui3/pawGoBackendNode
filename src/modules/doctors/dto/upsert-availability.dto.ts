import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpsertAvailabilityDto {
  @ApiProperty({ example: '09:00', description: 'HH:MM 24-hour format' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime must be HH:MM' })
  startTime: string;

  @ApiProperty({ example: '17:00', description: 'HH:MM 24-hour format' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime must be HH:MM' })
  endTime: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
