import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFieldAgentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() assignedCity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedState?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedRegion?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canOnboardClinics?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canOnboardShops?: boolean;
}

export class SuspendFieldAgentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
