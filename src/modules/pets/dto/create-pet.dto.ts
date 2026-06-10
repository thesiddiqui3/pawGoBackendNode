import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PetGender, PetSpecies } from '../../../common/enums/pet.enum';

export class CreatePetDto {
  @ApiProperty({ example: 'Bruno' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: PetSpecies, example: PetSpecies.DOG })
  @IsEnum(PetSpecies)
  species: PetSpecies;

  @ApiProperty({ example: 'Labrador' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  breed: string;

  @ApiProperty({ enum: PetGender, example: PetGender.MALE })
  @IsEnum(PetGender)
  gender: PetGender;

  @ApiPropertyOptional({ example: '2024-05-01', type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date;

  @ApiPropertyOptional({ example: 12.5, description: 'Weight in kg' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(500)
  weight?: number;

  @ApiPropertyOptional({ example: 'Golden' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  color?: string;

  @ApiPropertyOptional({ example: '953000012345678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  microchipNumber?: string;

  @ApiPropertyOptional({ example: 'Loves to swim' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
