import { errorMessageKeys } from './error-keys.js';
import { translate } from './messages.js';
import type { Locale, PlainMessageKey } from './messages.js';

export type ErrorOperation = 'read' | 'write';
export type ErrorPresentation = {
  key: PlainMessageKey;
  severity: 'error' | 'warning';
  nextAction: 'retry-read' | 'edit' | 'reconcile' | 'sign-in' | 'none';
  outcome: 'rejected' | 'unknown';
  fields: readonly string[];
};
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function describeError(error: unknown, operation?: ErrorOperation): ErrorPresentation {
  const source = record(error);
  const code = typeof source.code === 'string' ? source.code : '';
  const status = typeof source.status === 'number' ? source.status : 0;
  const command = operation === 'write' || source.operation === 'write';
  const unknown =
    command &&
    (status === 0 ||
      status >= 500 ||
      code === 'INVALID_RESPONSE' ||
      code === 'COMMAND_IN_PROGRESS');
  const details = record(source.details);
  const fields = Array.isArray(details.fields)
    ? details.fields.filter(
        (name): name is string => typeof name === 'string' && /^[a-zA-Z][\w.]{0,79}$/u.test(name),
      )
    : [];
  if (code === 'CURRENT_PASSWORD_INVALID') fields.push('currentPassword');
  if (code === 'EMAIL_ALREADY_USED') fields.push('newEmail');
  const key = unknown
    ? 'errors.unknown'
    : status === 403
      ? 'forbidden'
      : status === 401 &&
          !['CURRENT_PASSWORD_INVALID', 'INVALID_CREDENTIALS', 'OTP_INVALID'].includes(code)
        ? 'session'
        : status === 402
          ? 'boundaryLimited'
          : Object.hasOwn(errorMessageKeys, code)
            ? errorMessageKeys[code as keyof typeof errorMessageKeys]
            : 'errors.failed';
  return {
    key,
    severity: unknown ? 'warning' : 'error',
    nextAction: unknown
      ? 'reconcile'
      : status === 401 && key === 'session'
        ? 'sign-in'
        : [400, 422].includes(status) || fields.length > 0
          ? 'edit'
          : status === 403 || status === 404
            ? 'none'
            : command
              ? 'reconcile'
              : 'retry-read',
    outcome: unknown ? 'unknown' : 'rejected',
    fields: [...new Set(fields)],
  };
}
export function errorText(error: unknown, locale: Locale, operation?: ErrorOperation): string {
  return translate(locale, describeError(error, operation).key);
}
