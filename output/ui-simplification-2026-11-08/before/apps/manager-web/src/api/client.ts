import { QueryClient } from '@tanstack/react-query';
import {
  clearPrivateSession,
  leaveSession,
  sessionSignal,
  subscribeSession,
} from '@online-school/account-ui';
import { isAuthRead, k8kEnabled } from '@online-school/ui';
import { getCsrfToken } from '@online-school/api-contracts';
import type { SchoolRequestOptions, ClientError } from '@online-school/api-contracts';
import { err } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { errorView } from './error-view.js';
import type { ApiErrorView } from './error-view.js';
import { MANAGER_ROUTES } from '../routes.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: (query) => !k8kEnabled || isAuthRead(query.queryKey),
      refetchOnReconnect: (query) => !k8kEnabled || isAuthRead(query.queryKey),
    },
    mutations: { retry: false, gcTime: 0 },
  },
});
let onUnauthorized: (() => void) | undefined;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}
subscribeSession(() => {
  void queryClient.cancelQueries({}, { silent: true });
  queryClient.clear();
});
queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== 'updated' || event.action.type !== 'error') return;
  const { data, error } = event.query.state;
  if (data !== undefined && error && 'status' in error && error.status === 403) {
    // A later transient error must never reveal data from before a denial.
    event.query.setState({ data: undefined, dataUpdatedAt: 0 });
  }
});
export const clearSession = clearPrivateSession;
type Command<T> = (options: SchoolRequestOptions) => Promise<Result<T, ClientError>>;
export function requestOptions(signal?: AbortSignal): SchoolRequestOptions {
  return {
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.any([
      sessionSignal(),
      ...(signal ? [signal] : []),
      AbortSignal.timeout(30_000),
    ]),
  };
}
function inspect<T>(
  result: Result<T, ClientError>,
  operation: 'read' | 'write' = 'read',
): Result<T, ApiErrorView> {
  if (result.ok) return result;
  if (
    result.error.status === 401 &&
    !(
      operation === 'write' &&
      ['CURRENT_PASSWORD_INVALID', 'INVALID_CREDENTIALS'].includes(result.error.code)
    )
  ) {
    if (onUnauthorized) {
      clearSession();
      onUnauthorized();
    } else leaveSession(MANAGER_ROUTES.login);
  }
  return err(errorView(result.error, operation));
}
export async function read<T>(command: Command<T>, signal?: AbortSignal): Promise<T> {
  const options = requestOptions(signal);
  if (options.signal?.aborted) return Promise.reject(discarded());
  const response = await command(options);
  if (options.signal?.aborted) return Promise.reject(discarded());
  const result = inspect(response);
  return result.ok ? result.value : Promise.reject(result.error);
}
function discarded(operation: 'read' | 'write' = 'read') {
  return errorView({ code: 'NETWORK_ERROR', status: 0, message: '' }, operation);
}
export async function write<T>(
  command: Command<T>,
  key: string,
  signal?: AbortSignal,
): Promise<Result<T, ApiErrorView>> {
  const options = requestOptions(signal);
  if (options.signal?.aborted) return err(discarded('write'));
  const token = await getCsrfToken(options);
  if (options.signal?.aborted) return err(discarded('write'));
  const csrf = inspect(token);
  if (!csrf.ok) return csrf;
  const response = await command({
    ...options,
    headers: { 'X-CSRF-Token': csrf.value.csrfToken, 'Idempotency-Key': key },
  });
  return options.signal?.aborted ? err(discarded('write')) : inspect(response, 'write');
}
