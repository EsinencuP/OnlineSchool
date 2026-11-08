import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { AppException, domainError } from './domain-error.js';
import type { ErrorResponseDto } from './domain-error.js';
import type { HttpRequest, HttpResponse } from '../http.js';
import { ensureRequestId } from '../request-id/request-id.middleware.js';
import { ErrorMapper } from './error-mapper.js';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly mapper: ErrorMapper = new ErrorMapper()) {}
  catch(exception: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<HttpRequest>();
    const res = host.switchToHttp().getResponse<HttpResponse>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const code =
      (
        {
          400: 'INVALID_INPUT',
          401: 'UNAUTHENTICATED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          413: 'PAYLOAD_TOO_LARGE',
          422: 'UNPROCESSABLE_ENTITY',
        } as Record<number, string>
      )[status] ?? (status < 500 ? 'REQUEST_REJECTED' : 'INTERNAL_ERROR');
    const error = exception instanceof AppException ? exception.domain : domainError(code, status);
    if (/^\/api\/v1\/student(?:\/|$)/i.test(req.originalUrl.split('?')[0] ?? '')) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/problem+json');
        res
          .status(error.status)
          .json(this.mapper.toProblemDetails(error, req.originalUrl, ensureRequestId(req, res)));
      }
      return;
    }
    const body: ErrorResponseDto = {
      requestId: ensureRequestId(req, res),
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString(),
      ...(error.details ? { details: error.details } : {}),
    };
    if (!res.headersSent) res.status(error.status).json(body);
  }
}
