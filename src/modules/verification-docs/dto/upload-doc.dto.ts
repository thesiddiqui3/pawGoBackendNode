import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationDocType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UploadDocDto {
  @ApiProperty({ enum: VerificationDocType })
  @IsEnum(VerificationDocType)
  docType!: VerificationDocType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class ReviewDocDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsEnum(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectedReason?: string;
}
