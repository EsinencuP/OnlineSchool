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
function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
export function Login() {
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
        <p className="eyebrow">Academy · Кабинет ученика</p>
        <h1>С возвращением</h1>
        <p className="muted">Войди, чтобы продолжить обучение.</p>
        <form onSubmit={(e) => void submit(e)}>
          <fieldset disabled={busy}>
            <label>
              Email
              <input name="email" type="email" autoComplete="username" required maxLength={254} />
            </label>
            <label>
              Пароль
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
              />
            </label>
            <ErrorNotice error={bootstrapError ?? login.error} />
            <button className="primary" type="submit">
              {busy ? 'Входим…' : 'Войти'}
            </button>
          </fieldset>
        </form>
      </section>
    </main>
  );
}
export function ChangePassword() {
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
        <form onSubmit={(e) => void submit(e)}>
          <fieldset disabled={busy}>
            <label>
              Текущий пароль
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
              />
            </label>
            <label>
              Новый пароль
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                pattern="(?=.*[A-Za-z])(?=.*\d).+"
                required
                aria-describedby="password-hint"
              />
            </label>
            <p className="muted" id="password-hint">
              От 8 до 128 символов, латинские буквы и цифры.
            </p>
            <label>
              Повторите новый пароль
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                maxLength={128}
              />
            </label>
            {mismatch && (
              <p className="error" role="alert">
                Новые пароли не совпадают.
              </p>
            )}
            <ErrorNotice error={bootstrapError ?? change.error} />
            <button className="primary" type="submit">
              {busy ? 'Сохраняем…' : 'Изменить пароль'}
            </button>
          </fieldset>
        </form>
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
  const update = useCommand((displayName: string, key) =>
    write((o) => updateStudentProfile({ displayName }, o), key),
  );
  function save(event: FormEvent<HTMLFormElement>) {
    const data = formValues(event);
    if (!update.isPending) update.mutate(String(data.get('displayName')).trim());
  }
  return (
    <>
      <h1>Профиль и настройки</h1>
      <Panel title="Личные данные">
        <form onSubmit={save}>
          <fieldset disabled={update.isPending}>
            <label>
              Как к тебе обращаться
              <input
                key={me.displayName}
                name="displayName"
                defaultValue={me.displayName}
                required
                minLength={1}
                maxLength={100}
              />
            </label>
            <p className="muted">
              Это имя отображается в кабинете. Данные в документах школы не меняются.
            </p>
            <p>Email: {me.email}</p>
            <ErrorNotice error={update.error} />
            {update.isSuccess && <p role="status">Профиль сохранён</p>}
            <button className="primary" type="submit">
              Сохранить профиль
            </button>
          </fieldset>
        </form>
        <Link className="button" to="/student/security">
          Безопасность аккаунта →
        </Link>
      </Panel>
    </>
  );
}
export function Security() {
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
          <form onSubmit={verify}>
            <fieldset disabled={confirm.isPending}>
              <p>Введи код, отправленный на {newEmail}.</p>
              <label>
                Код подтверждения
                <input
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                />
              </label>
              <ErrorNotice error={confirm.error} />
              <button className="primary" type="submit">
                Подтвердить email
              </button>
              <button type="button" onClick={() => setOtpRequested(false)}>
                Запросить новый код
              </button>
            </fieldset>
          </form>
        ) : (
          <form onSubmit={(e) => void send(e)}>
            <fieldset disabled={request.isPending}>
              <label>
                Новый email
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>
              <label>
                Текущий пароль
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  maxLength={256}
                  required
                />
              </label>
              <ErrorNotice error={request.error} />
              <button className="primary" type="submit">
                Получить код
              </button>
            </fieldset>
          </form>
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
