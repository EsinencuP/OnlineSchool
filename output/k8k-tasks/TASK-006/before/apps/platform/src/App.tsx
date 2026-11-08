import { LanguageSelector } from '@online-school/ui';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createSession,
  currentSession,
  deleteSession,
  getComponentStatus,
  getPlatformWorkspace,
} from '@online-school/api-contracts';
import type { SessionResponse } from '@online-school/api-contracts';
import {
  AccountMenu,
  getAccounts,
  mutation,
  requestOptions,
  roleHome,
  roleLabels,
} from '@online-school/account-ui';
import type { DemoAccount } from '@online-school/account-ui';
import {
  AppShell,
  k8kEnabled,
  queryBoundaryState,
  StateBoundary,
  useContextRefresh,
  useDataAge,
} from '@online-school/ui';
import type { CabinetRole } from '@online-school/ui';

interface Workspace {
  name: string;
  role: string;
  lessons: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    subject: string;
    student: string;
    teacher: string;
    meetUrl: string | null;
  }>;
  students: Array<{ id: string; name: string; subject: string }>;
  homework: Array<{ id: string; title: string; subject: string; dueAt: string | null }>;
  tasks: Array<{ id: string; title: string; status: string; dueAt: string; manager: string }>;
}
const date = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Chisinau',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
const lessonStatus: Record<string, string> = {
  SCHEDULED: 'Запланирован',
  IN_PROGRESS: 'Идёт урок',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  RESCHEDULED: 'Перенесён',
};
function Login() {
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [email, setEmail] = useState('tamara.demo@onlineschool.test');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
    setError('');
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
        setError('Для этого аккаунта требуется дополнительная проверка входа.');
        setBusy(false);
        return;
      }
      window.location.replace(roleHome(result.value.account.roles[0] ?? ''));
    } else {
      setError(
        result.ok
          ? 'Не удалось выполнить вход.'
          : result.error.status === 401
            ? 'Проверьте логин и пароль.'
            : result.error.status === 429
              ? 'Слишком много попыток. Попробуйте позже.'
              : 'Не удалось войти. Повторите попытку.',
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
        <p className="eyebrow">Школа, в которой всё рядом</p>
        <h1>
          Учиться.
          <br />
          Преподавать.
          <br />
          <em>Быть на связи.</em>
        </h1>
        <p>Уроки, ученики и ежедневные дела — в вашем личном кабинете.</p>
        <div className="story-note">Одна платформа · Своя роль · Свой рабочий день</div>
      </section>
      <section className="login-form">
        <p className="eyebrow">Личный кабинет</p>
        <h2>С возвращением</h2>
        <p className="muted">Войдите в свой аккаунт, чтобы продолжить.</p>
        <form onSubmit={(e) => void login(e)}>
          <LanguageSelector />
          <fieldset disabled={busy}>
            {accounts.length > 0 && (
              <label>
                Тестовый пользователь
                <select
                  aria-label="Тестовый пользователь"
                  value={accounts.find((a) => a.login === email)?.login ?? ''}
                  onChange={(e) => {
                    if (e.target.value) setEmail(e.target.value);
                  }}
                >
                  <option value="">Другой аккаунт</option>
                  {['STUDENT', 'TEACHER', 'MANAGER', 'DIRECTOR', 'TECH_OPERATOR'].map((role) => (
                    <optgroup key={role} label={roleLabels[role]}>
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
              Логин
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
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
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" type="submit">
              {busy ? 'Входим…' : 'Войти в кабинет →'}
            </button>
          </fieldset>
        </form>
        <p className="login-help">
          Внутри кабинета нажмите на аккаунт и выберите «Сменить пользователя», чтобы посмотреть
          платформу с другой ролью.
        </p>
      </section>
    </main>
  );
}
function StateBoundaryAdapter(props: Parameters<typeof StateBoundary>[0] & { enabled: boolean }) {
  return props.enabled ? <StateBoundary {...props} /> : <>{props.children}</>;
}
function Staff({ session }: { session: SessionResponse }) {
  const role = session.account.roles[0] ?? '';
  const director = role === 'DIRECTOR';
  const operator = role === 'TECH_OPERATOR';
  const [data, setData] = useState<Workspace | null>(null);
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
  const [busy, setBusy] = useState(false);
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
        } else if (r.error.status === 401) window.location.replace('/account');
        else {
          setReadFailed(true);
          setReadStatus(r.error.status);
          setError('Не удалось загрузить кабинет. Повторите попытку.');
        }
        setLoading(false);
      });
    return () => abort.abort();
  }, [operator, reload]);
  const name = data?.name ?? roleLabels[role] ?? 'Аккаунт';
  const tabs = operator
    ? [['overview', 'Состояние платформы']]
    : [
        ['overview', 'Обзор'],
        ['lessons', 'Расписание'],
        ['students', director ? 'Ученики школы' : 'Мои ученики'],
        [director ? 'tasks' : 'homework', director ? 'Задачи менеджеров' : 'Домашние задания'],
      ];
  async function logout() {
    if (busy) return;
    setBusy(true);
    const r = await mutation((o) => deleteSession({}, o));
    if (r.ok || r.error.status === 401) window.location.replace('/account');
    else {
      setError('Не удалось выйти. Повторите попытку.');
      setBusy(false);
    }
  }
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
              : tabs.find((t) => t[0] === tab)?.[1]}
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
        at={updatedAt}
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
                <div className="stats">
                  <section>
                    <span>Предстоящих уроков</span>
                    <strong>
                      {
                        data.lessons.filter(
                          (l) => l.status === 'SCHEDULED' && +new Date(l.startsAt) > Date.now(),
                        ).length
                      }
                    </strong>
                    <small>В расписании</small>
                  </section>
                  <section>
                    <span>{director ? 'Учеников с преподавателем' : 'Моих учеников'}</span>
                    <strong>{new Set(data.students.map((s) => s.id)).size}</strong>
                    <small>Активные назначения</small>
                  </section>
                  <section>
                    <span>{director ? 'Открытых задач' : 'Домашних заданий'}</span>
                    <strong>{director ? data.tasks.length : data.homework.length}</strong>
                    <small>{director ? 'Работа команды' : 'Учебная практика'}</small>
                  </section>
                </div>
              )}
              {(tab === 'overview' || tab === 'lessons') && (
                <section className="panel">
                  <div className="section-heading">
                    <h2>{tab === 'overview' ? 'Ближайшие занятия' : 'Расписание занятий'}</h2>
                    <span>Время Кишинёва</span>
                  </div>
                  {data.lessons.length ? (
                    <div className="lesson-list">
                      {data.lessons.slice(0, tab === 'overview' ? 4 : 100).map((l) => (
                        <article className="lesson" key={l.id}>
                          <div className="lesson-date">
                            <strong>
                              {new Date(l.startsAt).toLocaleDateString('ru-RU', {
                                timeZone: 'Europe/Chisinau',
                                day: 'numeric',
                              })}
                            </strong>
                            <span>
                              {new Date(l.startsAt).toLocaleDateString('ru-RU', {
                                timeZone: 'Europe/Chisinau',
                                month: 'short',
                              })}
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
        sidebarFooter={
          <button type="button" disabled={busy} onClick={() => void logout()}>
            Выйти из аккаунта
          </button>
        }
        footer="K8K Academy · Часовой пояс Europe/Chisinau"
      >
        {content}
      </AppShell>
    );
  return (
    <div className="staff-app">
      <a className="skip" href="#content">
        К содержимому
      </a>
      <aside className="sidebar">
        <a className="brand" href={roleHome(role)}>
          a
          <span>
            Academy<small>{roleLabels[role]}</small>
          </span>
        </a>
        <p className="sidebar-label">Рабочее пространство</p>
        <nav aria-label="Разделы кабинета">
          {tabs.map(([key, title]) => (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => {
                setTab(key!);
                document.getElementById('content')?.focus();
              }}
            >
              {title}
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          Всё для вашего
          <br />
          учебного дня.<span>Academy · Онлайн-школа</span>
        </div>
        <button className="logout" disabled={busy} onClick={() => void logout()}>
          Выйти из аккаунта ↗
        </button>
      </aside>
      <div className="staff-main">
        <header className="topbar">
          <span>Личный кабинет</span>
          <AccountMenu name={name} role={role} />
        </header>
        <main id="content" tabIndex={-1}>
          {content}
        </main>
        <footer>Academy · Часовой пояс Europe/Chisinau</footer>
      </div>
    </div>
  );
}
export function App() {
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
        Открываем ваш кабинет…
      </main>
    );
  if (error)
    return (
      <main className="boot">
        <h1>Не удалось подключиться</h1>
        <p>Проверьте соединение и повторите попытку.</p>
        <button onClick={() => window.location.reload()}>Повторить</button>
      </main>
    );
  return session ? <Staff session={session} /> : <Login />;
}
