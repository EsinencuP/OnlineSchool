import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';

export type SchoolRequestOptions = RequestInit & { baseUrl?: string };
export type ClientError = {
  code: string;
  status: number;
  requestId?: string;
  message: string;
  managerContacts?: { whatsapp: string; telegram: string };
};

/** Caller supplies CSRF and Idempotency-Key explicitly. This transport never retries mutations. */
export async function schoolFetch<T>(
  path: string,
  options: SchoolRequestOptions = {},
): Promise<Result<T, ClientError>> {
  const { baseUrl, ...request } = options;
  try {
    const response = await fetch(baseUrl ? new URL(path, baseUrl) : path, {
      ...request,
      credentials: request.credentials ?? 'include',
    });
    const requestId = response.headers.get('x-request-id') ?? undefined;
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return err({
        code: 'INVALID_RESPONSE',
        status: response.status,
        message: 'Server returned an invalid JSON response',
        ...(requestId ? { requestId } : {}),
      });
    }
    if (!response.ok) {
      const error = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      const contacts =
        error.code === 'ACCESS_SUSPENDED' &&
        error.managerContacts &&
        typeof error.managerContacts === 'object'
          ? (error.managerContacts as Record<string, unknown>)
          : undefined;
      return err({
        code: typeof error.code === 'string' ? error.code : 'HTTP_ERROR',
        status: response.status,
        message:
          typeof error.message === 'string'
            ? error.message
            : typeof error.detail === 'string'
              ? error.detail
              : 'Request failed',
        ...(contacts &&
        typeof contacts.whatsapp === 'string' &&
        typeof contacts.telegram === 'string'
          ? { managerContacts: { whatsapp: contacts.whatsapp, telegram: contacts.telegram } }
          : {}),
        ...(requestId ? { requestId } : {}),
      });
    }
    return ok(body as T);
  } catch {
    return err({ code: 'NETWORK_ERROR', status: 0, message: 'The server could not be reached' });
  }
}
