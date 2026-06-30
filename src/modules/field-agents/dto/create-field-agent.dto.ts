import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFieldAgentDto {
  @ApiProperty({ example: 'Arjun' })
  @IsString() @IsNotEmpty() firstName: string;

  @ApiProperty({ example: 'Mehta' })
  @IsString() @IsNotEmpty() lastName: string;

  @ApiProperty({ example: 'arjun.mehta@pawgo.app' })
  @IsEmail() email: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional() @IsString() phone?: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional() @IsString() assignedCity?: string;

  @ApiPropertyOptional({ example: 'Maharashtra' })
  @IsOptional() @IsString() assignedState?: string;

  @ApiPropertyOptional({ example: 'Western India' })
  @IsOptional() @IsString() assignedRegion?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean() canOnboardClinics?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean() canOnboardShops?: boolean;
}
