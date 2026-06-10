import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class EarningsQueryDto extends PaginationDto {
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  @Type(() => Number)
  month?: number;

  @IsInt()
  @Min(2020)
  @IsOptional()
  @Type(() => Number)
  year?: number;
}
