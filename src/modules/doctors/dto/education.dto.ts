import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class EducationDto {
  @ApiProperty({ example: 'Doctor of Veterinary Medicine' })
  @IsString()
  @IsNotEmpty()
  degree: string;

  @ApiProperty({ example: 'Delhi University' })
  @IsString()
  @IsNotEmpty()
  institution: string;

  @ApiPropertyOptional({ example: 2018 })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear())
  year?: number;
}

export class CertificationDto {
  @ApiProperty({ example: 'Advanced Small Animal Surgery' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Veterinary Council of India' })
  @IsOptional()
  @IsString()
  issuedBy?: string;

  @ApiPropertyOptional({ example: 2020 })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(new Date().getFullYear())
  year?: number;
}
