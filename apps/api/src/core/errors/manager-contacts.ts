import type { ManagerContactsDto } from './error-mapper.js';

export function publicManagerLink(value: unknown, kind: 'whatsapp' | 'telegram'): string {
  if (typeof value !== 'string' || value !== value.trim()) return '';
  const pattern =
    kind === 'whatsapp'
      ? /^https:\/\/wa\.me\/[1-9]\d{6,14}\/?$/
      : /^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}\/?$/;
  return pattern.test(value) ? value : '';
}

export function projectManagerContacts(value: unknown): ManagerContactsDto {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    whatsapp: publicManagerLink(row.whatsapp, 'whatsapp'),
    telegram: publicManagerLink(row.telegram, 'telegram'),
    ...('displayName' in row
      ? {
          displayName:
            typeof row.displayName === 'string'
              ? row.displayName.replace(/\s+/gu, ' ').trim() || null
              : null,
        }
      : {}),
    ...('phoneE164' in row
      ? {
          phoneE164:
            typeof row.phoneE164 === 'string' &&
            /^\+[1-9]\d{6,14}$/.test(row.phoneE164) &&
            row.phoneE164 === row.phoneE164.trim()
              ? row.phoneE164
              : null,
        }
      : {}),
  };
}
