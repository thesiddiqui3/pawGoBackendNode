import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  bankAccount: string;

  @IsString()
  @IsNotEmpty()
  bankIfsc: string;
}

export class RequestPayoutDto {
  @IsNumber()
  @Min(100)
  @Type(() => Number)
  amount: number;
}

export class AdminPayoutActionDto {
  @IsEnum(['APPROVED', 'REJECTED', 'PAID'])
  status: 'APPROVED' | 'REJECTED' | 'PAID';

  @IsString()
  @IsOptional()
  adminNote?: string;
}
