import { Suspense, useEffect, useRef, useState } from 'react';
import { AccountMenu, leaveSession } from '@online-school/account-ui';
import type { AccountLogoutOutcome } from '@online-school/account-ui';
import {
  AppShell,
  studentActiveNavigation,
  k8kEnabled,
  formatDate,
  useContextRefresh,
  operationalQueryInterval,
  refreshPolicies,
  useLocale,
  useDataAge,
} from '@online-school/ui';
import '@online-school/account-ui/style.css';
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
import { queryClient, StudentDeadlineRead, useStudentQuery, write } from './api.js';
import { date, dayKey, Empty, Icon, Modal, Panel, QueryState, setDateZone } from './components.js';
import { useUI } from './ui-store.js';
import { useStudentCopy } from './student-copy.js';
import { StudentNotificationMenu } from './StudentNotificationMenu.js';
import { ManagerContacts, StudentManagerCard } from './student-widgets.js';
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
type StudentViewProfile = StudentMeResponseDto & { managerContactsUnavailable?: boolean };
export function useMe() {
  return useOutletContext<StudentViewProfile>();
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
      <QueryState operational query={lessons}>
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
function RightSidebar({ me, inline = false }: { me: StudentViewProfile; inline?: boolean }) {
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
        <QueryState operational query={dashboard}>
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
      <StudentManagerCard
        id={inline ? 'mobile-manager' : 'manager-contacts'}
        contacts={me.managerContacts}
        unavailable={me.managerContactsUnavailable}
      />
    </aside>
  );
}
export function StudentLayout() {
  const { locale, t } = useLocale();
  const { copy } = useStudentCopy();
  const me = useStudentQuery(['me'], getStudentMe, true, 60_000);
  const contactsTooOld = useDataAge(me.dataUpdatedAt, 120_000);
  const account = useRef<string>();
  const accountId = me.data?.userId;
  const replaced = !!account.current && !!accountId && account.current !== accountId;
  const denied = !!me.error && 'status' in me.error && me.error.status === 403;
  useEffect(() => {
    if (replaced) leaveSession('/');
    else if (accountId) account.current = accountId;
  }, [accountId, replaced]);
  useEffect(() => {
    if (!denied) return;
    const privateQueries = {
      predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[1] !== 'me',
    };
    void queryClient.cancelQueries(privateQueries, { silent: true });
    queryClient.removeQueries(privateQueries);
    queryClient.getMutationCache().clear();
  }, [denied]);
  const location = useLocation(),
    heading = useRef<HTMLElement>(null);
  const { sidebar, toggle, close } = useUI();
  const unread = useStudentQuery(
    ['unread'],
    getStudentUnreadNotificationCount,
    !denied && !replaced && !!me.data && !me.data.mustChangePassword && me.data.hasActiveAccess,
    60_000,
  );
  const autoReads =
    k8kEnabled && !denied && !replaced && !!me.data?.hasActiveAccess && !me.data.mustChangePassword;
  const { request: requestOperationalRead } = useContextRefresh({
    enabled: autoReads,
    context: 'operational',
    refresh: () =>
      queryClient.refetchQueries(
        {
          type: 'active',
          predicate: (query) =>
            query.queryKey[0] === 'student' &&
            operationalQueryInterval(query.queryKey) === refreshPolicies.operational,
        },
        { cancelRefetch: false },
      ),
  });
  const liveLesson = /^\/student\/lessons\/[^/]+/.test(location.pathname);
  const { request: requestLiveRead } = useContextRefresh({
    enabled: autoReads && liveLesson,
    context: 'live-lesson',
    refresh: () =>
      queryClient.refetchQueries(
        {
          type: 'active',
          predicate: (query) =>
            query.queryKey[0] === 'student' &&
            operationalQueryInterval(query.queryKey) === refreshPolicies['live-lesson'],
        },
        { cancelRefetch: false },
      ),
  });
  useEffect(() => {
    close();
    heading.current?.focus({ preventScroll: k8kEnabled });
    if (!k8kEnabled) window.scrollTo(0, 0);
  }, [location.pathname, close]);
  async function logout(): Promise<AccountLogoutOutcome> {
    try {
      await write((o) => deleteSession({}, o));
      return 'ended';
    } catch (error) {
      const status = error && typeof error === 'object' && 'status' in error ? error.status : null;
      if (status === 401) return 'ended';
      const invalid =
        error && typeof error === 'object' && 'code' in error && error.code === 'INVALID_RESPONSE';
      return invalid || typeof status !== 'number' || status === 0 || status >= 500
        ? 'unknown'
        : 'rejected';
    }
  }
  if (replaced) return null;
  if (!denied && me.data?.mustChangePassword)
    return <Navigate to="/student/security/change-password" replace />;
  if (!denied && me.data && !me.data.hasActiveAccess)
    return <Navigate to="/student/suspended" replace />;
  if (denied || !me.data)
    return (
      <main className="standalone">
        <h1>{t('cabinetStudent')}</h1>
        <QueryState query={me}>{null}</QueryState>
      </main>
    );
  const profile: StudentViewProfile =
    me.error || contactsTooOld ? { ...me.data, managerContactsUnavailable: true } : me.data;
  setDateZone(profile.timeZone);
  if (k8kEnabled)
    return (
      <AppShell
        role="STUDENT"
        timeZone={profile.timeZone}
        activeId={studentActiveNavigation(location.pathname)}
        renderNavigation={(item, content, props) => (
          <Link to={item.href!} {...props}>
            {content}
          </Link>
        )}
        mainId="main-content"
        mainRef={heading}
        header={
          location.pathname === '/student' ? (
            <h1 className="k8k-home-greeting">
              {copy.greeting}, {profile.displayName}!
            </h1>
          ) : undefined
        }
        account={
          <AccountMenu
            name={profile.displayName}
            role="STUDENT"
            onLogout={logout}
            logoutPath="/student/login"
            links={[
              { href: '/student/profile', label: copy.profile },
              { href: '/student/security', label: copy.security },
            ].map(({ href, label }) => (
              <Link
                key={href}
                className="account-login-link k8k-student-account-link"
                to={href}
                onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
              >
                {label}
              </Link>
            ))}
          />
        }
        notifications={
          <StudentNotificationMenu
            count={unread.error ? undefined : unread.data?.unreadCount}
            countError={unread.error}
            retryCount={() => unread.refetch()}
            timeZone={profile.timeZone}
          />
        }
      >
        <StudentDeadlineRead.Provider value={liveLesson ? requestLiveRead : requestOperationalRead}>
          <Suspense fallback={<p role="status">{t('loading')}</p>}>
            <Outlet context={profile} />
          </Suspense>
        </StudentDeadlineRead.Provider>
      </AppShell>
    );
  const nav = navigation.map(([icon, path]) => (
    <NavLink key={icon} end={path === ''} to={`/student${path}`}>
      <Icon name={icon} />
      <span>
        {t(icon === 'lessons' ? 'lessonsShort' : icon === 'homework' ? 'nav.homework' : icon)}
      </span>
      {icon === 'notifications' && !!unread.data?.unreadCount && (
        <span className="badge" aria-label={`${unread.data.unreadCount} ${t('bellUnread')}`}>
          {unread.data.unreadCount}
        </span>
      )}
    </NavLink>
  ));
  return (
    <div className="student-app">
      <a className="skip-link" href="#main-content">
        {t('skip')}
      </a>
      <aside className="left-sidebar">
        <Link className="brand" to="/student">
          <span className="brand-icon">
            <Icon name="academy" />
          </span>
          <span>
            Academy<small>{t('cabinetStudent')}</small>
          </span>
        </Link>
        <nav aria-label={t('primaryNavigation')}>{nav}</nav>
        <a className="manager-shortcut" href="#manager-contacts">
          <Icon name="manager" />
          {t('chrome.contactManager')}
        </a>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="menu-toggle"
            onClick={toggle}
            aria-label={t('sections')}
            aria-expanded={sidebar}
          >
            <Icon name="menu" />
          </button>
          <strong>{t('auth.cabinet')}</strong>
          <time className="header-date">{formatDate(Date.now(), locale, profile.timeZone)}</time>
          <div className="topbar-profile">
            <Link
              className="bell"
              to="/student/notifications"
              aria-label={`${t('notifications')}${unread.data?.unreadCount ? `, ${t('bellUnread')} ${unread.data.unreadCount}` : ''}`}
            >
              <Icon name="notifications" />
              {!!unread.data?.unreadCount && (
                <span className="badge">{unread.data.unreadCount}</span>
              )}
            </Link>
            <AccountMenu
              name={profile.displayName}
              role="STUDENT"
              onLogout={logout}
              logoutPath="/student/login"
            />
          </div>
        </header>
        <div className="content-grid">
          <main id="main-content" ref={heading} tabIndex={-1}>
            <Suspense fallback={<p role="status">{t('loading')}</p>}>
              <Outlet context={profile} />
            </Suspense>
            <details className="inline-widgets">
              <summary>{t('chrome.studentWidgets')}</summary>
              <RightSidebar me={profile} inline />
            </details>
          </main>
          <RightSidebar me={profile} />
        </div>
      </div>
      <nav className="bottom-nav" aria-label={t('mobileNavigation')}>
        {navigation.slice(0, 4).map(([icon, path]) => (
          <NavLink key={icon} end={path === ''} to={`/student${path}`}>
            <Icon name={icon} />
            <span>
              {t(icon === 'lessons' ? 'lessonsShort' : icon === 'skills' ? 'skillsShort' : icon)}
            </span>
          </NavLink>
        ))}
        <button onClick={toggle} aria-label={t('sections')} aria-expanded={sidebar}>
          <Icon name="more" />
          <span>{t('more')}</span>
        </button>
      </nav>
      {sidebar && (
        <Modal title={t('sections')} close={close} className="navigation-drawer">
          <nav>{nav}</nav>
          <ManagerContacts
            contacts={profile.managerContacts}
            unavailable={profile.managerContactsUnavailable}
          />
        </Modal>
      )}
    </div>
  );
}
