import { useEffect, useRef } from 'react';
import { AccountMenu } from '@online-school/account-ui';
import type { AccountLogoutOutcome } from '@online-school/account-ui';
import {
  AppShell,
  activeNavigation,
  k8kEnabled,
  roleNavigation,
  operationalQueryInterval,
  useContextRefresh,
  useLocale,
} from '@online-school/ui';
import type { PlainMessageKey } from '@online-school/ui';
import '@online-school/account-ui/style.css';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { deleteSession } from '@online-school/api-contracts';
import { create } from 'zustand';
import { queryClient, write } from '../api/client.js';
import { useManager } from '../session.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
import { Icon } from './icon.js';
import type { IconName } from './icon.js';
const useNavigation = create<{ expanded: boolean; toggle: () => void }>((set) => ({
  expanded: false,
  toggle: () => set((s) => ({ expanded: !s.expanded })),
}));
const links: Array<{ to: string; label: PlainMessageKey; icon: IconName }> = [
  { to: routes.dashboard, label: 'overview', icon: 'home' },
  { to: routes.leads, label: 'leads', icon: 'mail' },
  { to: routes.students, label: 'students', icon: 'users' },
  { to: routes.schedule, label: 'schedule', icon: 'calendar' },
  { to: routes.tasks, label: 'tasks', icon: 'tasks' },
];
export function Layout() {
  const { t, intlLocale } = useLocale();
  const me = useManager();
  const nav = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const search = useRef<HTMLInputElement>(null);
  useContextRefresh({
    enabled: k8kEnabled,
    context: 'operational',
    refresh: () =>
      queryClient.refetchQueries(
        {
          type: 'active',
          predicate: (query) =>
            query.queryKey[0] === 'manager' && operationalQueryInterval(query.queryKey) !== false,
        },
        { cancelRefetch: false },
      ),
  });
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
  async function logout(): Promise<AccountLogoutOutcome> {
    const result = await write((o) => deleteSession({}, o), crypto.randomUUID());
    if (result.ok || result.error.status === 401) return 'ended';
    return result.error.status === 0 ||
      result.error.status >= 500 ||
      result.error.code === 'INVALID_RESPONSE'
      ? 'unknown'
      : 'rejected';
  }
  if (k8kEnabled)
    return (
      <AppShell
        role="MANAGER"
        timeZone={me.timezone}
        activeId={activeNavigation(roleNavigation.MANAGER, location.pathname)}
        renderNavigation={(item, content, props) => (
          <Link to={item.href!} {...props}>
            {content}
          </Link>
        )}
        mainId="main"
        account={
          <AccountMenu
            name={me.displayName}
            role="MANAGER"
            onLogout={logout}
            logoutPath={routes.login}
          />
        }
        header={
          <form
            role="search"
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault();
              const value = search.current?.value.trim() ?? '';
              if (value.length >= 2)
                navigate(`${routes.students}?search=${encodeURIComponent(value)}`);
            }}
          >
            <Icon name="search" />
            <input
              ref={search}
              name="search"
              type="search"
              minLength={2}
              maxLength={100}
              aria-label={t('chrome.managerSearch')}
              placeholder={t('chrome.managerSearch')}
            />
            <kbd aria-hidden="true">⌘ K</kbd>
          </form>
        }
        sidebarFooter={
          <>
            <Link to={`${routes.leads}?stage=NEW`}>{t('chrome.newLeads')}</Link>
            <Link to={`${routes.students}?expiring=true`}>{t('chrome.expiring')}</Link>
            <details>
              <summary>{t('chrome.howToWork')}</summary>
              <p>{t('chrome.managerHelp')}</p>
            </details>
          </>
        }
        footer={
          <>
            {t('chrome.schoolTime')} {me.timezone}
          </>
        }
      >
        <Outlet />
      </AppShell>
    );
  return (
    <div className={`workspace ${nav.expanded ? 'nav-expanded' : ''}`}>
      <a className="skip" href="#main">
        {t('skip')}
      </a>
      <aside className="sidebar">
        <Link className="brand" to={routes.dashboard} aria-label="K8K Academy">
          <span className="brand-mark">
            <Icon name="academy" size={33} />
          </span>
          <span>
            Academy
            <small>{t('cabinetManager')}</small>
          </span>
        </Link>
        <div className="sidebar-section-label">{t('workspace')}</div>
        <nav aria-label={t('chrome.menu')}>
          {links.map((link) => (
            <Link
              aria-label={t(link.label)}
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
              <span>{t(link.label)}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-subsection">
          <span className="sidebar-section-label">{t('chrome.myPortfolio')}</span>
          <Link to={`${routes.leads}?stage=NEW`}>
            <Icon name="plus" size={17} />
            {t('chrome.newLeads')}
            <Icon name="chevron" size={13} />
          </Link>
          <Link to={`${routes.students}?expiring=true`}>
            <Icon name="wallet" size={17} />
            {t('chrome.expiring')}
            <Icon name="chevron" size={13} />
          </Link>
        </div>
        <details className="sidebar-help">
          <summary>
            <Icon name="book" size={23} />
            <span>{t('chrome.howToWork')}</span>
          </summary>
          <p>{t('chrome.managerHelp')}</p>
        </details>
      </aside>
      <div className="content">
        <header className="topbar">
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={nav.expanded}
            onClick={nav.toggle}
          >
            {t('chrome.menu')}
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
              aria-label={t('chrome.managerSearch')}
              placeholder={t('chrome.managerSearch')}
            />
            <kbd aria-hidden="true">⌘ K</kbd>
          </form>
          <div className="topbar-tools">
            <Link className="icon-button" to={routes.tasks} aria-label={t('chrome.openQueue')}>
              <Icon name="tasks" />
            </Link>
            <Link
              className="icon-button"
              to={routes.schedule}
              aria-label={t('chrome.workingCalendar')}
            >
              <Icon name="calendar" />
            </Link>
            <time className="topbar-date">
              {new Intl.DateTimeFormat(intlLocale, {
                timeZone: me.timezone,
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(new Date())}
              <small>{me.timezone}</small>
            </time>
          </div>
          <AccountMenu
            name={me.displayName}
            role="MANAGER"
            onLogout={logout}
            logoutPath={routes.login}
          />
        </header>
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-foot">
          <Icon name="shield" size={13} />
          {t('chrome.schoolTime')} {me.timezone}
        </footer>
      </div>
    </div>
  );
}
