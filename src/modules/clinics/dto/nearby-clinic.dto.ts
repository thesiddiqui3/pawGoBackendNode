import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class NearbyClinicDto {
  @ApiProperty({ example: 28.6139, description: 'Latitude of search centre' })
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 77.209, description: 'Longitude of search centre' })
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ example: 10, description: 'Search radius in km (default 10, max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(100)
  radius?: number;

  @ApiPropertyOptional({ example: 20, description: 'Max results to return' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
}
