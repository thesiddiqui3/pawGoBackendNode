import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiResponseDto<T = unknown> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation successful' })
  message: string;

  @ApiPropertyOptional()
  data: T | null;

  @ApiPropertyOptional()
  errors: Record<string, unknown> | null;

  constructor(
    success: boolean,
    message: string,
    data: T | null = null,
    errors: Record<string, unknown> | null = null,
  ) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.errors = errors;
  }

  static success<T>(data: T, message = 'Operation successful'): ApiResponseDto<T> {
    return new ApiResponseDto<T>(true, message, data, null);
  }

  static error(
    message: string,
    errors: Record<string, unknown> | null = null,
  ): ApiResponseDto<null> {
    return new ApiResponseDto<null>(false, message, null, errors);
  }
}

export class PaginatedResponseDto<T> {
  @ApiProperty()
  data: T[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;

  @ApiProperty()
  hasPreviousPage: boolean;
}
