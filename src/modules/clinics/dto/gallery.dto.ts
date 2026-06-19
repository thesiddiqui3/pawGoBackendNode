import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadGalleryPhotoDto {
  @ApiPropertyOptional({ description: 'Caption for the photo' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;

  @ApiPropertyOptional({
    description: 'Category: exterior, waiting_area, operation_room, equipment, other',
    example: 'waiting_area',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
