import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyReviewDto {
  @ApiProperty({ example: 'Thank you for your feedback! We look forward to seeing you again.' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reply: string;
}
