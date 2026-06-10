import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token received via email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
