import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createSession,
  currentSession,
  deleteSession,
  getComponentStatus,
  getHealth,
  mutation,
  requestOptions,
} from './api.js';
import type { ClientError, ComponentStatusResponse, SessionResponse } from './api.js';
import type { Result } from '@online-school/shared';
import { passkey } from './auth.js';
import { canRun, scenarios } from './scenarios.js';
import type { Action, Field, Values } from './scenarios.js';

const roleLabels = {
  DIRECTOR: 'Директор',
  MANAGER: 'Менеджер',
  TEACHER: 'Преподаватель',
  STUDENT: 'Ученик',
  TECH_OPERATOR: 'Технический оператор',
};
const stamp = (value: string) => new Date(value).toLocaleString('ru-RU');
const errorText = (error: ClientError) =>
  `${error.code}${error.status ? ` · HTTP ${error.status}` : ''}: ${error.message}${error.requestId ? ` · Request ID: ${error.requestId}` : ''}`;

function FieldInput({
  field,
  value,
  change,
  disabled,
}: {
  field: Field;
  value: string;
  change(value: string): void;
  disabled: boolean;
}) {
  const id = `field-${field.name}`;
  const props = {
    id,
    name: field.name,
    value,
    disabled,
    required: !field.optional,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      change(e.target.value),
  };
  return (
    <label className={field.kind === 'textarea' ? 'field field-wide' : 'field'} htmlFor={id}>
      <span>
        {field.label}
        {field.optional && <small> · необязательно</small>}
      </span>
      {field.options ? (
        <select {...props} aria-label={field.label}>
          {field.options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : field.kind === 'textarea' ? (
        <textarea {...props} minLength={5} maxLength={2000} rows={3} />
      ) : (
        <input
          {...props}
          type={
            field.kind === 'datetime'
              ? 'datetime-local'
              : field.kind === 'number'
                ? 'number'
                : 'text'
          }
          min={field.kind === 'number' ? 1 : undefined}
          max={field.name === 'durationMin' ? 480 : field.kind === 'number' ? 10000 : undefined}
          step={field.kind === 'number' ? 1 : undefined}
          inputMode={field.kind === 'money' ? 'decimal' : undefined}
          pattern={
            field.kind === 'uuid'
              ? '[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}'
              : field.kind === 'money'
                ? '(0|[1-9][0-9]{0,15})([.][0-9]{1,4})?'
                : field.name === 'currency'
                  ? '[A-Z]{3}'
                  : undefined
          }
          placeholder={
            field.kind === 'uuid'
              ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
              : field.kind === 'money'
                ? '100.0000'
                : undefined
          }
          autoComplete="off"
        />
      )}
    </label>
  );
}

function CommandForm({
  action,
  session,
  busy,
  setBusy,
  refresh,
}: {
  action: Action;
  session: SessionResponse;
  busy: boolean;
  setBusy(value: boolean): void;
  refresh(): Promise<SessionResponse | null>;
}) {
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(
      action.fields.map((field) => [field.name, field.value ?? field.options?.[0] ?? '']),
    ),
  );
  const [result, setResult] = useState<Result<unknown, ClientError> | null>(null);
  const [complete, setComplete] = useState(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || complete) return;
    setBusy(true);
    setResult(null);
    try {
      const fresh = await refresh();
      if (!canRun(fresh, action)) {
        setResult({
          ok: false,
          error: {
            code: 'SESSION_NOT_AUTHORIZED',
            status: 403,
            message: 'Сессия или права изменились. Выполните вход и MFA.',
          },
        });
        return;
      }
      const fingerprint = JSON.stringify([session.account.id, action.id, values]);
      if (!action.readOnly && attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, key: crypto.randomUUID() };
      const response = action.readOnly
        ? await action.execute(values, requestOptions())
        : await mutation((options) => action.execute(values, options), attempt.current!.key);
      setResult(response);
      setComplete(response.ok && !action.readOnly);
      if (!response.ok && response.error.status === 401) await refresh();
    } catch {
      setResult({
        ok: false,
        error: {
          code: 'COMMAND_NOT_SENT',
          status: 0,
          message: 'Проверьте поля и повторите запрос. Ключ команды сохранён.',
        },
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form onSubmit={(event) => void submit(event)} className="command-form">
        <fieldset disabled={busy || complete}>
          <legend className="sr-only">{action.title}</legend>
          <div className="form-grid">
            {action.fields.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                value={values[field.name] ?? ''}
                disabled={busy || complete}
                change={(value) => setValues((previous) => ({ ...previous, [field.name]: value }))}
              />
            ))}
          </div>
        </fieldset>
        <div className="form-actions">
          <button className="primary" disabled={busy || complete} type="submit">
            {busy
              ? 'Ожидаем API…'
              : complete
                ? 'Команда выполнена'
                : result && !result.ok && attempt.current
                  ? 'Повторить команду'
                  : action.button}
          </button>
          {attempt.current && (
            <button
              className="quiet"
              type="button"
              disabled={busy}
              onClick={() => {
                attempt.current = null;
                setComplete(false);
                setResult(null);
              }}
            >
              Новая команда
            </button>
          )}
        </div>
        {!action.readOnly && (
          <p className="hint">
            При повторе неизменённого запроса используется тот же Idempotency-Key. «Новая команда»
            создаёт новый ключ.
          </p>
        )}
      </form>
      {result && (
        <section
          className={`result ${result.ok ? 'result-ok' : 'result-error'}`}
          aria-live="polite"
          aria-label="Результат API"
        >
          <h3>
            {result.ok
              ? 'API подтвердил выполнение'
              : result.error.code === 'FILE_ACCESS_DENIED'
                ? 'API запретил доступ к файлу'
                : 'Ответ API: действие не выполнено'}
          </h3>
          {result.ok ? (
            <pre tabIndex={0}>{JSON.stringify(result.value, null, 2)}</pre>
          ) : (
            <p className="break-word">{errorText(result.error)}</p>
          )}
          {attempt.current && (
            <p className="mono break-word">Idempotency-Key: {attempt.current.key}</p>
          )}
        </section>
      )}
    </>
  );
}

export function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState(false);
  const [selected, setSelected] = useState('');
  const [actionId, setActionId] = useState('');
  const [health, setHealth] = useState<'checking' | 'ok' | 'unavailable'>('checking');
  const [components, setComponents] = useState<ComponentStatusResponse | null>(null);
  const [componentError, setComponentError] = useState('');
  const [checking, setChecking] = useState(false);
  const statusSequence = useRef(0);
  const securityHeading = useRef<HTMLHeadingElement>(null);
  const refresh = useCallback(async () => {
    const response = await currentSession(requestOptions());
    const value = response.ok ? response.value : null;
    setSession(value);
    setSessionLoading(false);
    return value;
  }, []);
  useEffect(() => {
    void refresh();
    const focus = () => {
      void refresh();
    };
    window.addEventListener('focus', focus);
    const timer = window.setInterval(focus, 30000);
    return () => {
      window.removeEventListener('focus', focus);
      window.clearInterval(timer);
    };
  }, [refresh]);
  const checkComponents = useCallback(async () => {
    const sequence = ++statusSequence.current;
    setChecking(true);
    const [api, detail] = await Promise.all([
      getHealth(requestOptions()),
      session?.mfa_completed && !session.recovery_only
        ? getComponentStatus(requestOptions())
        : Promise.resolve(null),
    ]);
    if (sequence !== statusSequence.current) return;
    setHealth(api.ok ? 'ok' : 'unavailable');
    setComponents(detail?.ok ? detail.value : null);
    setComponentError(detail && !detail.ok ? errorText(detail.error) : '');
    setChecking(false);
  }, [session?.account.id, session?.mfa_completed, session?.recovery_only]);
  useEffect(() => {
    void checkComponents();
  }, [checkComponents]);
  useEffect(() => {
    if (session && !session.mfa_completed) securityHeading.current?.focus();
  }, [session?.account.id, session?.mfa_completed]);
  async function authWork(command: () => Promise<Result<unknown, ClientError>>, success: string) {
    if (busy) return;
    setBusy(true);
    setAuthMessage('');
    try {
      const result = await command();
      setAuthError(!result.ok);
      setAuthMessage(result.ok ? success : errorText(result.error));
      if (result.ok) await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    event.currentTarget.reset();
    await authWork(
      () => mutation((options) => createSession({ email, password }, options)),
      'Пароль принят. Завершите вход с помощью passkey.',
    );
  }
  const available = session
    ? scenarios
        .map((scenario) => ({
          ...scenario,
          actions: scenario.actions.filter((action) => canRun(session, action)),
        }))
        .filter((scenario) => scenario.actions.length)
    : [];
  const current = available.find((scenario) => scenario.id === selected) ?? available[0];
  const action = current?.actions.find((item) => item.id === actionId) ?? current?.actions[0];
  const mfa = !!session?.mfa_completed && !session.recovery_only;
  const canRegister = !!session && ['STAFF', 'TEACHER'].includes(session.account.kind);

  return (
    <>
      <a className="skip-link" href="#workspace">
        К сценариям
      </a>
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            O
          </span>
          <span>
            OnlineSchool <strong>QA</strong>
          </span>
        </a>
        <div className="header-links">
          <span className="environment">Рабочий проект</span>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            API Docs <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
      <main className="shell">
        <div className="page-heading enter">
          <div>
            <p className="eyebrow">Рабочее пространство / Фаза 0</p>
            <h1>Проверка платформы</h1>
            <p className="intro">Вход, состояние компонентов и разрешённые API-сценарии.</p>
          </div>
          <span className={`session-badge ${mfa ? 'badge-ok' : ''}`}>
            {sessionLoading
              ? 'Проверяем сессию…'
              : mfa
                ? 'Сессия подтверждена'
                : session
                  ? 'Ожидается passkey'
                  : 'Вход не выполнен'}
          </span>
        </div>
        <div className="layout">
          <aside className="sidebar">
            <section className="panel enter auth-panel" aria-labelledby="access-heading">
              <div className="section-label">
                <span>01 / Доступ</span>
                <span className="tiny-label">SESSION</span>
              </div>
              <h2 id="access-heading">Вход в QA</h2>
              {session ? (
                <>
                  <p className="role-name">
                    {session.account.roles.map((role) => roleLabels[role]).join(' · ')}
                  </p>
                  <p className="mono break-word account-id">{session.account.id}</p>
                  <p className="hint">Сессия до {stamp(session.expires_at)}.</p>
                  <button
                    className="quiet"
                    disabled={busy}
                    onClick={() =>
                      void authWork(
                        () => mutation((options) => deleteSession({}, options)),
                        'Вы вышли из аккаунта.',
                      )
                    }
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <form onSubmit={(event) => void login(event)} className="login-form">
                  <label className="field">
                    <span>Email</span>
                    <input
                      name="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username webauthn"
                      required
                      disabled={busy}
                    />
                  </label>
                  <label className="field">
                    <span>Пароль</span>
                    <input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      maxLength={256}
                      disabled={busy}
                    />
                  </label>
                  <button className="primary" disabled={busy || sessionLoading}>
                    {busy ? 'Выполняется вход…' : 'Войти по паролю'}
                  </button>
                </form>
              )}
            </section>
            <section className="panel enter security-panel" aria-labelledby="security-heading">
              <div className="section-label">
                <span>02 / Подтверждение</span>
                <span className="tiny-label">WEBAUTHN</span>
              </div>
              <h2 id="security-heading" tabIndex={-1} ref={securityHeading}>
                Passkey
              </h2>
              <p>
                {session?.recovery_only
                  ? 'Восстановление: зарегистрируйте новый ключ, затем выполните аутентификацию.'
                  : 'Регистрация создаёт ключ. Аутентификация подтверждает текущую сессию.'}
              </p>
              <div className="stack-actions">
                <button
                  className="secondary"
                  disabled={busy || !canRegister}
                  onClick={() =>
                    void authWork(
                      () => passkey('register'),
                      'Ключ зарегистрирован. Выполните аутентификацию для завершения MFA.',
                    )
                  }
                >
                  Зарегистрировать passkey
                </button>
                <button
                  className="secondary"
                  disabled={
                    busy || !session || session.recovery_only || session.account.kind === 'STUDENT'
                  }
                  onClick={() =>
                    void authWork(
                      () => passkey('authenticate'),
                      'Аутентификация выполнена. Сессия обновлена.',
                    )
                  }
                >
                  Войти с passkey
                </button>
              </div>
              {!session && <p className="hint">Сначала войдите по email и паролю.</p>}
              {authMessage && (
                <p
                  role="status"
                  className={authError ? 'feedback error-text break-word' : 'feedback break-word'}
                >
                  {authMessage}
                </p>
              )}
            </section>
            <section className="build-info enter" aria-labelledby="build-heading">
              <h2 id="build-heading">Build info</h2>
              <dl>
                <div>
                  <dt>Версия</dt>
                  <dd>{__BUILD_INFO__.version}</dd>
                </div>
                <div>
                  <dt>Собрано</dt>
                  <dd>{stamp(__BUILD_INFO__.builtAt)}</dd>
                </div>
                <div>
                  <dt>Commit SHA</dt>
                  <dd className="mono break-word">
                    {__BUILD_INFO__.commitSha ?? 'Не передан при сборке'}
                  </dd>
                </div>
                <div>
                  <dt>Миграция в сборке</dt>
                  <dd className="mono break-word">
                    {__BUILD_INFO__.expectedMigration ?? 'Не определена'}
                  </dd>
                </div>
                <div>
                  <dt>Применена в БД</dt>
                  <dd className="mono break-word">
                    {components?.migrationVersion ?? 'Доступно после MFA и проверки БД'}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
          <div className="main-column">
            <section className="panel enter status-panel" aria-labelledby="status-heading">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Наблюдение</p>
                  <h2 id="status-heading">Статус компонентов</h2>
                </div>
                <button
                  className="quiet"
                  disabled={checking}
                  onClick={() => void checkComponents()}
                >
                  {checking ? 'Проверяем…' : 'Проверить компоненты'}
                </button>
              </div>
              <div className="status-grid">
                {[
                  {
                    name: 'API',
                    state: health === 'ok' ? 'ok' : health === 'unavailable' ? 'bad' : 'neutral',
                    text:
                      health === 'ok'
                        ? 'Отвечает'
                        : health === 'unavailable'
                          ? 'Недоступен'
                          : 'Проверяем',
                  },
                  {
                    name: 'PostgreSQL',
                    state:
                      components?.db === 'ok'
                        ? 'ok'
                        : components?.db === 'unavailable'
                          ? 'bad'
                          : 'neutral',
                    text:
                      components?.db === 'ok'
                        ? 'Подключена'
                        : components?.db === 'unavailable'
                          ? 'Недоступна'
                          : 'Не проверена',
                  },
                  {
                    name: 'Worker',
                    state:
                      components?.worker === 'ok'
                        ? 'ok'
                        : components && ['stale', 'stopped'].includes(components.worker)
                          ? 'bad'
                          : 'neutral',
                    text:
                      components?.worker === 'ok'
                        ? 'Heartbeat получен'
                        : components?.worker === 'stale'
                          ? 'Heartbeat устарел'
                          : components?.worker === 'stopped'
                            ? 'Остановлен'
                            : 'Нет данных',
                  },
                ].map((item) => (
                  <div className="component" key={item.name}>
                    <span className="component-name">{item.name}</span>
                    <strong>
                      <span aria-hidden="true" className={`dot dot-${item.state}`} />
                      {item.text}
                    </strong>
                  </div>
                ))}
              </div>
              <p className="hint">
                {components
                  ? `Проверено: ${stamp(components.checkedAt)}. Worker: ${components.workerLastSeenAt ? stamp(components.workerLastSeenAt) : 'heartbeat ещё не поступал'}.`
                  : 'Детали БД и worker доступны сотрудникам после MFA.'}{' '}
                Liveness не подтверждает готовность релиза.
              </p>
              {componentError && (
                <p className="error-text break-word" role="status">
                  {componentError}
                </p>
              )}
            </section>
            <section
              className="panel enter workspace"
              id="workspace"
              aria-labelledby="workspace-heading"
            >
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Проверка бизнес-команд</p>
                  <h2 id="workspace-heading">QA-сценарии</h2>
                </div>
                <span className="tiny-label">REAL API</span>
              </div>
              {current && action && session ? (
                <>
                  <nav className="scenario-list" aria-label="Разрешённые сценарии">
                    {available.map((scenario, index) => (
                      <button
                        key={scenario.id}
                        className={
                          scenario.id === current.id
                            ? 'scenario-button selected'
                            : 'scenario-button'
                        }
                        aria-pressed={scenario.id === current.id}
                        disabled={busy}
                        onClick={() => {
                          setSelected(scenario.id);
                          setActionId('');
                        }}
                      >
                        <span className="scenario-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span>{scenario.title}</span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </nav>
                  <div className="scenario-detail">
                    <h3>{current.title}</h3>
                    <p>{current.description}</p>
                    {current.actions.length > 1 && (
                      <nav className="step-tabs" aria-label="Шаги сценария">
                        {current.actions.map((item) => (
                          <button
                            key={item.id}
                            disabled={busy}
                            aria-pressed={item.id === action.id}
                            onClick={() => setActionId(item.id)}
                          >
                            {item.title}
                          </button>
                        ))}
                      </nav>
                    )}
                    <p className="command-label mono">
                      {action.id} · {action.readOnly ? 'GET' : 'POST'}
                    </p>
                    <CommandForm
                      key={`${session.account.id}:${action.id}`}
                      action={action}
                      session={session}
                      busy={busy}
                      setBusy={setBusy}
                      refresh={refresh}
                    />
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <span className="empty-symbol" aria-hidden="true">
                    ↳
                  </span>
                  <h3>
                    {sessionLoading
                      ? 'Проверяем права доступа'
                      : !session
                        ? 'Начните со входа'
                        : !mfa
                          ? 'Завершите подтверждение passkey'
                          : 'Для этой роли нет бизнес-команд'}
                  </h3>
                  <p>
                    {!mfa
                      ? 'После входа и MFA здесь появятся сценарии, разрешённые текущей роли.'
                      : 'Можно проверить компоненты и текущие файловые разрешения. Дополнительные роли выдаёт администратор.'}
                  </p>
                </div>
              )}
            </section>
            <p className="workspace-note">
              Роли, назначения и финансовые ограничения проверяет NestJS API. Команды изменяют
              рабочую базу проекта. Поля форм и отображённые ответы остаются в памяти страницы.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
