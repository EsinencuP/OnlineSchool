import { useEffect, useRef, useState } from 'react';
import {
  deleteSession,
  getCsrfToken,
  getPlatformAccounts,
  switchDemoUser,
} from '@online-school/api-contracts';
import type { ClientError, SchoolRequestOptions } from '@online-school/api-contracts';
import type { Result } from '@online-school/shared';
import { LanguageSelector, translate, useLocale } from '@online-school/ui';
import type { CabinetRole, Locale, PlainMessageKey } from '@online-school/ui';

const roleKeys = {
  STUDENT: 'account.role.STUDENT',
  TEACHER: 'account.role.TEACHER',
  MANAGER: 'account.role.MANAGER',
  DIRECTOR: 'account.role.DIRECTOR',
  TECH_OPERATOR: 'account.role.TECH_OPERATOR',
} as const satisfies Record<CabinetRole, PlainMessageKey>;
export function accountRoleLabel(locale: Locale, role: string) {
  return translate(
    locale,
    Object.hasOwn(roleKeys, role) ? roleKeys[role as CabinetRole] : 'account.role.unknown',
  );
}
export const roleLabels: Record<string, string> = Object.fromEntries(
  Object.entries(roleKeys).map(([role, key]) => [role, translate('ru', key)]),
);
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
export type AccountLogoutOutcome = 'ended' | 'rejected' | 'unknown';
type AccountError = 'account.switchFailed' | 'account.logoutFailed' | 'account.unknownOutcome';
function unknownOutcome(status: number) {
  return status === 0 || status >= 500;
}
async function logoutAccount(): Promise<AccountLogoutOutcome> {
  const result = await mutation((o) => deleteSession({}, o));
  if (result.ok || result.error.status === 401) return 'ended';
  return unknownOutcome(result.error.status) ? 'unknown' : 'rejected';
}
export function AccountMenu({
  name,
  role,
  onLogout,
}: {
  name: string;
  role: string;
  onLogout?: () => Promise<AccountLogoutOutcome>;
}) {
  const { locale, t } = useLocale();
  const roleName = accountRoleLabel(locale, role);
  const [accounts, setAccounts] = useState<AccountList | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [pending, setPending] = useState<'switch' | 'logout' | null>(null);
  const [error, setError] = useState<AccountError | null>(null);
  const blocked = pending !== null || error === 'account.unknownOutcome';
  const details = useRef<HTMLDetailsElement>(null);
  const sessionChannel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    const channel =
      typeof BroadcastChannel === 'function' ? new BroadcastChannel('school-account') : null;
    sessionChannel.current = channel;
    if (channel) channel.onmessage = () => window.location.replace('/');
    void getAccounts(abort.signal).then((result) => {
      if (abort.signal.aborted) return;
      if (result.ok) setAccounts(result.value);
      else setCatalogFailed(true);
    });
    const outside = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node))
        details.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      const menu = details.current;
      if (event.key === 'Escape' && menu?.open && menu.contains(event.target as Node)) {
        event.preventDefault();
        event.stopPropagation();
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      abort.abort();
      sessionChannel.current = null;
      channel?.close();
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  function announceSessionEnd() {
    // The sending channel does not receive its own event.
    sessionChannel.current?.postMessage('session-replaced');
  }
  async function change(key: string) {
    if (blocked) return;
    setPending('switch');
    setError(null);
    const result = await mutation((o) =>
      switchDemoUser({ key: key as Parameters<typeof switchDemoUser>[0]['key'] }, o),
    );
    if (result.ok && Object.values(homes).includes(result.value.home)) {
      announceSessionEnd();
      // Full navigation discards every role's cached queries and in-memory forms.
      window.location.replace(result.value.home);
    } else if (!result.ok && result.error.status === 401) {
      announceSessionEnd();
      window.location.replace('/account');
    } else {
      setError(
        result.ok || unknownOutcome(result.error.status)
          ? 'account.unknownOutcome'
          : 'account.switchFailed',
      );
      setPending(null);
    }
  }
  async function logout() {
    if (blocked) return;
    setPending('logout');
    setError(null);
    const outcome = await (onLogout ?? logoutAccount)().catch(() => 'unknown' as const);
    if (outcome === 'ended') {
      announceSessionEnd();
      if (!onLogout) window.location.replace('/account');
    } else {
      setError(outcome === 'unknown' ? 'account.unknownOutcome' : 'account.logoutFailed');
      setPending(null);
    }
  }
  return (
    <details className="account-menu" ref={details}>
      <summary>
        <span className="account-avatar" aria-hidden="true">
          {name.replace('[ДЕМО] ', '').slice(0, 1)}
        </span>
        <span className="account-caption">
          {name} <small>{roleName}</small>
        </span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="account-popover">
        <strong>{t('account.heading')}</strong>
        <p>
          {name} · {roleName}
        </p>
        <LanguageSelector />
        {!accounts ? (
          <p role="status">{t(catalogFailed ? 'account.catalogUnavailable' : 'loading')}</p>
        ) : accounts.enabled && accounts.items.length > 0 ? (
          <>
            <h2>{t('account.switchUser')}</h2>
            <p className="account-hint">{t('account.demoHint')}</p>
            <div className="account-choices">
              {accounts.items.map((a) => (
                <button
                  type="button"
                  key={a.key}
                  disabled={blocked || accounts.currentKey === a.key}
                  onClick={() => void change(a.key)}
                  aria-current={accounts.currentKey === a.key ? 'true' : undefined}
                >
                  <span>
                    {a.name}
                    <small>{accountRoleLabel(locale, a.role)}</small>
                  </span>
                  <span aria-hidden="true">{accounts.currentKey === a.key ? '✓' : '→'}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        {pending && (
          <p role="status">{t(pending === 'logout' ? 'account.loggingOut' : 'auth.opening')}</p>
        )}
        {error && <p role="alert">{t(error)}</p>}
        <a
          className="account-login-link"
          href={error === 'account.unknownOutcome' ? '/' : '/account'}
        >
          {t(
            error === 'account.unknownOutcome' ? 'account.verifySession' : 'account.signInAnother',
          )}
        </a>
        <button
          type="button"
          className="account-logout"
          disabled={blocked}
          onClick={() => void logout()}
        >
          {t('account.logout')}
        </button>
      </div>
    </details>
  );
}
