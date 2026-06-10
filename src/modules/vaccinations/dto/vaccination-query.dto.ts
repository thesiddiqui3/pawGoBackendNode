import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class VaccinationQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  petId?: string;

  @ApiPropertyOptional({ example: 'Rabies' })
  @IsOptional()
  @IsString()
  vaccineName?: string;
}

export class UpcomingVaccinationsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Days ahead to look for upcoming vaccinations', default: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;

  @ApiPropertyOptional({ description: 'Filter by specific pet' })
  @IsOptional()
  @IsUUID()
  petId?: string;
}
