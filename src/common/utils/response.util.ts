import { ApiResponseDto } from '../dto/api-response.dto';

export function successResponse<T>(
  data: T,
  message = 'Operation successful',
): ApiResponseDto<T> {
  return ApiResponseDto.success(data, message);
}

export function errorResponse(
  message: string,
  errors: Record<string, unknown> | null = null,
): ApiResponseDto<null> {
  return ApiResponseDto.error(message, errors);
}
