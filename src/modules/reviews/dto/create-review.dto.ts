import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ReviewTargetType } from '../../../common/enums/clinic.enum';

export class CreateReviewDto {
  @ApiProperty({ enum: ReviewTargetType, example: ReviewTargetType.CLINIC })
  @IsEnum(ReviewTargetType)
  targetType: ReviewTargetType;

  @ApiProperty({ description: 'Clinic ID or Doctor ID depending on targetType' })
  @IsUUID()
  targetId: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 4 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Excellent service and very caring staff.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
