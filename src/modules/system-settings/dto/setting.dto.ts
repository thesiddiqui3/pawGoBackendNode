import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export const SETTING_CATEGORIES = [
  'general',
  'fees',
  'appointments',
  'notifications',
  'theme',
] as const;

export class CreateSettingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ description: 'Any JSON-serializable value' })
  value!: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: SETTING_CATEGORIES })
  @IsOptional()
  @IsIn(SETTING_CATEGORIES)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateSettingDto {
  @ApiProperty({ description: 'Any JSON-serializable value' })
  value!: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class SettingQueryDto {
  @ApiPropertyOptional({ enum: SETTING_CATEGORIES })
  @IsOptional()
  @IsIn(SETTING_CATEGORIES)
  category?: string;
}
