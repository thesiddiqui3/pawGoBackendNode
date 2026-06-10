import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadGalleryImageDto {
  @ApiPropertyOptional({ example: 'Playing in the park', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}
