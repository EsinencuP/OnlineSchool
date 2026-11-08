import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import {
  clearPrivateSession,
  leaveSession,
  sessionSignal,
  subscribeSession,
} from '@online-school/account-ui';
import {
  describeError,
  errorText,
  initializeLocale,
  k8kEnabled,
  operationalQueryInterval,
} from '@online-school/ui';
import { getCsrfToken } from '@online-school/api-contracts';
import type { ClientError, SchoolRequestOptions } from '@online-school/api-contracts';
import type { Result } from '@online-school/shared';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
});
type Command<T> = (options: SchoolRequestOptions) => Promise<Result<T, ClientError>>;
let redirect: (path: string) => void = (path) => window.location.replace(path);
let blocked = false;
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
export function setRedirect(handler: typeof redirect) {
  redirect = handler;
}
export function resetAccess() {
  blocked = false;
  clearPrivateSession();
}
export function options(signal?: AbortSignal): SchoolRequestOptions {
  return {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.any([
      sessionSignal(),
      AbortSignal.timeout(15_000),
      ...(signal ? [signal] : []),
    ]),
  };
}
export function inspect<T>(result: Result<T, ClientError>, allow401 = false): Promise<T> {
  if (result.ok) {
    const body = result.value;
    if (
      body &&
      typeof body === 'object' &&
      'mustChangePassword' in body &&
      body.mustChangePassword &&
      !blocked
    ) {
      blocked = true;
      clearPrivateSession();
      redirect('/student/security/change-password');
    }
    return Promise.resolve(body);
  }
  const error = result.error;
  const passwordRequired = ['MUST_CHANGE_PASSWORD', 'PASSWORD_CHANGE_REQUIRED'].includes(
    error.code,
  );
  if (
    error.status === 401 &&
    !passwordRequired &&
    !(allow401 && ['CURRENT_PASSWORD_INVALID', 'INVALID_CREDENTIALS'].includes(error.code))
  ) {
    leaveSession('/student/login');
  } else if (!blocked && (passwordRequired || error.status === 402)) {
    blocked = true;
    clearPrivateSession();
    redirect(passwordRequired ? '/student/security/change-password' : '/student/suspended');
  }
  return Promise.reject(allow401 ? { ...error, operation: 'write' as const } : error);
}
const discarded = { code: 'NETWORK_ERROR', status: 0, message: '' };
export async function read<T>(command: Command<T>, signal?: AbortSignal) {
  const opts = options(signal);
  if (opts.signal?.aborted) return Promise.reject(discarded);
  const result = await command(opts);
  return opts.signal?.aborted ? Promise.reject(discarded) : inspect(result);
}
export async function write<T>(
  command: Command<T>,
  key: string = crypto.randomUUID(),
  signal?: AbortSignal,
) {
  const opts = options(signal);
  const discardedWrite = { ...discarded, operation: 'write' as const };
  if (opts.signal?.aborted) return Promise.reject(discardedWrite);
  const token =
    window.location.pathname.toLowerCase().replace(/\/+$/, '') ===
    '/student/security/change-password'
      ? document.cookie
          .split(';')
          .map((s) => s.trim())
          .find((s) => s.startsWith('__Host-school_csrf='))
          ?.slice('__Host-school_csrf='.length)
      : undefined;
  const csrf = token
    ? { ok: true as const, value: { csrfToken: token } }
    : await getCsrfToken(opts);
  if (opts.signal?.aborted) return Promise.reject(discardedWrite);
  if (!csrf.ok) return inspect<T>(csrf);
  const result = await command({
    ...opts,
    headers: { 'X-CSRF-Token': csrf.value.csrfToken, 'Idempotency-Key': key },
  });
  return opts.signal?.aborted ? Promise.reject(discardedWrite) : inspect(result, true);
}
export function useStudentQuery<T>(
  key: readonly unknown[],
  command: Command<T>,
  enabled = true,
  poll: number | false = false,
) {
  const archive = key[0] === 'lessons' && key[1] === 'archive' && key[2] !== 'calendar';
  const operational =
    key[0] !== 'me' &&
    !archive &&
    (poll !== false || operationalQueryInterval(['student', ...key]) !== false);
  return useQuery({
    queryKey: ['student', ...key],
    queryFn: ({ signal }) => read(command, signal),
    enabled,
    refetchInterval: k8kEnabled && key[0] !== 'me' ? false : poll,
    refetchOnWindowFocus: k8kEnabled && operational ? false : true,
    meta: { k8kOperational: operational },
  });
}
export function useIntentKey() {
  const intent = useRef<{ body: string; key: string } | undefined>(undefined);
  return (body: unknown) => {
    const serialized = JSON.stringify(body);
    if (!intent.current || intent.current.body !== serialized)
      intent.current = { body: serialized, key: crypto.randomUUID() };
    return intent.current.key;
  };
}
export function useCommand<T, V>(command: (variables: V, key: string) => Promise<T>) {
  const client = useQueryClient();
  const keyFor = useIntentKey();
  const unresolved = useRef<unknown>(null);
  const lease = useRef(sessionSignal());
  return useMutation({
    mutationFn: async (variables: V) => {
      if (lease.current.aborted) return Promise.reject(discarded);
      if (unresolved.current) return Promise.reject(unresolved.current);
      try {
        return await command(variables, keyFor(variables));
      } catch (error) {
        if (describeError(error).outcome === 'unknown') unresolved.current = error;
        return Promise.reject(error);
      }
    },
    onSuccess: () =>
      lease.current.aborted ? undefined : client.invalidateQueries({ queryKey: ['student'] }),
  });
}
export function errorMessage(error: unknown) {
  return errorText(error, initializeLocale());
}
