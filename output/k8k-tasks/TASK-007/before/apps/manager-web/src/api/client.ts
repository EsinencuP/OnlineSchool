import { QueryClient } from '@tanstack/react-query';
import { k8kEnabled, operationalQueryInterval } from '@online-school/ui';
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
      refetchOnWindowFocus: (query) =>
        !k8kEnabled || operationalQueryInterval(query.queryKey) === false,
    },
    mutations: { retry: false, gcTime: 0 },
  },
});
let sessionController = new AbortController();
let onUnauthorized: () => void = () => {
  window.location.replace(MANAGER_ROUTES.login);
};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}
export function clearSession() {
  sessionController.abort();
  void queryClient.cancelQueries();
  queryClient.clear();
  sessionController = new AbortController();
}
type Command<T> = (options: SchoolRequestOptions) => Promise<Result<T, ClientError>>;
export function requestOptions(signal?: AbortSignal): SchoolRequestOptions {
  return {
    credentials: 'include',
    signal: AbortSignal.any([
      sessionController.signal,
      ...(signal ? [signal] : []),
      AbortSignal.timeout(30_000),
    ]),
  };
}
function inspect<T>(result: Result<T, ClientError>): Result<T, ApiErrorView> {
  if (result.ok) return result;
  if (result.error.status === 401) {
    clearSession();
    onUnauthorized();
  }
  return err(errorView(result.error));
}
export async function read<T>(command: Command<T>, signal?: AbortSignal): Promise<T> {
  const options = requestOptions(signal);
  const result = inspect(await command(options));
  if (options.signal?.aborted && result.ok)
    return Promise.reject(errorView({ code: 'NETWORK_ERROR', status: 0, message: '' }));
  return result.ok ? result.value : Promise.reject(result.error);
}
export async function write<T>(
  command: Command<T>,
  key: string,
  signal?: AbortSignal,
): Promise<Result<T, ApiErrorView>> {
  const options = requestOptions(signal);
  const csrf = inspect(await getCsrfToken(options));
  if (!csrf.ok) return csrf;
  if (options.signal?.aborted)
    return err(errorView({ code: 'NETWORK_ERROR', status: 0, message: '' }));
  const result = inspect(
    await command({
      ...options,
      headers: { 'X-CSRF-Token': csrf.value.csrfToken, 'Idempotency-Key': key },
    }),
  );
  return options.signal?.aborted && result.ok
    ? err(errorView({ code: 'NETWORK_ERROR', status: 0, message: '' }))
    : result;
}
