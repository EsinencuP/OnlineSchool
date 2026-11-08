import { domainError, fail } from '../../core/errors/domain-error.js';
export const MEET_LINK_REGEX = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
export const effectiveMeetLink = (
  overridden: boolean,
  local: string | null,
  inherited: string | null,
): string | null => {
  const link = overridden ? local : inherited;
  return link && MEET_LINK_REGEX.test(link) ? link : null;
};

export function redactMeet(value: unknown): unknown {
  if (typeof value === 'string')
    return value.replace(
      /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/gi,
      'https://meet.google.com/***',
    );
  if (Array.isArray(value)) return value.map(redactMeet);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactMeet(v)]));
  return value;
}

export function meetLink(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !MEET_LINK_REGEX.test(value))
    return fail(domainError('INVALID_MEET_LINK', 422));
  return value;
}
