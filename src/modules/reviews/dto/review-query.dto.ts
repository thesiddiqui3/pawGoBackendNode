import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ReviewTargetType } from '../../../common/enums/clinic.enum';

export class ReviewQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReviewTargetType })
  @IsOptional()
  @IsEnum(ReviewTargetType)
  targetType?: ReviewTargetType;

  @ApiPropertyOptional({ description: 'Generic target ID (clinic, shop, doctor, delivery partner)' })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Shorthand for clinic targetId' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ description: 'Shorthand for shop targetId' })
  @IsOptional()
  @IsUUID()
  shopId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
