import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, errors } = this.resolveException(exception);

    this.logger.error(
      `${request.method} ${request.url} → ${statusCode}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(statusCode).json({
      success: false,
      message,
      data: null,
      errors,
    });
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    message: string;
    errors: Record<string, unknown> | null;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const res = response as Record<string, unknown>;

        // class-validator validation errors
        if (Array.isArray(res['message'])) {
          return {
            statusCode: status,
            message: 'Validation failed',
            errors: { validation: res['message'] },
          };
        }

        return {
          statusCode: status,
          message: (res['message'] as string) ?? exception.message,
          errors: null,
        };
      }

      return {
        statusCode: status,
        message: String(response),
        errors: null,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Database validation error',
        errors: null,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errors: null,
    };
  }

  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
    errors: Record<string, unknown> | null;
  } {
    switch (exception.code) {
      case 'P2002': {
        const fields = (exception.meta?.['target'] as string[]) ?? [];
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${fields.join(', ')} already exists`,
          errors: { fields },
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          errors: null,
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Related record not found',
          errors: null,
        };
      default:
        this.logger.error(`Unhandled Prisma error: ${exception.code}`);
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          errors: null,
        };
    }
  }
}
