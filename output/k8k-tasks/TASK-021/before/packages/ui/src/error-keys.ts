import { errorMessages } from './error-messages.js';
import type { PlainMessageKey } from './messages.js';
type ErrorKey = Extract<keyof typeof errorMessages.ru, `errors.${Uppercase<string>}`>;
type ErrorCode = ErrorKey extends `errors.${infer Code}` ? Code : never;
const codeKeys = Object.fromEntries(
  Object.keys(errorMessages.ru)
    .filter((key) => /^errors\.[A-Z_]+$/u.test(key))
    .map((key) => [key.slice('errors.'.length), key]),
) as { [Code in ErrorCode]: `errors.${Code}` };

export const errorMessageKeys = {
  ...codeKeys,
  ACCESS_SUSPENDED: 'boundaryLimited',
  MUST_CHANGE_PASSWORD: 'errors.PASSWORD_CHANGE_REQUIRED',
} satisfies Record<string, PlainMessageKey>;
