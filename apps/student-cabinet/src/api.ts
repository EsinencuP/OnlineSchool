import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
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
export function setRedirect(handler: typeof redirect) {
  redirect = handler;
}
export function resetAccess() {
  blocked = false;
}
export function options(signal?: AbortSignal): SchoolRequestOptions {
  return {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
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
      redirect('/student/security/change-password');
    }
    return Promise.resolve(body);
  }
  const error = result.error;
  if (
    !blocked &&
    (error.status === 402 ||
      ['MUST_CHANGE_PASSWORD', 'PASSWORD_CHANGE_REQUIRED'].includes(error.code) ||
      (error.status === 401 &&
        !(allow401 && ['CURRENT_PASSWORD_INVALID', 'INVALID_CREDENTIALS'].includes(error.code))))
  ) {
    blocked = true;
    void queryClient.cancelQueries();
    queryClient.clear();
    redirect(
      ['MUST_CHANGE_PASSWORD', 'PASSWORD_CHANGE_REQUIRED'].includes(error.code)
        ? '/student/security/change-password'
        : error.status === 402
          ? '/student/suspended'
          : '/student/login',
    );
  }
  return Promise.reject(allow401 ? { ...error, operation: 'write' as const } : error);
}
export function read<T>(command: Command<T>, signal?: AbortSignal) {
  return command(options(signal)).then((result) => inspect(result));
}
export async function write<T>(command: Command<T>, key: string = crypto.randomUUID()) {
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
    : await getCsrfToken(options());
  if (!csrf.ok) return inspect<T>(csrf);
  return inspect(
    await command({
      ...options(),
      headers: { 'X-CSRF-Token': csrf.value.csrfToken, 'Idempotency-Key': key },
    }),
    true,
  );
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
  return useMutation({
    mutationFn: async (variables: V) => {
      if (unresolved.current) return Promise.reject(unresolved.current);
      try {
        return await command(variables, keyFor(variables));
      } catch (error) {
        if (describeError(error).outcome === 'unknown') unresolved.current = error;
        return Promise.reject(error);
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['student'] }),
  });
}
export function errorMessage(error: unknown) {
  return errorText(error, initializeLocale());
}
