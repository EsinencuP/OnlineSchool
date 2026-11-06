import { MANAGER_CLIENT_ERROR_CODES } from '@online-school/api-contracts';
import { errorText } from '@online-school/ui';
import type { AnyManagerErrorCode } from '@online-school/api-contracts';
export type { AnyManagerErrorCode } from '@online-school/api-contracts';
export const ERROR_MESSAGES = Object.fromEntries(
  MANAGER_CLIENT_ERROR_CODES.map((code) => [code, errorText({ code }, 'ru')]),
) as Record<AnyManagerErrorCode, string>;
