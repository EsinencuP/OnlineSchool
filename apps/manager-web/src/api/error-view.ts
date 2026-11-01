import type { ClientError } from '@online-school/api-contracts';
import { ERROR_MESSAGES } from '../i18n/error-messages.js';
import { ru } from '../i18n/ru.js';
export interface ApiErrorView {
  code: string;
  status: number;
  requestId?: string;
  message: string;
}
export function errorView(error: ClientError): ApiErrorView {
  const message = Object.hasOwn(ERROR_MESSAGES, error.code)
    ? ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES]
    : ru.error;
  return {
    code: error.code,
    status: error.status,
    message,
    ...(error.requestId ? { requestId: error.requestId } : {}),
  };
}
