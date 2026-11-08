import { useEffect, useRef, useState } from 'react';
import {
  deleteSession,
  getCsrfToken,
  getPlatformAccounts,
  switchDemoUser,
} from '@online-school/api-contracts';
import type { ClientError, SchoolRequestOptions } from '@online-school/api-contracts';
import type { Result } from '@online-school/shared';

export const roleLabels: Record<string, string> = {
  STUDENT: 'Ученик',
  TEACHER: 'Преподаватель',
  MANAGER: 'Менеджер',
  DIRECTOR: 'Руководитель',
  TECH_OPERATOR: 'Технический оператор',
};
const homes: Record<string, string> = {
  STUDENT: '/student',
  TEACHER: '/teacher',
  MANAGER: '/manager',
  DIRECTOR: '/director',
  TECH_OPERATOR: '/operator',
};
export const roleHome = (role: string) => homes[role] ?? '/';
export const requestOptions = (signal?: AbortSignal): SchoolRequestOptions => ({
  credentials: 'same-origin',
  cache: 'no-store',
  signal: signal ?? AbortSignal.timeout(15000),
});
export async function mutation<T>(
  command: (options: SchoolRequestOptions) => Promise<Result<T, ClientError>>,
) {
  const csrf = await getCsrfToken(requestOptions());
  if (!csrf.ok) return csrf;
  return command({ ...requestOptions(), headers: { 'X-CSRF-Token': csrf.value.csrfToken } });
}
export interface DemoAccount {
  key: string;
  name: string;
  role: string;
  login: string;
  home: string;
}
export interface AccountList {
  enabled: boolean;
  currentKey: string | null;
  items: DemoAccount[];
}
export const getAccounts = (signal?: AbortSignal) => getPlatformAccounts(requestOptions(signal));
export function AccountMenu({ name, role }: { name: string; role: string }) {
  const [accounts, setAccounts] = useState<AccountList | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    const channel =
      typeof BroadcastChannel === 'function' ? new BroadcastChannel('school-account') : null;
    if (channel) channel.onmessage = () => window.location.replace('/');
    void getAccounts(abort.signal).then((result) => {
      if (!abort.signal.aborted && result.ok) setAccounts(result.value);
    });
    const outside = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node))
        details.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && details.current?.open) {
        details.current.open = false;
        details.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      abort.abort();
      channel?.close();
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  async function change(key: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await mutation((o) =>
      switchDemoUser({ key: key as Parameters<typeof switchDemoUser>[0]['key'] }, o),
    );
    if (result.ok && Object.values(homes).includes(result.value.home)) {
      if (typeof BroadcastChannel === 'function') {
        const channel = new BroadcastChannel('school-account');
        channel.postMessage('session-replaced');
        channel.close();
      }
      // Full navigation discards every role's cached queries and in-memory forms.
      window.location.replace(result.value.home);
    } else {
      setError(
        result.ok
          ? 'Не удалось открыть кабинет.'
          : result.error.status === 401
            ? 'Сессия истекла. Войдите заново.'
            : 'Не удалось сменить пользователя. Попробуйте ещё раз.',
      );
      setBusy(false);
    }
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await mutation((o) => deleteSession({}, o));
    if (result.ok || result.error.status === 401) {
      if (typeof BroadcastChannel === 'function') {
        const channel = new BroadcastChannel('school-account');
        channel.postMessage('session-replaced');
        channel.close();
      }
      window.location.replace('/account');
    } else {
      setError('Не удалось выйти. Попробуйте ещё раз.');
      setBusy(false);
    }
  }
  return (
    <details className="account-menu" ref={details}>
      <summary>
        <span className="account-avatar" aria-hidden="true">
          {name.replace('[ДЕМО] ', '').slice(0, 1)}
        </span>
        <span className="account-caption">
          {name} <small>{roleLabels[role] ?? role}</small>
        </span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="account-popover">
        <strong>Аккаунт</strong>
        <p>
          {name} · {roleLabels[role]}
        </p>
        <h2>Сменить пользователя</h2>
        {accounts?.enabled ? (
          <>
            <p className="account-hint">
              Тестовая школа · роль и кабинет изменятся вместе с пользователем.
            </p>
            <div className="account-choices">
              {accounts.items.map((a) => (
                <button
                  type="button"
                  key={a.key}
                  disabled={busy || accounts.currentKey === a.key}
                  onClick={() => void change(a.key)}
                  aria-current={accounts.currentKey === a.key ? 'true' : undefined}
                >
                  <span>
                    {a.name}
                    <small>{roleLabels[a.role]}</small>
                  </span>
                  <span aria-hidden="true">{accounts.currentKey === a.key ? '✓' : '→'}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p>
            Для другого аккаунта <a href="/account">войдите с его логином и паролем</a>.
          </p>
        )}
        {busy && <p role="status">Открываем кабинет…</p>}
        {error && (
          <p role="alert">
            {error} <a href="/account">Войти</a>
          </p>
        )}
        <a className="account-login-link" href="/account">
          Войти в другой аккаунт по паролю
        </a>
        <button
          type="button"
          className="account-logout"
          disabled={busy}
          onClick={() => void logout()}
        >
          Выйти из аккаунта
        </button>
      </div>
    </details>
  );
}
