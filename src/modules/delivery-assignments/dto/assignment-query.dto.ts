import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { DeliveryStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class AssignmentQueryDto extends PaginationDto {
  @IsEnum(DeliveryStatus)
  @IsOptional()
  status?: DeliveryStatus;

  @IsDateString()
  @IsOptional()
  date?: string;
}
