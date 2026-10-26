import { getCsrfToken } from '@online-school/api-contracts';
import type { ClientError, SchoolRequestOptions } from '@online-school/api-contracts';
import type { Result } from '@online-school/shared';

export * from '@online-school/api-contracts';
// Generated paths already include /api/v1. Cookies and WebAuthn use one origin.
export const requestOptions = (signal?: AbortSignal): SchoolRequestOptions => ({
  baseUrl: window.location.origin,
  credentials: 'same-origin',
  cache: 'no-store',
  signal: signal ?? AbortSignal.timeout(15000),
});

export async function mutation<T>(
  command: (options: SchoolRequestOptions) => Promise<Result<T, ClientError>>,
  key?: string,
): Promise<Result<T, ClientError>> {
  const csrf = await getCsrfToken(requestOptions());
  if (!csrf.ok) return csrf;
  return command({
    ...requestOptions(),
    headers: {
      'X-CSRF-Token': csrf.value.csrfToken,
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
  });
}
