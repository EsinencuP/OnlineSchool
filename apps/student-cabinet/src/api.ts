import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
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
      error.code === 'MUST_CHANGE_PASSWORD' ||
      (error.status === 401 &&
        !(allow401 && ['CURRENT_PASSWORD_INVALID', 'INVALID_CREDENTIALS'].includes(error.code))))
  ) {
    blocked = true;
    void queryClient.cancelQueries();
    queryClient.clear();
    redirect(
      error.code === 'MUST_CHANGE_PASSWORD'
        ? '/student/security/change-password'
        : error.status === 402
          ? '/student/suspended'
          : '/student/login',
    );
  }
  return Promise.reject(error);
}
export function read<T>(command: Command<T>, signal?: AbortSignal) {
  return command(options(signal)).then((result) => inspect(result));
}
export async function write<T>(command: Command<T>, key: string = crypto.randomUUID()) {
  const csrf = await getCsrfToken(options());
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
  return useQuery({
    queryKey: ['student', ...key],
    queryFn: ({ signal }) => read(command, signal),
    enabled,
    refetchInterval: poll,
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
  return useMutation({
    mutationFn: (variables: V) => command(variables, keyFor(variables)),
    onSuccess: () => client.invalidateQueries({ queryKey: ['student'] }),
  });
}
export function errorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    CURRENT_PASSWORD_INVALID: 'Текущий пароль указан неверно.',
    INVALID_CREDENTIALS: 'Проверьте email и пароль.',
    NETWORK_ERROR: 'Нет связи с сервером. Проверьте подключение и повторите попытку.',
    OTP_INVALID: 'Код не подошёл или истёк. Проверьте код либо запросите новый.',
    RESCHEDULE_TOO_LATE: 'Для переноса осталось меньше 24 часов. Свяжитесь с менеджером.',
    RESCHEDULE_WINDOW_CLOSED: 'Для переноса осталось меньше 24 часов. Свяжитесь с менеджером.',
    INVALID_FILE: 'Выбери непустой файл размером до 50 МБ. Можно приложить до 20 файлов.',
    UPLOAD_EXPIRED: 'Ссылка на загрузку истекла. Выбери файл заново.',
    UPLOAD_FAILED: 'Не удалось загрузить файл. Повтори загрузку.',
  };
  return messages[code] ?? 'Не удалось выполнить запрос. Повторите попытку.';
}
