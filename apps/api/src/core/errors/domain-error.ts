import { HttpException } from '@nestjs/common';
import type { Result } from '@online-school/shared';
export { ApiError as ErrorResponseDto } from '../../openapi/dtos.js';

export type DomainError = {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
};
export class AppException extends HttpException {
  constructor(readonly domain: DomainError) {
    super(domain.message, domain.status);
  }
}
export const domainError = (code: string, status: number, message = code): DomainError => ({
  code,
  status,
  message,
});
// The only application-to-Nest exception boundary. Domain services otherwise return Result.
export function fail(error: DomainError): never {
  throw new AppException(error);
}
export function unwrap<T>(result: Result<T, DomainError>): T {
  return result.ok ? result.value : fail(result.error);
}
