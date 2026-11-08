import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
import { leaveSession, sessionSignal, verifySessionOutcome } from './session.js';
export {
  announceSessionChange,
  clearPrivateSession,
  leaveSession,
  sessionSignal,
  subscribeSession,
  SessionExitBoundary,
} from './session.js';

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
  signal: AbortSignal.any([
    sessionSignal(),
    AbortSignal.timeout(15000),
    ...(signal ? [signal] : []),
  ]),
});
export async function mutation<T>(
  command: (options: SchoolRequestOptions) => Promise<Result<T, ClientError>>,
) {
  const options = requestOptions();
  const expired = { ok: false as const, error: { code: 'NETWORK_ERROR', status: 0, message: '' } };
  if (options.signal?.aborted) return expired;
  const csrf = await getCsrfToken(options);
  if (options.signal?.aborted) return expired;
  if (!csrf.ok) return csrf;
  const result = await command({ ...options, headers: { 'X-CSRF-Token': csrf.value.csrfToken } });
  return options.signal?.aborted ? expired : result;
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
type AccountError = 'account.switchFailed' | 'account.logoutFailed';
function unknownOutcome(status: number) {
  return status === 0 || status >= 500;
}
async function logoutAccount(): Promise<AccountLogoutOutcome> {
  const result = await mutation((o) => deleteSession({}, o));
  if (result.ok || result.error.status === 401) return 'ended';
  return unknownOutcome(result.error.status) || result.error.code === 'INVALID_RESPONSE'
    ? 'unknown'
    : 'rejected';
}
export function AccountMenu({
  name,
  role,
  onLogout,
  logoutPath = '/account',
  links,
}: {
  name: string;
  role: string;
  onLogout?: () => Promise<AccountLogoutOutcome>;
  logoutPath?: string;
  links?: ReactNode;
}) {
  const { locale, t } = useLocale();
  const roleName = accountRoleLabel(locale, role);
  const [accounts, setAccounts] = useState<AccountList | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [pending, setPending] = useState<'switch' | 'logout' | null>(null);
  const [error, setError] = useState<AccountError | null>(null);
  const inFlight = useRef(false);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    const lease = sessionSignal();
    void getAccounts(abort.signal).then((result) => {
      if (abort.signal.aborted || lease.aborted) return;
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
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  async function change(key: string) {
    const lease = sessionSignal();
    if (inFlight.current || lease.aborted) return;
    inFlight.current = true;
    setPending('switch');
    setError(null);
    const result = await mutation((o) =>
      switchDemoUser({ key: key as Parameters<typeof switchDemoUser>[0]['key'] }, o),
    );
    if (lease.aborted) return;
    if (result.ok && Object.values(homes).includes(result.value.home))
      return leaveSession(result.value.home);
    if (!result.ok && result.error.status === 401) return leaveSession('/account');
    if (
      result.ok ||
      unknownOutcome(result.error.status) ||
      result.error.code === 'INVALID_RESPONSE'
    )
      return verifySessionOutcome();
    inFlight.current = false;
    setError('account.switchFailed');
    setPending(null);
  }
  async function logout() {
    const lease = sessionSignal();
    if (inFlight.current || lease.aborted) return;
    inFlight.current = true;
    setPending('logout');
    setError(null);
    const outcome = await (onLogout ?? logoutAccount)().catch(() => 'unknown' as const);
    if (lease.aborted) return;
    if (outcome === 'ended') return leaveSession(logoutPath);
    if (outcome === 'unknown') return verifySessionOutcome();
    inFlight.current = false;
    setError('account.logoutFailed');
    setPending(null);
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
                  disabled={pending !== null || accounts.currentKey === a.key}
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
        {links}
        <a className="account-login-link" href="/account">
          {t('account.signInAnother')}
        </a>
        <button
          type="button"
          className="account-logout"
          disabled={pending !== null}
          onClick={() => void logout()}
        >
          {t('account.logout')}
        </button>
      </div>
    </details>
  );
}
