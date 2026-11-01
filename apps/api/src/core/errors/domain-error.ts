// Compatibility boundary: preserve exception constructor identity across API and worker.
export { AppException, domainError, fail, unwrap } from '@online-school/server-kernel';
export type { DomainError } from '@online-school/server-kernel';
export { ApiError as ErrorResponseDto } from '../../openapi/dtos.js';
