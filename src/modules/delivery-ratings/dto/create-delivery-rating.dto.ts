import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateDeliveryRatingDto {
  @IsUUID()
  assignmentId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  review?: string;
}
