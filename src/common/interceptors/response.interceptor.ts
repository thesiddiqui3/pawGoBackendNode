import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '../dto/api-response.dto';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponseDto<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseDto<T>> {
    return next.handle().pipe(
      map((data) => {
        // If the controller already returned an ApiResponseDto, pass it through unchanged
        if (data instanceof ApiResponseDto) {
          return data;
        }

        // Wrap plain data in a standard success envelope
        return ApiResponseDto.success(data ?? null);
      }),
    );
  }
}
