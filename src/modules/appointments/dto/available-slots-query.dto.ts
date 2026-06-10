import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AvailableSlotsQueryDto {
  @ApiProperty({ example: '2026-06-15', description: 'YYYY-MM-DD format' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'Slot duration in minutes', default: 30, minimum: 15, maximum: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(120)
  slotDuration?: number = 30;
}
