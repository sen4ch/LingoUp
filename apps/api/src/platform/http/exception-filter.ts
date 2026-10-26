import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { ApiError, ErrorCode } from '@lingoup/contracts';
import { ThrottlerException } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../errors.js';

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
};

/** Maps every error to the public ApiError contract. Internals never leak to clients. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const { status, body } = this.toResponse(exception, request.id);

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId: request.id, route: request.routeOptions.url },
        'Unhandled error',
      );
    }
    void reply.status(status).send(body);
  }

  private toResponse(exception: unknown, requestId: string): { status: number; body: ApiError } {
    if (exception instanceof DomainError) {
      return {
        status: exception.status,
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.details === undefined ? {} : { details: exception.details }),
            requestId,
          },
        },
      };
    }
    if (exception instanceof ThrottlerException) {
      return {
        status: 429,
        body: {
          error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down', requestId },
        },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code =
        CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED');
      return { status, body: { error: { code, message: exception.message, requestId } } };
    }
    // Fastify errors (body too large, malformed JSON) carry a statusCode.
    const fastifyStatus = (exception as { statusCode?: unknown }).statusCode;
    if (typeof fastifyStatus === 'number' && fastifyStatus >= 400 && fastifyStatus < 500) {
      const code = CODE_BY_STATUS[fastifyStatus] ?? 'VALIDATION_FAILED';
      return {
        status: fastifyStatus,
        body: { error: { code, message: (exception as Error).message, requestId } },
      };
    }
    return {
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } },
    };
  }
}
