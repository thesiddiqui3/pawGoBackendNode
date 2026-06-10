import { PaginatedResponseDto } from '../dto/api-response.dto';
import { DEFAULT_LIMIT, DEFAULT_PAGE } from '../constants';

export interface PaginationParams {
  page?: number;
  limit?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

export function getPaginationMeta(params: PaginationParams): PaginationMeta {
  const page = Math.max(1, params.page ?? DEFAULT_PAGE);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? params.limit ?? DEFAULT_LIMIT));
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponseDto<T> {
  const totalPages = Math.ceil(total / pageSize);
  return {
    data: items,
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
