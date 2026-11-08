import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useRef } from 'react';
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
  isAuthRead,
} from '@online-school/ui';
import { getCsrfToken } from '@online-school/api-contracts';
import type { ClientError, SchoolRequestOptions } from '@online-school/api-contracts';
import type { Result } from '@online-school/shared';
import { rememberMeetRead } from './student-presentation.js';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
});
const financialRead = 'subscription-financial';
export function subscriptionReadKey(subscriptionId?: string) {
  return [financialRead, subscriptionId ?? null] as const;
}
export function isForbiddenRead(error: Error | null) {
  return !!error && 'status' in error && error.status === 403;
}
export const StudentDeadlineRead = createContext<(reason: 'deadline', dueAt: number) => void>(
  () => {},
);
type Command<T> = (options: SchoolRequestOptions) => Promise<Result<T, ClientError>>;
let redirect: (path: string) => void = (path) => window.location.replace(path);
let blocked = false;
subscribeSession(() => {
  void queryClient.cancelQueries({}, { silent: true });
  queryClient.clear();
});
queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== 'updated' || event.action.type !== 'error') return;
  const { query } = event;
  const { error } = query.state;
  if (!isForbiddenRead(error)) return;
  if (['unread', 'notifications-preview', 'notifications'].includes(String(query.queryKey[1]))) {
    const filter = {
      predicate: (candidate: { queryKey: readonly unknown[] }) =>
        candidate.queryKey[0] === 'student' &&
        ['unread', 'notifications-preview', 'notifications'].includes(
          String(candidate.queryKey[1]),
        ),
    };
    void queryClient.cancelQueries(filter, { silent: true, revert: false });
    for (const sibling of queryClient.getQueryCache().findAll(filter))
      sibling.setState({
        data: undefined,
        dataUpdatedAt: 0,
        error,
        status: 'error',
        fetchStatus: 'idle',
      });
    return;
  }
  if (
    query.queryKey[1] === financialRead ||
    query.queryKey[1] === 'lesson-history' ||
    query.queryKey[1] === 'materials'
  ) {
    const filter = {
      queryKey: query.queryKey.slice(0, query.queryKey[1] === financialRead ? 3 : 2),
    };
    void queryClient.cancelQueries(filter, { silent: true, revert: false });
    for (const sibling of queryClient.getQueryCache().findAll(filter)) {
      sibling.setState({
        data: undefined,
        dataUpdatedAt: 0,
        error,
        status: 'error',
        fetchStatus: 'idle',
      });
    }
  } else if (query.state.data !== undefined) {
    // A later transient error must never reveal data from before a denial.
    query.setState({ data: undefined, dataUpdatedAt: 0 });
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
  const queryKey = ['student', ...key];
  const lessonRead = ['dashboard', 'upcoming', 'lessons', 'lesson'].some((kind) => key[0] === kind);
  const profileRead = isAuthRead(queryKey);
  const automatic = !k8kEnabled || profileRead;
  const revalidateOnMount =
    lessonRead ||
    key[0] === 'lesson-history' ||
    key[0] === 'lesson-homework' ||
    key[0] === 'lesson-materials' ||
    key[0] === 'homework-detail' ||
    key[0] === 'skills' ||
    key[0] === 'skill-history' ||
    key[0] === 'snapshots' ||
    key[0] === 'reports' ||
    key[0] === 'report-detail' ||
    key[0] === financialRead ||
    (k8kEnabled && key[0] === 'subjects');
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const startedAt = performance.now();
      const data = await read(command, signal);
      if (lessonRead) rememberMeetRead(data, startedAt, performance.now());
      return data;
    },
    enabled,
    structuralSharing: !lessonRead,
    refetchOnMount: revalidateOnMount ? 'always' : true,
    refetchInterval: automatic ? poll : false,
    refetchOnWindowFocus: profileRead ? 'always' : automatic,
    refetchOnReconnect: profileRead ? 'always' : automatic,
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
