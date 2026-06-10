import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PetGender } from '../../../common/enums/pet.enum';

export class UpdatePetDto {
  @ApiPropertyOptional({ example: 'Buddy' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Golden Retriever' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  breed?: string;

  @ApiPropertyOptional({ enum: PetGender })
  @IsOptional()
  @IsEnum(PetGender)
  gender?: PetGender;

  @ApiPropertyOptional({ example: '2024-05-01', type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date;

  @ApiPropertyOptional({ example: 14.0 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(500)
  weight?: number;

  @ApiPropertyOptional({ example: 'Cream' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  microchipNumber?: string;

  @ApiPropertyOptional({ example: 'Allergic to chicken' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
