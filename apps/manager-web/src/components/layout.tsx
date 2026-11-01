import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { deleteSession } from '@online-school/api-contracts';
import { create } from 'zustand';
import { clearSession, write } from '../api/client.js';
import { useManager } from '../session.js';
import { ru } from '../i18n/ru.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
import { Icon, Initials } from './icon.js';
import type { IconName } from './icon.js';
const useNavigation = create<{ expanded: boolean; toggle: () => void }>((set) => ({
  expanded: false,
  toggle: () => set((s) => ({ expanded: !s.expanded })),
}));
const links: Array<{ to: string; label: string; icon: IconName }> = [
  { to: routes.dashboard, label: ru.dashboard, icon: 'home' },
  { to: routes.students, label: ru.students, icon: 'users' },
  { to: routes.schedule, label: ru.schedule, icon: 'calendar' },
  { to: routes.tasks, label: ru.tasks, icon: 'tasks' },
];
export function Layout() {
  const me = useManager();
  const nav = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, []);
  async function logout() {
    if (busy) return;
    setBusy(true);
    const result = await write((o) => deleteSession({}, o), crypto.randomUUID());
    clearSession();
    setBusy(false);
    navigate(routes.login, {
      replace: true,
      state: !result.ok && result.error.status !== 401 ? { sessionError: result.error } : null,
    });
  }
  return (
    <div className={`workspace ${nav.expanded ? 'nav-expanded' : ''}`}>
      <a className="skip" href="#main">
        {ru.skip}
      </a>
      <aside className="sidebar">
        <Link className="brand" to={routes.dashboard} aria-label={ru.academy}>
          <span className="brand-mark">
            <Icon name="academy" size={33} />
          </span>
          <span>
            {ru.brandShort}
            <small>{ru.managerPanel}</small>
          </span>
        </Link>
        <div className="sidebar-section-label">{ru.workspace}</div>
        <nav aria-label={ru.menu}>
          {links.map((link) => (
            <Link
              aria-label={link.label}
              key={link.to}
              aria-current={
                (
                  link.to === routes.dashboard
                    ? location.pathname.replace(/\/$/, '') === routes.dashboard
                    : location.pathname.startsWith(link.to)
                )
                  ? 'page'
                  : undefined
              }
              to={link.to}
            >
              <span>
                <Icon name={link.icon} size={21} />
              </span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-subsection">
          <span className="sidebar-section-label">{ru.myPortfolio}</span>
          <Link to={`${routes.students}?status=LEAD`}>
            <Icon name="plus" size={17} />
            {ru.newLeads}
            <Icon name="chevron" size={13} />
          </Link>
          <Link to={`${routes.students}?expiring=true`}>
            <Icon name="wallet" size={17} />
            {ru.expiring}
            <Icon name="chevron" size={13} />
          </Link>
        </div>
        <details className="sidebar-help">
          <summary>
            <Icon name="book" size={23} />
            <span>{ru.howToWork}</span>
          </summary>
          <p>{ru.helpCaption}</p>
        </details>
        <div className="sidebar-foot">
          <Initials name={me.displayName} />
          <div>
            <p>{me.displayName}</p>
            <small>{ru.managerPanel}</small>
          </div>
          <button
            className="icon-button"
            type="button"
            disabled={busy}
            onClick={() => {
              void logout();
            }}
            aria-label={ru.logout}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={nav.expanded}
            onClick={nav.toggle}
          >
            {ru.menu}
          </button>
          <form
            className="global-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const value = search.current?.value.trim() ?? '';
              if (value.length >= 2)
                navigate(`${routes.students}?search=${encodeURIComponent(value)}`);
            }}
          >
            <Icon name="search" size={18} />
            <input
              ref={search}
              type="search"
              name="search"
              minLength={2}
              maxLength={100}
              aria-label={ru.globalSearch}
              placeholder={ru.globalSearch}
            />
            <kbd aria-hidden="true">⌘ K</kbd>
          </form>
          <div className="topbar-tools">
            <Link className="icon-button" to={routes.tasks} aria-label={ru.openQueue}>
              <Icon name="tasks" />
            </Link>
            <Link className="icon-button" to={routes.schedule} aria-label={ru.workingCalendar}>
              <Icon name="calendar" />
            </Link>
            <time className="topbar-date">
              {new Intl.DateTimeFormat('ru-RU', {
                timeZone: me.timezone,
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(new Date())}
              <small>{me.timezone}</small>
            </time>
            <span className="topbar-avatar">
              <Initials name={me.displayName} />
            </span>
          </div>
          <button
            className="mobile-logout icon-button"
            type="button"
            disabled={busy}
            onClick={() => {
              void logout();
            }}
            aria-label={ru.logout}
          >
            <Icon name="logout" />
          </button>
        </header>
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-foot">
          <Icon name="shield" size={13} />
          {ru.localTime} {me.timezone}
        </footer>
      </div>
    </div>
  );
}
