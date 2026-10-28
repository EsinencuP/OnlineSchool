import { domainError, fail } from '../../core/errors/domain-error.js';

export function meetLink(value: unknown): string | null {
  if (value === undefined) return null;
  if (
    typeof value !== 'string' ||
    !/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(value)
  )
    return fail(domainError('INVALID_MEET_LINK', 422));
  return value;
}
