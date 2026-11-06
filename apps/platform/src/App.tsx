import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createSession,
  currentSession,
  getComponentStatus,
  getPlatformWorkspace,
} from '@online-school/api-contracts';
import type {
  SessionResponse,
  PlatformWorkspaceDto as Workspace,
} from '@online-school/api-contracts';
import { StaffCoverageNote } from './StaffCoverageNote.js';
import {
  AccountMenu,
  accountRoleLabel,
  getAccounts,
  mutation,
  requestOptions,
  roleHome,
} from '@online-school/account-ui';
import type { DemoAccount } from '@online-school/account-ui';
import {
  AppShell,
  formatDateTime,
  k8kEnabled,
  LanguageSelector,
  queryBoundaryState,
  roleNavigation,
  StateBoundary,
  useContextRefresh,
  useDataAge,
  useLocale,
} from '@online-school/ui';
import type { CabinetRole } from '@online-school/ui';

const lessonStatus: Record<string, string> = {
  SCHEDULED: 'Запланирован',
  IN_PROGRESS: 'Идёт урок',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  RESCHEDULED: 'Перенесён',
};
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
      window.location.replace(roleHome(result.value.account.roles[0] ?? ''));
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
      <section className="login-story">
        <a className="brand" href="/">
          a<span>Academy</span>
        </a>
        <p className="eyebrow">{t('auth.eyebrow')}</p>
        <h1>
          {t('auth.learn')}
          <br />
          {t('auth.teach')}
          <br />
          <em>{t('auth.connect')}</em>
        </h1>
        <p>{t('auth.intro')}</p>
        <div className="story-note">{t('auth.storyNote')}</div>
      </section>
      <section className="login-form">
        <p className="eyebrow">{t('auth.cabinet')}</p>
        <h2>{t('auth.welcome')}</h2>
        <p className="muted">{t('auth.prompt')}</p>
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
        <p className="login-help">{t('auth.switchHelp')}</p>
      </section>
    </main>
  );
}
function StateBoundaryAdapter(props: Parameters<typeof StateBoundary>[0] & { enabled: boolean }) {
  const denied = props.state.status === 'forbidden' || props.state.status === 'session-expired';
  return props.enabled || denied ? <StateBoundary {...props} /> : <>{props.children}</>;
}
function Staff({ session }: { session: SessionResponse }) {
  const { locale, t, intlLocale } = useLocale();
  const role = session.account.roles[0] ?? '';
  const director = role === 'DIRECTOR';
  const operator = role === 'TECH_OPERATOR';
  const [data, setData] = useState<Workspace | null>(null);
  const timezone = data?.actorContext?.timezone;
  const serverTime = data?.actorContext?.asOf ? Date.parse(data.actorContext.asOf) : NaN;
  const date = (value: string) =>
    timezone ? (formatDateTime(value, locale, timezone) ?? '—') : '—';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const allowedTabs = operator
    ? ['overview']
    : ['overview', 'lessons', 'students', director ? 'tasks' : 'homework'];
  const readTab = () => {
    const value = new URLSearchParams(window.location.search).get('section');
    return value && allowedTabs.includes(value) ? value : 'overview';
  };
  const [tab, updateTab] = useState(readTab);
  const setTab = (value: string) => {
    if (!allowedTabs.includes(value)) return;
    const url = new URL(window.location.href);
    url.searchParams.set('section', value);
    window.history.pushState(null, '', url);
    updateTab(value);
  };
  useEffect(() => {
    const restore = () => updateTab(readTab());
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [role]);
  const [health, setHealth] = useState<string>('Проверяем состояние…');
  const [reload, setReload] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [readStatus, setReadStatus] = useState<number | undefined>();
  const [readFailed, setReadFailed] = useState(false);
  const tooOld = useDataAge(updatedAt, 120_000);
  useContextRefresh({
    enabled: k8kEnabled && !loading,
    context: 'operational',
    refresh: async () => {
      setReload((value) => value + 1);
    },
  });
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError('');
    if (operator)
      void getComponentStatus(requestOptions(abort.signal)).then((r) => {
        if (abort.signal.aborted) return;
        if (r.ok) {
          setHealth(`API: ${r.value.api} · База данных: ${r.value.db} · Worker: ${r.value.worker}`);
          setUpdatedAt(Date.now());
          setReadStatus(undefined);
          setReadFailed(false);
        } else {
          setReadFailed(true);
          setReadStatus(r.error.status);
          setError('Не удалось проверить состояние платформы.');
        }
        setLoading(false);
      });
    else
      void getPlatformWorkspace(requestOptions(abort.signal)).then((r) => {
        if (abort.signal.aborted) return;
        if (r.ok) {
          setData(r.value);
          setUpdatedAt(Date.now());
          setReadStatus(undefined);
          setReadFailed(false);
        } else if (r.error.status === 401) {
          setReadStatus(401);
          window.location.replace('/account');
        } else {
          setReadFailed(true);
          setReadStatus(r.error.status);
          setError('Не удалось загрузить кабинет. Повторите попытку.');
        }
        setLoading(false);
      });
    return () => abort.abort();
  }, [operator, reload]);
  const name =
    (readStatus === 401 || readStatus === 403 ? undefined : data?.name) ??
    accountRoleLabel(locale, role);
  const tabs = roleNavigation[operator ? 'TECH_OPERATOR' : director ? 'DIRECTOR' : 'TEACHER'];
  const selectedTab = tabs.find(({ id }) => id === tab);
  const content = (
    <>
      {' '}
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {director ? 'Школа в деталях' : operator ? 'Технический кабинет' : 'Ваш учебный день'}
          </p>
          <h1>
            {tab === 'overview'
              ? `Здравствуйте, ${name.replace('[ДЕМО] ', '').split(' ')[0]}`
              : selectedTab && t(selectedTab.labelKey)}
          </h1>
          <p className="muted">
            {director
              ? 'Расписание школы, ученики и текущие задачи команды.'
              : operator
                ? 'Состояние работающих компонентов платформы.'
                : 'Ближайшие занятия, ваши ученики и домашние задания.'}
          </p>
        </div>
        <button
          type="button"
          className="refresh"
          disabled={!k8kEnabled && loading}
          aria-disabled={k8kEnabled && loading}
          onClick={() => {
            if (!loading) setReload((v) => v + 1);
          }}
        >
          ↻ Обновить
        </button>
      </div>
      {(!k8kEnabled || !readFailed) && error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!k8kEnabled && loading && !data && <p role="status">Загружаем данные…</p>}
      <StateBoundaryAdapter
        enabled={k8kEnabled}
        state={queryBoundaryState({
          isPending: loading,
          hasData: operator ? updatedAt > 0 : !!data,
          error: readFailed,
          errorStatus: readStatus,
          tooOld,
        })}
        receivedAt={updatedAt}
        asOf={data?.actorContext?.asOf}
        refreshing={loading}
        retryRead={() => setReload((value) => value + 1)}
      >
        {operator ? (
          <section className="panel">
            <h2>Состояние платформы</h2>
            <p role="status">{health}</p>
          </section>
        ) : (
          data && (
            <>
              {tab === 'overview' && (
                <>
                  <div id="staff-summary-coverage">
                    <StaffCoverageNote
                      coverage={[
                        data.coverage?.lessons,
                        data.coverage?.students,
                        data.coverage?.homework,
                        data.coverage?.tasks,
                      ].find((coverage) => coverage?.pageInfo.hasMore)}
                    />
                  </div>
                  <div className="stats" role="group" aria-describedby="staff-summary-coverage">
                    <section>
                      <span>Предстоящих уроков</span>
                      <strong>
                        {Number.isFinite(serverTime)
                          ? data.lessons.filter(
                              (l) => l.status === 'SCHEDULED' && +new Date(l.startsAt) > serverTime,
                            ).length
                          : '—'}
                      </strong>
                    </section>
                    <section>
                      <span>{director ? 'Учеников с преподавателем' : 'Моих учеников'}</span>
                      <strong>{new Set(data.students.map((s) => s.id)).size}</strong>
                    </section>
                    <section>
                      <span>{director ? 'Открытых задач' : 'Домашних заданий'}</span>
                      <strong>{director ? data.tasks.length : data.homework.length}</strong>
                    </section>
                  </div>
                </>
              )}
              {(tab === 'overview' || tab === 'lessons') && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>{tab === 'overview' ? 'Ближайшие занятия' : 'Расписание занятий'}</h2>
                    <span>{timezone ?? '—'}</span>
                  </div>
                  <StaffCoverageNote coverage={data.coverage?.lessons} />
                  {data.lessons.length ? (
                    <div className="lesson-list">
                      {data.lessons.slice(0, tab === 'overview' ? 4 : 100).map((l) => (
                        <article className="lesson" key={l.id}>
                          <div className="lesson-date">
                            <strong>
                              {timezone
                                ? new Date(l.startsAt).toLocaleDateString(intlLocale, {
                                    timeZone: timezone,
                                    day: 'numeric',
                                  })
                                : '—'}
                            </strong>
                            <span>
                              {timezone
                                ? new Date(l.startsAt).toLocaleDateString(intlLocale, {
                                    timeZone: timezone,
                                    month: 'short',
                                  })
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <h3>{l.subject}</h3>
                            <p>
                              {l.student}
                              {director ? ` · ${l.teacher}` : ''}
                            </p>
                            <time dateTime={l.startsAt}>
                              {date(l.startsAt)} ·{' '}
                              {Math.round((+new Date(l.endsAt) - +new Date(l.startsAt)) / 60000)}{' '}
                              мин
                            </time>
                          </div>
                          <span className="badge">{lessonStatus[l.status] ?? l.status}</span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty">Запланированных уроков пока нет.</p>
                  )}
                  {tab === 'overview' && data.lessons.length > 4 && (
                    <button className="text-button" onClick={() => setTab('lessons')}>
                      Всё расписание →
                    </button>
                  )}
                </section>
              )}
              {tab === 'students' && (
                <section className="panel">
                  <h2>{director ? 'Ученики и направления' : 'Ваши ученики'}</h2>
                  <StaffCoverageNote coverage={data.coverage?.students} />
                  {data.students.length ? (
                    data.students.map((s, i) => (
                      <article className="simple-row" key={`${s.id}:${i}`}>
                        <span className="pupil-avatar" aria-hidden="true">
                          {s.name.replace('[ДЕМО] ', '').slice(0, 1)}
                        </span>
                        <div>
                          <h3>{s.name}</h3>
                          <p>{s.subject}</p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="empty">Ученики появятся после назначения преподавателя.</p>
                  )}
                </section>
              )}
              {(tab === 'tasks' || (director && tab === 'overview')) && (
                <section className="panel">
                  <h2>Задачи менеджеров</h2>
                  <StaffCoverageNote coverage={data.coverage?.tasks} />
                  {data.tasks.length ? (
                    data.tasks.map((t) => (
                      <article className="simple-row" key={t.id}>
                        <span
                          className={
                            +new Date(t.dueAt) < Date.now() ? 'task-dot overdue' : 'task-dot'
                          }
                          aria-hidden="true"
                        />
                        <div>
                          <h3>{t.title}</h3>
                          <p>
                            {t.manager} · {date(t.dueAt)}
                          </p>
                        </div>
                        <span className="badge">
                          {t.status === 'IN_PROGRESS'
                            ? 'В работе'
                            : +new Date(t.dueAt) < Date.now()
                              ? 'Просрочена'
                              : 'Открыта'}
                        </span>
                      </article>
                    ))
                  ) : (
                    <p className="empty">Открытых задач нет.</p>
                  )}
                </section>
              )}
              {(tab === 'homework' || (!director && tab === 'overview')) && (
                <section className="panel">
                  <h2>Домашние задания</h2>
                  <StaffCoverageNote coverage={data.coverage?.homework} />
                  {data.homework.length ? (
                    data.homework.map((h) => (
                      <article className="simple-row" key={h.id}>
                        <div>
                          <h3>{h.title}</h3>
                          <p>
                            {h.subject} · {h.dueAt ? `до ${date(h.dueAt)}` : 'Без срока'}
                          </p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="empty">Выданных заданий пока нет.</p>
                  )}
                </section>
              )}
            </>
          )
        )}
      </StateBoundaryAdapter>
    </>
  );
  if (k8kEnabled && ['TEACHER', 'DIRECTOR', 'TECH_OPERATOR'].includes(role))
    return (
      <AppShell
        role={role as CabinetRole}
        {...(timezone ? { timeZone: timezone } : {})}
        activeId={tab}
        renderNavigation={(item, label, props) => (
          <button
            type="button"
            {...props}
            onClick={() => {
              props.onClick();
              setTab(item.id);
              document.getElementById('content')?.focus();
            }}
          >
            {label}
          </button>
        )}
        account={<AccountMenu name={name} role={role} />}
        footer={`K8K Academy · ${t('calendarZone')} ${timezone ?? '—'}`}
      >
        {content}
      </AppShell>
    );
  return (
    <div className="staff-app">
      <a className="skip" href="#content">
        {t('skip')}
      </a>
      <aside className="sidebar">
        <a className="brand" href={roleHome(role)}>
          a
          <span>
            Academy<small>{accountRoleLabel(locale, role)}</small>
          </span>
        </a>
        <p className="sidebar-label">{t('workspace')}</p>
        <nav aria-label={t('primaryNavigation')}>
          {tabs.map(({ id, labelKey }) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                setTab(id);
                document.getElementById('content')?.focus();
              }}
            >
              {t(labelKey)}
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          {t('chrome.staffNote')}
          <span>Academy · {t('chrome.school')}</span>
        </div>
      </aside>
      <div className="staff-main">
        <header className="topbar">
          <span>{t('auth.cabinet')}</span>
          <AccountMenu name={name} role={role} />
        </header>
        <main id="content" tabIndex={-1}>
          {content}
        </main>
        <footer>Academy · {t('calendarZone')} Europe/Chisinau</footer>
      </div>
    </div>
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
  useEffect(() => {
    if (window.location.pathname === '/account') {
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    void currentSession(requestOptions(abort.signal)).then((r) => {
      if (abort.signal.aborted) return;
      if (r.ok) {
        const role = r.value.account.roles[0] ?? '';
        if (
          role === 'STUDENT' ||
          role === 'MANAGER' ||
          !window.location.pathname.startsWith(roleHome(role))
        ) {
          window.location.replace(roleHome(role));
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
  return session ? <Staff session={session} /> : <Login />;
}
