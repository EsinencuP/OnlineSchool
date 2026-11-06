import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  changeStudentPassword,
  confirmStudentEmailChange,
  createSession,
  getStudentMe,
  getStudentSessions,
  requestStudentEmailChange,
  revokeStudentSession,
  updateStudentProfile,
} from '@online-school/api-contracts';
import type { StudentMeResponseDto } from '@online-school/api-contracts';
import { queryClient, read, resetAccess, useCommand, useStudentQuery, write } from '../api.js';
import { date, ErrorNotice, Panel, QueryState } from '../components.js';
import { ManagerContacts, useMe } from '../Layout.js';
import {
  k8kEnabled,
  Icon as UIIcon,
  Button,
  Card,
  Field,
  LanguageSelector,
  useLocale,
  ErrorForm,
} from '@online-school/ui';
import { StudentManagerCard } from '../student-widgets.js';
import { ProfileHelp } from '../profile-help.js';
function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
export function Login() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [bootstrapError, setBootstrapError] = useState<unknown>(null);
  const login = useCommand((body: { email: string; password: string }) =>
    write((o) => createSession({ method: 'password', ...body }, o)),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget,
      data = formValues(event);
    if (busy) return;
    setBusy(true);
    setBootstrapError(null);
    try {
      await login.mutateAsync({
        email: String(data.get('email')),
        password: String(data.get('password')),
      });
      form.reset();
      resetAccess();
      queryClient.clear();
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
      setBusy(false);
    }
  }
  return (
    <main className="standalone">
      <section className="panel auth-card">
        <p className="eyebrow">Academy · {t('cabinetStudent')}</p>
        <h1>{t('auth.welcome')}</h1>
        <p className="muted">{t('auth.studentPrompt')}</p>
        <LanguageSelector />
        <ErrorForm
          error={bootstrapError ?? login.error}
          busy={busy}
          onSubmit={(e) => void submit(e)}
        >
          <fieldset disabled={busy}>
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
  const { t } = useLocale();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false),
    [bootstrapError, setBootstrapError] = useState<unknown>(null);
  const change = useCommand((body: { currentPassword: string; newPassword: string }) =>
    write((o) => changeStudentPassword(body, o)),
  );
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
      await change.mutateAsync({
        currentPassword: String(data.get('currentPassword')),
        newPassword,
      });
      form.reset();
      queryClient.clear();
      resetAccess();
      const me = await read(getStudentMe);
      navigate(me.hasActiveAccess ? '/student' : '/student/suspended', { replace: true });
    } catch (error) {
      setBootstrapError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="standalone">
      <section className="panel auth-card">
        <p className="eyebrow">Безопасность аккаунта</p>
        <h1>Задайте новый пароль</h1>
        <p>Для первого входа замени временный пароль на собственный.</p>
        <LanguageSelector />
        <ErrorForm
          error={bootstrapError ?? change.error}
          busy={busy}
          onSubmit={(e) => void submit(e)}
        >
          <fieldset disabled={busy}>
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
              {busy ? 'Сохраняем…' : 'Изменить пароль'}
            </button>
          </fieldset>
        </ErrorForm>
      </section>
    </main>
  );
}
export function AccessSuspended() {
  const me = useStudentQuery<StudentMeResponseDto | null>(['suspended-me'], (o) =>
    getStudentMe(o).then((result) =>
      !result.ok && result.error.status === 401 ? { ok: true as const, value: null } : result,
    ),
  );
  if (k8kEnabled)
    return (
      <main className="k8k-access-screen">
        <section className="k8k-student-card">
          <p className="k8k-access-brand">
            <UIIcon name="brand" /> K8K Academy
          </p>
          <h1>Доступ приостановлен</h1>
          <p>
            Учебный доступ сейчас недоступен. По вопросам продолжения обучения свяжись с менеджером.
          </p>
          <QueryState query={me}>
            {me.data ? (
              <StudentManagerCard contacts={me.data.managerContacts} />
            ) : (
              <Link className="k8k-main-action" to="/student/login">
                Войти в аккаунт
              </Link>
            )}
          </QueryState>
        </section>
      </main>
    );
  return (
    <main className="standalone">
      <section className="panel auth-card">
        <h1>Доступ приостановлен</h1>
        <p>Для возобновления свяжитесь с менеджером.</p>
        {me.isPending && <p role="status">Загружаем контакты…</p>}
        <ErrorNotice error={me.error} />
        <ManagerContacts contacts={me.data?.managerContacts} />
      </section>
    </main>
  );
}
export function Profile() {
  const me = useMe();
  const { locale } = useLocale();
  const copy =
    k8kEnabled && locale === 'ro'
      ? {
          title: 'Profil și setări',
          panel: 'Date personale',
          name: 'Cum să ne adresăm',
          hint: 'Acest nume apare în cabinet. Datele din documentele școlii nu se modifică.',
          save: 'Salvează profilul',
          pending: 'Se salvează profilul…',
          saved: 'Profilul a fost salvat',
          security: 'Securitatea contului →',
        }
      : {
          title: 'Профиль и настройки',
          panel: 'Личные данные',
          name: 'Как к тебе обращаться',
          hint: 'Это имя отображается в кабинете. Данные в документах школы не меняются.',
          save: 'Сохранить профиль',
          pending: 'Сохраняем профиль…',
          saved: 'Профиль сохранён',
          security: 'Безопасность аккаунта →',
        };
  const ProfilePanel = k8kEnabled ? Card : Panel;
  const update = useCommand((displayName: string, key) =>
    write((o) => updateStudentProfile({ displayName }, o), key),
  );
  function save(event: FormEvent<HTMLFormElement>) {
    const data = formValues(event);
    if (!update.isPending) update.mutate(String(data.get('displayName')).trim());
  }
  return (
    <>
      <h1>{copy.title}</h1>
      <ProfilePanel title={copy.panel}>
        {k8kEnabled && <ProfileHelp />}
        <ErrorForm error={update.error} busy={update.isPending} onSubmit={save}>
          <fieldset disabled={update.isPending}>
            {k8kEnabled ? (
              <Field
                key={me.displayName}
                id="student-profile-name"
                label={copy.name}
                name="displayName"
                defaultValue={me.displayName}
                required
                minLength={1}
                maxLength={100}
                autoComplete="nickname"
                inputMode="text"
                hint={copy.hint}
              />
            ) : (
              <>
                <Field
                  label={copy.name}
                  key={me.displayName}
                  name="displayName"
                  defaultValue={me.displayName}
                  required
                  minLength={1}
                  maxLength={100}
                />
                <p className="muted">{copy.hint}</p>
              </>
            )}
            <p>Email: {me.email}</p>
            <ErrorNotice error={update.error} />
            {update.isSuccess && <p role="status">{copy.saved}</p>}
            {k8kEnabled ? (
              <Button type="submit" pending={update.isPending} disabledReason={copy.pending}>
                {copy.save}
              </Button>
            ) : (
              <button className="primary" type="submit">
                {copy.save}
              </button>
            )}
          </fieldset>
        </ErrorForm>
        <Link className="button" to="/student/security">
          {copy.security}
        </Link>
      </ProfilePanel>
    </>
  );
}
export function Security() {
  const { t } = useLocale();
  const [newEmail, setNewEmail] = useState(''),
    [otpRequested, setOtpRequested] = useState(false);
  const sessions = useStudentQuery(['sessions'], getStudentSessions);
  const revoke = useCommand((id: string) => write((o) => revokeStudentSession(id, o)));
  const request = useCommand((body: { newEmail: string; currentPassword: string }) =>
    write((o) => requestStudentEmailChange(body, o)),
  );
  const confirm = useCommand((otp: string) =>
    write((o) => confirmStudentEmailChange({ newEmail, otp }, o)),
  );
  async function send(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget,
      data = formValues(event);
    if (request.isPending) return;
    try {
      await request.mutateAsync({ newEmail, currentPassword: String(data.get('currentPassword')) });
      form.reset();
      setOtpRequested(true);
    } catch {
      /* See error below. */
    }
  }
  function verify(event: FormEvent<HTMLFormElement>) {
    const data = formValues(event);
    if (!confirm.isPending) confirm.mutate(String(data.get('otp')));
  }
  return (
    <>
      <h1>Безопасность</h1>
      <Panel title="Пароль">
        <p>Меняй пароль, если считаешь, что его мог узнать кто-то ещё.</p>
        <Link className="button" to="/student/security/change-password">
          Изменить пароль
        </Link>
      </Panel>
      <Panel title="Email для входа">
        {confirm.isSuccess ? (
          <p role="status">Email изменён: {confirm.data.email}</p>
        ) : otpRequested ? (
          <ErrorForm error={confirm.error} busy={confirm.isPending} onSubmit={verify}>
            <fieldset disabled={confirm.isPending}>
              <p>Введи код, отправленный на {newEmail}.</p>
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
              <button className="primary" type="submit">
                Подтвердить email
              </button>
              <button type="button" onClick={() => setOtpRequested(false)}>
                Запросить новый код
              </button>
            </fieldset>
          </ErrorForm>
        ) : (
          <ErrorForm error={request.error} busy={request.isPending} onSubmit={(e) => void send(e)}>
            <fieldset disabled={request.isPending}>
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
              <button className="primary" type="submit">
                Получить код
              </button>
            </fieldset>
          </ErrorForm>
        )}
      </Panel>
      <Panel title="Активные устройства">
        <ErrorNotice error={revoke.error} />
        <QueryState query={sessions}>
          <ul className="history-list">
            {sessions.data?.map((s) => (
              <li key={s.sessionId}>
                <strong>{s.isCurrent ? 'Это устройство' : 'Другое устройство'}</strong>
                <span>{s.userAgent || 'Браузер не указан'}</span>
                <small>
                  {s.ipAddress} · Активность: {date(s.lastActiveAt, true)}
                </small>
                {!s.isCurrent && (
                  <button disabled={revoke.isPending} onClick={() => revoke.mutate(s.sessionId)}>
                    Завершить сессию
                  </button>
                )}
              </li>
            ))}
          </ul>
        </QueryState>
      </Panel>
    </>
  );
}
