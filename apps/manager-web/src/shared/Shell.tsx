import { Bell, CircleAlert, CircleCheck, Menu, RotateCcw, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { fmtDayLong } from './format';
import type { Toast } from './store';
import { Avatar } from './ui';

export type Role = 'director' | 'manager' | 'teacher' | 'student';

export const ROLE_LABEL: Record<Role, string> = {
  director: 'Руководитель',
  manager: 'Менеджер',
  teacher: 'Преподаватель',
  student: 'Ученик',
};

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  count?: number;
  /** Visually groups items under a caption. */
  group?: string;
}

interface ShellProps {
  role: Role;
  nav: NavItem[];
  person: { name: string; caption: string };
  now: string;
  search: { placeholder: string; to: string };
  bell: { count: number; to: string; label: string };
  toasts: Toast[];
  dismiss: (id: number) => void;
  onReset: () => void;
  sidebarExtra?: ReactNode;
}

/** One shell for all three cabinets: same structure, role-specific accent and navigation. */
export function Shell({ role, nav, person, now, search, bell, toasts, dismiss, onReset, sidebarExtra }: ShellProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  let lastGroup: string | undefined;

  return (
    <div className="shell" data-role={role}>
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Навигация кабинета">
        <div className="brand">
          <img src="/logo.svg" alt="2K Academy" />
        </div>
        <nav style={{ display: 'grid', gap: 2 }}>
          {nav.map((item) => {
            const head = item.group && item.group !== lastGroup ? item.group : null;
            lastGroup = item.group ?? lastGroup;
            return (
              <div key={item.to} style={{ display: 'contents' }}>
                {head && <div className="nav-group">{head}</div>}
                <NavLink to={item.to} end={item.to.split('/').length === 2} className="nav-link" onClick={() => setOpen(false)}>
                  {item.icon}
                  {item.label}
                  {item.count ? (
                    <span className="count" aria-label={`${item.count} требуют внимания`}>
                      {item.count}
                    </span>
                  ) : null}
                </NavLink>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          {sidebarExtra}
          <button type="button" className="nav-link" style={{ background: 'none', border: 0 }} onClick={onReset}>
            <RotateCcw size={18} /> Сбросить демо-данные
          </button>
          <div className="me-card">
            <Avatar name={person.name} />
            <div style={{ minWidth: 0 }}>
              <b>{person.name}</b>
              <span>{person.caption}</span>
            </div>
          </div>
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" aria-label="Открыть меню" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Menu size={18} />
          </button>
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`${search.to}?q=${encodeURIComponent(query)}`);
            }}
          >
            <span className="search-icon">
              <Search size={16} />
            </span>
            <label htmlFor="global-search" className="sr-only">
              Поиск
            </label>
            <input id="global-search" placeholder={search.placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
          </form>
          <div className="top-actions">
            <RoleSwitch role={role} />
            <span className="date-pill">{fmtDayLong(now)}</span>
            <button type="button" className="icon-btn" aria-label={bell.label} onClick={() => navigate(bell.to)}>
              <Bell size={18} />
              {bell.count > 0 && <span className="dot" />}
            </button>
          </div>
        </header>
        <main key={location.pathname}>
          <Outlet />
        </main>
      </div>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            {t.tone === 'ok' ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
            <span>{t.text}</span>
            <button type="button" className="link" style={{ color: '#fff', marginLeft: 'auto' }} onClick={() => dismiss(t.id)}>
              OK
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Demo-only switch between cabinets (no login in this build). */
function RoleSwitch({ role }: { role: Role }) {
  const navigate = useNavigate();
  return (
    <div className="role-switch" role="group" aria-label="Демо: переключить кабинет">
      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
        <button key={r} type="button" aria-pressed={r === role} onClick={() => navigate(`/${r}`)}>
          {ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}
