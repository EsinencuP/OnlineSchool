import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import {
  deleteSession,
  getStudentDashboard,
  getStudentLessons,
  getStudentMaterials,
  getStudentMe,
  getStudentUnreadNotificationCount,
} from '@online-school/api-contracts';
import type { StudentMeResponseDto } from '@online-school/api-contracts';
import { queryClient, resetAccess, useStudentQuery, write } from './api.js';
import {
  date,
  dayKey,
  Empty,
  ErrorNotice,
  Icon,
  Modal,
  Panel,
  QueryState,
  safeUrl,
  setDateZone,
} from './components.js';
import { useUI } from './ui-store.js';
export const navigation = [
  ['home', '', 'Главная'],
  ['lessons', '/lessons', 'Уроки'],
  ['homework', '/homework', 'Домашние задания'],
  ['skills', '/skills', 'Мой путь знаний'],
  ['materials', '/materials', 'Материалы'],
  ['subscription', '/subscription', 'Абонемент'],
  ['notifications', '/notifications', 'Уведомления'],
  ['profile', '/profile', 'Профиль и настройки'],
] as const;
export function useMe() {
  return useOutletContext<StudentMeResponseDto>();
}
export function ManagerContacts({
  contacts,
}: {
  contacts?: StudentMeResponseDto['managerContacts'];
}) {
  const whatsapp = safeUrl(contacts?.whatsapp, 'whatsapp'),
    telegram = safeUrl(contacts?.telegram, 'telegram');
  return (
    <div className="manager-contacts">
      {whatsapp && (
        <a className="button" href={whatsapp} target="_blank" rel="noreferrer">
          WhatsApp ↗
        </a>
      )}
      {telegram && (
        <a className="button" href={telegram} target="_blank" rel="noreferrer">
          Telegram ↗
        </a>
      )}
      {!whatsapp && !telegram && (
        <p className="muted">Контакты пока не указаны. Обратитесь в школу привычным способом.</p>
      )}
    </div>
  );
}
function MiniCalendar() {
  const [month, setMonth] = useState(() => dayKey(new Date().toISOString()).slice(0, 7));
  const [selected, setSelected] = useState(() => dayKey(new Date().toISOString()));
  const lessons = useStudentQuery(
    ['calendar', month],
    (o) => getStudentLessons({ month }, o),
    true,
    60_000,
  );
  const first = new Date(`${month}-01T12:00:00Z`),
    days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate(),
    offset = (first.getUTCDay() + 6) % 7;
  function move(delta: number) {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth() + delta);
    setMonth(next.toISOString().slice(0, 7));
    setSelected(next.toISOString().slice(0, 10));
  }
  return (
    <Panel title="Мой календарь">
      <div className="calendar-heading">
        <strong>
          {first.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </strong>
        <div>
          <button aria-label="Предыдущий месяц" onClick={() => move(-1)}>
            ‹
          </button>
          <button aria-label="Следующий месяц" onClick={() => move(1)}>
            ›
          </button>
        </div>
      </div>
      <div className="mini-calendar">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
          <span key={d} className="muted">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, '0')}`,
            has = lessons.data?.items.some((l) => dayKey(l.scheduledAt) === key);
          return (
            <button
              key={key}
              className={`${key === selected ? 'selected' : ''} ${has ? 'has-lesson' : ''}`}
              aria-label={`${date(key)}${has ? ', есть урок' : ''}`}
              aria-pressed={key === selected}
              onClick={() => setSelected(key)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <QueryState query={lessons}>
        {lessons.data?.items
          .filter((l) => dayKey(l.scheduledAt) === selected)
          .map((l) => (
            <Link
              className="calendar-lesson"
              key={l.lessonId}
              to={`/student/lessons/${l.lessonId}`}
            >
              <strong>{date(l.scheduledAt, true)}</strong>
              <span>{l.subjectName}</span>
            </Link>
          ))}
        {!lessons.data?.items.some((l) => dayKey(l.scheduledAt) === selected) && (
          <p className="muted">На этот день уроков нет</p>
        )}
      </QueryState>
    </Panel>
  );
}
function RightSidebar({ me, inline = false }: { me: StudentMeResponseDto; inline?: boolean }) {
  const dashboard = useStudentQuery(['dashboard'], getStudentDashboard, true, 60_000);
  const materials = useStudentQuery(['quick-materials'], (o) =>
    getStudentMaterials({ pageSize: 3 }, o),
  );
  return (
    <aside
      className={inline ? 'right-sidebar inline-sidebar' : 'right-sidebar'}
      aria-label={inline ? 'Полезное в содержимом страницы' : 'Календарь и полезное'}
    >
      <MiniCalendar />
      <Panel title="Абонемент" to="/student/subscription">
        <QueryState query={dashboard}>
          {dashboard.data?.subscription ? (
            <>
              <div className="balance">
                <Icon name="subscription" />
                <strong>{dashboard.data.subscription.lessonsRemaining}</strong>
                <span>занятий осталось</span>
              </div>
              <p className="muted">Действует до {date(dashboard.data.subscription.validUntil)}</p>
              {dashboard.data.subscription.isFrozen && (
                <p>Заморожен до {date(dashboard.data.subscription.frozenUntil)}</p>
              )}
            </>
          ) : (
            <Empty>Нет активного абонемента</Empty>
          )}
        </QueryState>
      </Panel>
      <Panel title="Материалы" to="/student/materials">
        <QueryState query={materials}>
          {materials.data?.items.length ? (
            materials.data.items.map((m) => (
              <Link className="material-preview" key={m.fileId} to="/student/materials">
                <Icon name="materials" />
                <span>
                  {m.fileName}
                  <small>{m.subjectName}</small>
                </span>
              </Link>
            ))
          ) : (
            <Empty>Материалы появятся после назначения преподавателем.</Empty>
          )}
        </QueryState>
      </Panel>
      <section className="panel" id={inline ? 'mobile-manager' : 'manager-contacts'}>
        <Icon name="manager" />
        <h2>Ваш менеджер</h2>
        <p className="muted">Поможет с расписанием и вопросами по обучению.</p>
        <ManagerContacts contacts={me.managerContacts} />
      </section>
    </aside>
  );
}
export function StudentLayout() {
  const me = useStudentQuery(['me'], getStudentMe, true, 60_000);
  const location = useLocation(),
    heading = useRef<HTMLElement>(null);
  const { sidebar, toggle, close } = useUI();
  const unread = useStudentQuery(
    ['unread'],
    getStudentUnreadNotificationCount,
    !!me.data && !me.data.mustChangePassword && me.data.hasActiveAccess,
    60_000,
  );
  const [logoutError, setLogoutError] = useState<unknown>(null),
    [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    close();
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname, close]);
  async function logout() {
    setLoggingOut(true);
    try {
      await write((o) => deleteSession({}, o));
      queryClient.clear();
      resetAccess();
      window.location.replace('/student/login');
    } catch (error) {
      setLogoutError(error);
    } finally {
      setLoggingOut(false);
    }
  }
  if (me.data?.mustChangePassword)
    return <Navigate to="/student/security/change-password" replace />;
  if (me.data && !me.data.hasActiveAccess) return <Navigate to="/student/suspended" replace />;
  if (!me.data)
    return (
      <main className="standalone">
        <h1>Кабинет ученика</h1>
        <QueryState query={me}>{null}</QueryState>
      </main>
    );
  const profile = me.data;
  setDateZone(profile.timeZone);
  const nav = navigation.map(([icon, path, label]) => (
    <NavLink key={icon} end={path === ''} to={`/student${path}`}>
      <Icon name={icon} />
      <span>{label}</span>
      {icon === 'notifications' && !!unread.data?.unreadCount && (
        <span className="badge" aria-label={`${unread.data.unreadCount} непрочитанных`}>
          {unread.data.unreadCount}
        </span>
      )}
    </NavLink>
  ));
  return (
    <div className="student-app">
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <aside className="left-sidebar">
        <Link className="brand" to="/student">
          <span className="brand-icon">
            <Icon name="academy" />
          </span>
          <span>
            Academy<small>Кабинет ученика</small>
          </span>
        </Link>
        <nav aria-label="Основная навигация">{nav}</nav>
        <a className="manager-shortcut" href="#manager-contacts">
          <Icon name="manager" />
          Связаться с менеджером
        </a>
        <button className="logout" onClick={() => void logout()} disabled={loggingOut}>
          {loggingOut ? 'Выходим…' : 'Выйти'}
        </button>
        <ErrorNotice error={logoutError} />
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu-toggle"
            onClick={toggle}
            aria-label="Открыть меню"
            aria-expanded={sidebar}
          >
            <Icon name="menu" />
          </button>
          <strong>Личный кабинет</strong>
          <time className="header-date">{date(new Date().toISOString())}</time>
          <div className="topbar-profile">
            <Link
              className="bell"
              to="/student/notifications"
              aria-label={`Уведомления${unread.data?.unreadCount ? `, непрочитанных ${unread.data.unreadCount}` : ''}`}
            >
              <Icon name="notifications" />
              {!!unread.data?.unreadCount && (
                <span className="badge">{unread.data.unreadCount}</span>
              )}
            </Link>
            <Link className="profile-link" to="/student/profile">
              <span className="avatar">{profile.displayName.slice(0, 1)}</span>
              <span>
                {profile.displayName}
                <small>Ученик</small>
              </span>
            </Link>
          </div>
        </header>
        <div className="content-grid">
          <main id="main-content" ref={heading} tabIndex={-1}>
            <Outlet context={profile} />
            <details className="inline-widgets">
              <summary>Календарь, абонемент и контакты</summary>
              <RightSidebar me={profile} inline />
            </details>
          </main>
          <RightSidebar me={profile} />
        </div>
      </div>
      <nav className="bottom-nav" aria-label="Мобильная навигация">
        {navigation.slice(0, 4).map(([icon, path, label]) => (
          <NavLink key={icon} end={path === ''} to={`/student${path}`}>
            <Icon name={icon} />
            <span>
              {label === 'Домашние задания'
                ? 'Задания'
                : label === 'Мой путь знаний'
                  ? 'Мой путь'
                  : label}
            </span>
          </NavLink>
        ))}
        <button onClick={toggle} aria-label="Все разделы" aria-expanded={sidebar}>
          <Icon name="more" />
          <span>Ещё</span>
        </button>
      </nav>
      {sidebar && (
        <Modal title="Все разделы" close={close} className="navigation-drawer">
          <nav>{nav}</nav>
          <ManagerContacts contacts={profile.managerContacts} />
          <button onClick={() => void logout()} disabled={loggingOut}>
            Выйти
          </button>
          <ErrorNotice error={logoutError} />
        </Modal>
      )}
    </div>
  );
}
