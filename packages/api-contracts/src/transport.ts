import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';

export type SchoolRequestOptions = RequestInit & {
  baseUrl?: string;
  emptyResponse?: boolean;
  binaryResponse?: boolean;
};
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
  const { baseUrl, emptyResponse, binaryResponse, ...request } = options;
  try {
    const response = await fetch(baseUrl ? new URL(path, baseUrl) : path, {
      ...request,
      credentials: request.credentials ?? 'include',
    });
    const requestId = response.headers.get('x-request-id') ?? undefined;
    if (binaryResponse && response.ok) return ok((await response.blob()) as T);
    if (emptyResponse && response.ok) {
      const content = await response.text();
      if (!content.trim()) return ok(undefined as T);
      return err({
        code: 'INVALID_RESPONSE',
        status: response.status,
        message: 'Server returned a body for an empty response',
        ...(requestId ? { requestId } : {}),
      });
    }
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

/** The generated no-content operation uses this explicit contract; JSON endpoints stay strict. */
export function schoolEmptyFetch<T = void>(
  path: string,
  options: SchoolRequestOptions = {},
): Promise<Result<T, ClientError>> {
  return schoolFetch<T>(path, { ...options, emptyResponse: true });
}
export function schoolBlobFetch<T = Blob>(
  path: string,
  options: SchoolRequestOptions = {},
): Promise<Result<T, ClientError>> {
  return schoolFetch<T>(path, { ...options, binaryResponse: true, emptyResponse: false });
}
