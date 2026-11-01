import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { deleteSession } from '@online-school/api-contracts';
import { create } from 'zustand';
import { clearSession, write } from '../api/client.js';
import { useManager } from '../session.js';
import { ru } from '../i18n/ru.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
const useNavigation = create<{ expanded: boolean; toggle: () => void }>((set) => ({
  expanded: false,
  toggle: () => set((s) => ({ expanded: !s.expanded })),
}));
const links = [
  { to: routes.dashboard, label: ru.dashboard, icon: '▦' },
  { to: routes.students, label: ru.students, icon: '◉' },
  { to: routes.schedule, label: ru.schedule, icon: '▤' },
  { to: routes.tasks, label: ru.tasks, icon: '☑' },
];
export function Layout() {
  const me = useManager();
  const nav = useNavigation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
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
        <a className="brand" href={routes.dashboard} aria-label={ru.academy}>
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span>
            {ru.academy}
            <small>{ru.workspace}</small>
          </span>
        </a>
        <nav aria-label={ru.menu}>
          {links.map((link) => (
            <NavLink
              aria-label={link.label}
              key={link.to}
              end={link.to === routes.dashboard}
              to={link.to}
            >
              <span aria-hidden="true">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p>{me.displayName}</p>
          <small>{me.timezone}</small>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void logout();
            }}
          >
            {ru.logout}
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
          <span>{ru.workspace}</span>
          <span className="profile-chip">
            {me.displayName}
            <small>
              {ru.portfolio}: {me.portfolioSize}
            </small>
          </span>
          <button
            className="mobile-logout"
            type="button"
            disabled={busy}
            onClick={() => {
              void logout();
            }}
          >
            {ru.logout}
          </button>
        </header>
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-foot">
          {ru.localTime} {me.timezone}
        </footer>
      </div>
    </div>
  );
}
