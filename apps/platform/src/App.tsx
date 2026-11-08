import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createSession, currentSession } from '@online-school/api-contracts';
import type { SessionResponse } from '@online-school/api-contracts';
import {
  accountRoleLabel,
  getAccounts,
  leaveSession,
  mutation,
  requestOptions,
  roleHome,
  sessionSignal,
} from '@online-school/account-ui';
import type { DemoAccount } from '@online-school/account-ui';
import { LanguageSelector, useLocale } from '@online-school/ui';
import { StaffCabinet } from './staff/StaffCabinet.js';

const demoRoles = ['STUDENT', 'TEACHER', 'MANAGER', 'DIRECTOR', 'TECH_OPERATOR'] as const;
type LoginError =
  | 'auth.verificationRequired'
  | 'auth.failed'
  | 'auth.credentials'
  | 'auth.rateLimited'
  | 'auth.tryAgain';
type LoginField = 'email' | 'password';

function Login() {
  const { locale, t } = useLocale();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [email, setEmail] = useState('tamara.demo@onlineschool.test');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [validation, setValidation] = useState<{
    field: LoginField;
    emailMismatch: boolean;
  } | null>(null);
  function invalid(event: FormEvent<HTMLInputElement>, field: LoginField) {
    event.preventDefault();
    const input = event.currentTarget;
    if (input.form?.querySelector('input:invalid') !== input) return;
    setValidation({ field, emailMismatch: input.validity.typeMismatch });
    input.focus();
  }
  function clearValidation(field: LoginField) {
    setValidation((current) => (current?.field === field ? null : current));
  }
  const validationMessage = (field: LoginField) =>
    validation?.field === field && (
      <span id={`login-${field}-validation`} className="error" role="alert">
        {validation.emailMismatch
          ? t('validation.email')
          : t('validation.required', {
              label: t(field === 'email' ? 'auth.login' : 'auth.password'),
            })}
      </span>
    );
  useEffect(() => {
    const abort = new AbortController();
    void getAccounts(abort.signal).then((r) => {
      if (!abort.signal.aborted && r.ok) setAccounts(r.value.items);
    });
    return () => abort.abort();
  }, []);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const password = String(new FormData(form).get('password') ?? '');
    setBusy(true);
    setError(null);
    setValidation(null);
    const result = await mutation((o) => createSession({ method: 'password', email, password }, o));
    if (result.ok && 'account' in result.value) {
      form.reset();
      if (
        result.value.recovery_only ||
        !(
          result.value.mfa_completed ||
          result.value.password_only ||
          result.value.manager_password_only ||
          result.value.account.kind === 'STUDENT'
        )
      ) {
        setError('auth.verificationRequired');
        setBusy(false);
        return;
      }
      const role = result.value.account.roles[0] ?? '';
      const home = roleHome(role);
      const returnToStaff =
        (role === 'TEACHER' || role === 'DIRECTOR' || role === 'TECH_OPERATOR') &&
        window.location.pathname.replace(/\/+$/, '') === home;
      leaveSession(returnToStaff ? home + window.location.search : home);
    } else {
      setError(
        result.ok
          ? 'auth.failed'
          : result.error.status === 401
            ? 'auth.credentials'
            : result.error.status === 429
              ? 'auth.rateLimited'
              : 'auth.tryAgain',
      );
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="login-form">
        <a className="brand" href="/">
          K8K Academy
        </a>
        <h1>{t('auth.welcome')}</h1>
        <form onSubmit={(e) => void login(e)}>
          <LanguageSelector />
          <fieldset disabled={busy}>
            {accounts.length > 0 && (
              <label>
                {t('auth.demoUser')}
                <select
                  aria-label={t('auth.demoUser')}
                  value={accounts.find((a) => a.login === email)?.login ?? ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setEmail(e.target.value);
                      clearValidation('email');
                    }
                  }}
                >
                  <option value="">{t('auth.otherAccount')}</option>
                  {demoRoles.map((role) => (
                    <optgroup key={role} label={accountRoleLabel(locale, role)}>
                      {accounts
                        .filter((a) => a.role === role)
                        .map((a) => (
                          <option key={a.key} value={a.login}>
                            {a.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
            <label>
              {t('auth.login')}
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                maxLength={254}
                value={email}
                aria-invalid={validation?.field === 'email' || undefined}
                aria-describedby={
                  validation?.field === 'email' ? 'login-email-validation' : undefined
                }
                onInvalid={(event) => invalid(event, 'email')}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearValidation('email');
                }}
              />
            </label>
            {validationMessage('email')}
            <label>
              {t('auth.password')}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                aria-invalid={validation?.field === 'password' || undefined}
                aria-describedby={
                  validation?.field === 'password' ? 'login-password-validation' : undefined
                }
                onInvalid={(event) => invalid(event, 'password')}
                onInput={() => clearValidation('password')}
              />
            </label>
            {validationMessage('password')}
            {error && (
              <p role="alert" className="error">
                {t(error)}
              </p>
            )}
            <button className="primary" type="submit">
              {t(busy ? 'auth.signingIn' : 'auth.signIn')}
            </button>
          </fieldset>
        </form>
        {accounts.length > 0 && <p className="login-help">{t('auth.switchHelp')}</p>}
      </section>
    </main>
  );
}
export function App() {
  const { t } = useLocale();
  const title = `Academy · ${t('auth.cabinet')}`;
  useEffect(() => {
    document.title = title;
  }, [title]);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [verification, setVerification] = useState(false);
  useEffect(() => {
    if (window.location.pathname === '/account') {
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    const lease = sessionSignal();
    void currentSession(requestOptions(abort.signal)).then((r) => {
      if (abort.signal.aborted || lease.aborted) return;
      if (r.ok) {
        const role = r.value.account.roles[0] ?? '';
        const home = roleHome(role);
        if (
          role !== 'STUDENT' &&
          role !== 'MANAGER' &&
          (r.value.recovery_only || !(r.value.mfa_completed || r.value.password_only))
        ) {
          setVerification(true);
          setLoading(false);
          return;
        }
        if (
          role === 'STUDENT' ||
          role === 'MANAGER' ||
          (home !== '/' &&
            window.location.pathname.replace(/\/+$/, '') !== home &&
            !window.location.pathname.startsWith(home + '/'))
        ) {
          window.location.replace(home);
          return;
        }
        setSession(r.value);
      } else if (r.error.status !== 401) setError(true);
      setLoading(false);
    });
    return () => abort.abort();
  }, []);
  if (loading)
    return (
      <main className="boot" role="status">
        {t('auth.opening')}
      </main>
    );
  if (error)
    return (
      <main className="boot">
        <h1>{t('auth.connectionFailed')}</h1>
        <p>{t('auth.connectionHelp')}</p>
        <button onClick={() => window.location.reload()}>{t('auth.retry')}</button>
      </main>
    );
  if (verification)
    return (
      <main className="boot">
        <p role="alert">{t('auth.verificationRequired')}</p>
        <a href="/account">{t('account.signInAnother')}</a>
      </main>
    );
  const role = session?.account.roles[0];
  return session && (role === 'TEACHER' || role === 'DIRECTOR' || role === 'TECH_OPERATOR') ? (
    <StaffCabinet session={session} role={role} />
  ) : (
    <Login />
  );
}
