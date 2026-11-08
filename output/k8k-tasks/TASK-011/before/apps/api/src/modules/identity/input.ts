import { domainError, fail } from '../../core/errors/domain-error.js';
import { UUID } from '../../core/http.js';

export function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    return fail(domainError('INVALID_INPUT', 400));
  return value as Record<string, unknown>;
}
export function string(value: unknown, min = 1, max = 200): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max)
    return fail(domainError('INVALID_INPUT', 400));
  return value.trim();
}
export function uuid(value: unknown): string {
  const id = string(value, 36, 36);
  return UUID.test(id) ? id.toLowerCase() : fail(domainError('INVALID_INPUT', 400));
}
export function email(value: unknown): string {
  const text = string(value, 3, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : fail(domainError('INVALID_INPUT', 400));
}
