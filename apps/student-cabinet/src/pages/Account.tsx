import { useEffect, useRef, useState } from 'react';
import {
  announceSessionChange,
  sessionSignal,
  leaveSession,
  verifySessionOutcome,
} from '@online-school/account-ui';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  deleteSession,
  changeStudentPassword,
  confirmStudentEmailChange,
  createSession,
  getStudentMe,
  getStudentSessions,
  requestStudentEmailChange,
  revokeStudentSession,
  updateStudentProfile,
} from '@online-school/api-contracts';
import { queryClient, read, resetAccess, useCommand, useStudentQuery, write } from '../api.js';
import { ErrorNotice, Panel, QueryState } from '../components.js';
import { useMe } from '../Layout.js';
import {
  k8kEnabled,
  Icon as UIIcon,
  Button,
  Card,
  Field,
  LanguageSelector,
  useDataAge,
  ErrorForm,
  describeError,
} from '@online-school/ui';
import { StudentManagerCard } from '../student-widgets.js';
import { useStudentLocale } from '../student-locale.js';
import { formatStudentDate } from '../student-presentation.js';
import { useStudentCopy } from '../student-copy.js';
function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
function useSecretCommand(rotatesSession = false) {
  const [error, setError] = useState<unknown>(null);
  const [isPending, setPending] = useState(false);
  const pending = useRef(false);
  const unresolved = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [unknown, setUnknown] = useState(false);

  async function run<T>(command: () => Promise<T>) {
    const lease = sessionSignal();
    if (pending.current || unresolved.current || lease.aborted) return;
    pending.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await command();
      if (lease.aborted || !mounted.current) return;
      return result;
    } catch (error) {
      if (lease.aborted || !mounted.current) return;
      unresolved.current = describeError(error, 'write').outcome === 'unknown';
      setUnknown(unresolved.current);
      setError(error);
      if (unresolved.current && rotatesSession) verifySessionOutcome();
    } finally {
      pending.current = false;
      if (!lease.aborted && mounted.current) setPending(false);
    }
  }

  return { run, error, isPending, unknown };
}
export function Login() {
  const { t } = useStudentLocale();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [bootstrapError, setBootstrapError] = useState<unknown>(null);
  const login = useSecretCommand(true);
  async function submit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget,
      data = formValues(event);
    if (busy) return;
    setBusy(true);
    setBootstrapError(null);
    try {
      const session = await login.run(() =>
        write((o) =>
          createSession(
            {
              method: 'password',
              email: String(data.get('email')),
              password: String(data.get('password')),
            },
            o,
          ),
        ),
      );
      if (!session) return;
      form.reset();
      resetAccess();
      announceSessionChange();
      const me = await read(getStudentMe);
      navigate(
        me.mustChangePassword
          ? '/student/security/change-password'
          : me.hasActiveAccess
            ? '/student'
            : '/student/suspended',
        { replace: true },
      );
    } catch (error) {
      setBootstrapError(error);
    } finally {
      clearSecrets(form);
      setBusy(false);
    }
  }
  return (
    <main className="standalone k8k-account-standalone">
      <section className="panel auth-card">
        <h1>{t('auth.welcome')}</h1>
        <p className="muted">{t('auth.studentPrompt')}</p>
        <LanguageSelector />
        <ErrorForm
          error={bootstrapError ?? login.error}
          busy={busy}
          onSubmit={(e) => void submit(e)}
        >
          <fieldset disabled={busy || login.unknown}>
            <Field
              label={t('auth.email')}
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
            />
            <Field
              label={t('auth.password')}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
            <ErrorNotice error={bootstrapError ?? login.error} />
            <button className="primary" type="submit">
              {t(busy ? 'auth.signingIn' : 'auth.enter')}
            </button>
          </fieldset>
        </ErrorForm>
      </section>
    </main>
  );
}
export function ChangePassword() {
  const { t } = useStudentLocale();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [bootstrapError, setBootstrapError] = useState<unknown>(null);
  const change = useSecretCommand(true);
  const [mismatch, setMismatch] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget,
      data = formValues(event);
    if (busy) return;
    const newPassword = String(data.get('newPassword'));
    setMismatch(newPassword !== data.get('confirmPassword'));
    if (newPassword !== data.get('confirmPassword')) return;
    setBusy(true);
    setBootstrapError(null);
    try {
      const changed = await change.run(() =>
        write((o) =>
          changeStudentPassword(
            {
              currentPassword: String(data.get('currentPassword')),
              newPassword,
            },
            o,
          ),
        ),
      );
      if (!changed) return;
      form.reset();
      resetAccess();
      announceSessionChange();
      const me = await read(getStudentMe);
      navigate(me.hasActiveAccess ? '/student' : '/student/suspended', { replace: true });
    } catch (error) {
      setBootstrapError(error);
    } finally {
      clearSecrets(form);
      setBusy(false);
    }
  }
  return (
    <main className="standalone k8k-account-standalone">
      <section className="panel auth-card">
        <h1>{t('student.passwordTitle')}</h1>
        <p>{t('student.passwordIntro')}</p>
        <LanguageSelector />
        <ErrorForm
          error={bootstrapError ?? change.error}
          busy={busy}
          onSubmit={(e) => void submit(e)}
        >
          <fieldset disabled={busy || change.unknown}>
            <Field
              label={t('errors.currentPassword')}
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
            <Field
              label={t('errors.newPassword')}
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              pattern="(?=.*[A-Za-z])(?=.*[0-9]).+"
              required
              aria-describedby="password-hint"
            />
            <p className="muted" id="password-hint">
              {t('errors.passwordHint')}
            </p>
            <Field
              label={t('errors.confirmPassword')}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              maxLength={128}
              error={mismatch ? t('errors.passwordMismatch') : undefined}
            />
            {mismatch && (
              <p className="error" role="alert">
                {t('errors.passwordMismatch')}
              </p>
            )}
            <ErrorNotice error={bootstrapError ?? change.error} />
            <button className="primary" type="submit">
              {t(busy ? 'student.saving' : 'student.passwordSave')}
            </button>
          </fieldset>
        </ErrorForm>
        {change.unknown && <p role="status">{t('student.secretUnknown')}</p>}
        <StandaloneExit />
      </section>
    </main>
  );
}
export function AccessSuspended() {
  const me = useStudentQuery(['suspended-me'], getStudentMe, true, 60_000);
  const contactsTooOld = useDataAge(me.dataUpdatedAt, 120_000);
  const { copy } = useStudentCopy();
  if (!me.error && me.data?.mustChangePassword)
    return <Navigate to="/student/security/change-password" replace />;
  if (!me.error && me.data?.hasActiveAccess) return <Navigate to="/student" replace />;
  return (
    <main className={k8kEnabled ? 'k8k-access-screen' : 'standalone'}>
      <section className={k8kEnabled ? 'k8k-student-card' : 'panel auth-card'}>
        {k8kEnabled && (
          <p className="k8k-access-brand">
            <UIIcon name="brand" /> K8K Academy
          </p>
        )}
        <h1>{copy.suspendedTitle}</h1>
        <p>{copy.suspendedBody}</p>
        <QueryState query={me} operational timeZone={me.data?.timeZone}>
          {me.data && (
            <StudentManagerCard
              contacts={me.data.managerContacts}
              unavailable={!!me.error || contactsTooOld}
            />
          )}
        </QueryState>
        <LanguageSelector />
        <StandaloneExit />
      </section>
    </main>
  );
}
export function Profile() {
  const me = useMe();
  const { t } = useStudentLocale();
  const [alias, setAlias] = useState(me.displayName);
  const dirty = useRef(false),
    saveLock = useRef(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!dirty.current) setAlias(me.displayName);
  }, [me.displayName]);
  const update = useCommand((displayName: string, key) =>
    write((o) => updateStudentProfile({ displayName }, o), key),
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveLock.current) return;
    saveLock.current = true;
    try {
      const result = await update.mutateAsync(alias.trim());
      setAlias(result.displayName);
      dirty.current = false;
      setSaved(true);
    } catch {
      /* ErrorFeedback displays only safe localized codes. */
    } finally {
      saveLock.current = false;
    }
  }
  const ProfilePanel = k8kEnabled ? Card : Panel;
  return (
    <>
      <h1>{t('profile')}</h1>
      <ProfilePanel title={t('student.profilePanel')}>
        <ErrorForm error={update.error} busy={update.isPending} onSubmit={(e) => void save(e)}>
          <fieldset disabled={update.isPending}>
            <Field
              id="student-profile-name"
              label={t('student.alias')}
              name="displayName"
              value={alias}
              onChange={(e) => {
                setAlias(e.target.value);
                dirty.current = true;
                setSaved(false);
              }}
              required
              minLength={1}
              maxLength={100}
              autoComplete="nickname"
              inputMode="text"
              hint={t('student.aliasHelp')}
            />
            <p>
              {t('auth.email')}: {me.email}
            </p>
            <ErrorNotice error={update.error} />
            {saved && <p role="status">{t('student.profileSaved')}</p>}
            <Button
              type="submit"
              pending={update.isPending}
              disabledReason={t('student.profilePending')}
              disabled={
                !!update.error && describeError(update.error, 'write').outcome === 'unknown'
              }
            >
              {t('student.profileSave')}
            </Button>
          </fieldset>
        </ErrorForm>
        <Link className="k8k-student-link" to="/student/security">
          {t('student.securityLink')}
        </Link>
      </ProfilePanel>
    </>
  );
}
export function Security() {
  const { t, locale } = useStudentLocale();
  const me = useMe();
  const navigate = useNavigate();
  const [newEmail, setNewEmail] = useState(''),
    [requestedEmail, setRequestedEmail] = useState<string>();
  const [bootstrapError, setBootstrapError] = useState<unknown>(null);
  const sessions = useStudentQuery(['sessions'], getStudentSessions);
  const revoke = useCommand((id: string, key) => write((o) => revokeStudentSession(id, o), key));
  const request = useSecretCommand(),
    confirm = useSecretCommand(true);
  async function send(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget,
      data = formValues(event),
      email = newEmail;
    try {
      const accepted = await request.run(() =>
        write((o) =>
          requestStudentEmailChange(
            { newEmail: email, currentPassword: String(data.get('currentPassword')) },
            o,
          ),
        ),
      );
      if (accepted) setRequestedEmail(email);
    } finally {
      clearSecrets(form);
    }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget,
      data = formValues(event);
    if (!requestedEmail) return;
    try {
      const result = await confirm.run(() =>
        write((o) =>
          confirmStudentEmailChange({ newEmail: requestedEmail, otp: String(data.get('otp')) }, o),
        ),
      );
      if (!result) return;
      resetAccess();
      announceSessionChange();
      const profile = await read(getStudentMe);
      queryClient.setQueryData(['student', 'me'], profile);
      navigate('/student/profile', { replace: true });
    } catch (error) {
      setBootstrapError(error);
    } finally {
      clearSecrets(form);
    }
  }
  return (
    <>
      <h1>{t('student.security')}</h1>
      <Panel title={t('student.password')}>
        <p>{t('student.passwordHelp')}</p>
        <Link className="k8k-student-link" to="/student/security/change-password">
          {t('student.passwordSave')}
        </Link>
      </Panel>
      <Panel title={t('student.email')}>
        <ErrorNotice error={bootstrapError} />
        {requestedEmail ? (
          <ErrorForm
            error={confirm.error}
            busy={confirm.isPending}
            onSubmit={(e) => void verify(e)}
          >
            <fieldset disabled={confirm.isPending || confirm.unknown}>
              <p>{t('student.codeSent', { email: requestedEmail })}</p>
              <Field
                label={t('errors.otp')}
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
              />
              <ErrorNotice error={confirm.error} />
              <Button type="submit" pending={confirm.isPending}>
                {t('student.emailConfirm')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRequestedEmail(undefined)}
              >
                {t('student.codeNew')}
              </Button>
            </fieldset>
          </ErrorForm>
        ) : (
          <ErrorForm error={request.error} busy={request.isPending} onSubmit={(e) => void send(e)}>
            <fieldset disabled={request.isPending || request.unknown}>
              <Field
                label={t('errors.newEmail')}
                name="newEmail"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
              <Field
                label={t('errors.currentPassword')}
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                maxLength={256}
                required
              />
              <ErrorNotice error={request.error} />
              <Button type="submit" pending={request.isPending}>
                {t('student.codeRequest')}
              </Button>
            </fieldset>
          </ErrorForm>
        )}
        {(request.unknown || confirm.unknown) && <p role="status">{t('student.secretUnknown')}</p>}
      </Panel>
      <Panel title={t('student.devices')}>
        <ErrorNotice error={revoke.error} />
        {revoke.isSuccess && <p role="status">{t('student.revoked')}</p>}
        <QueryState query={sessions} empty={sessions.data?.length === 0}>
          <ul className="history-list k8k-student-sessions">
            {sessions.data?.map((s) => (
              <li key={s.sessionId}>
                <strong>{t(s.isCurrent ? 'student.thisDevice' : 'student.otherDevice')}</strong>
                <span>{s.userAgent || t('student.browserUnknown')}</span>
                <small>
                  {s.ipAddress || t('student.addressUnknown')} ·{' '}
                  {t('student.activity', {
                    date: formatStudentDate(s.lastActiveAt, me.timeZone, true, locale),
                  })}
                </small>
                {!s.isCurrent && (
                  <Button
                    variant="secondary"
                    disabled={
                      revoke.isPending ||
                      (!!revoke.error && describeError(revoke.error, 'write').outcome === 'unknown')
                    }
                    onClick={() => revoke.mutate(s.sessionId)}
                  >
                    {t('student.revoke')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </QueryState>
      </Panel>
    </>
  );
}
function clearSecrets(form: HTMLFormElement) {
  for (const element of form.querySelectorAll<HTMLInputElement>(
    'input[type="password"],input[autocomplete="one-time-code"]',
  ))
    element.value = '';
}
function StandaloneExit() {
  const { t } = useStudentLocale();
  const exit = useSecretCommand(true);
  async function logout() {
    const ended = await exit.run(async () => {
      await write((o) => deleteSession({}, o));
      return true;
    });
    if (ended) leaveSession('/student/login');
  }
  return (
    <div className="k8k-standalone-exit">
      <Button
        variant="secondary"
        disabled={exit.isPending || exit.unknown}
        onClick={() => void logout()}
      >
        {t('account.logout')}
      </Button>
      <ErrorNotice error={exit.error} />
    </div>
  );
}
