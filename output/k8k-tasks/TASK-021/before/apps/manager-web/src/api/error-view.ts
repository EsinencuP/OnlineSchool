import type { ClientError } from '@online-school/api-contracts';
import { errorText } from '@online-school/ui';
import type { ErrorOperation } from '@online-school/ui';
export interface ApiErrorView {
  details?: Record<string, unknown>;
  operation?: ErrorOperation;
  existingId?: string;
  code: string;
  status: number;
  requestId?: string;
  message: string;
}
export function errorView(error: ClientError, operation: ErrorOperation = 'read'): ApiErrorView {
  const message = errorText(error, 'ru', operation);
  return {
    code: error.code,
    status: error.status,
    message,
    operation,
    ...(error.details ? { details: error.details } : {}),
    ...(error.requestId ? { requestId: error.requestId } : {}),
    ...(error.existingId ? { existingId: error.existingId } : {}),
  };
}
