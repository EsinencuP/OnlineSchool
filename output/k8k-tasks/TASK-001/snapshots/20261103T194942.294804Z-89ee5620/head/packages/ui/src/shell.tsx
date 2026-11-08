import { FreshnessTimeZone } from './freshness.js';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { cabinetLabels, roleNavigation } from './navigation.js';
import type { CabinetRole, NavigationItem } from './navigation.js';
import { Icon } from './icon.js';
import { PriorityEvents } from './priority.js';
import type { PrioritySource } from './priority.js';

export type NavigationRenderer = (
  item: NavigationItem,
  content: ReactNode,
  props: { className: string; 'aria-current': 'page' | undefined; onClick: () => void },
) => ReactNode;
export function Sidebar({
  role,
  navigation,
  footer,
}: {
  role: CabinetRole;
  navigation: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside className="k8k-sidebar">
      <div className="k8k-brand">
        <Icon name="brand" />
        <span>
          K8K Academy<small>{cabinetLabels[role]}</small>
        </span>
      </div>
      <p className="k8k-sidebar-label">Рабочее пространство</p>
      <nav aria-label="Основная навигация">{navigation}</nav>
      <div className="k8k-sidebar-footer">{footer}</div>
    </aside>
  );
}
export function BottomNav({ children }: { children: ReactNode }) {
  return (
    <nav className="k8k-bottom-nav" aria-label="Мобильная навигация">
      {children}
    </nav>
  );
}
export function Header({
  children,
  account,
  notifications,
  menu,
}: {
  children?: ReactNode;
  account: ReactNode;
  notifications?: ReactNode;
  menu?: ReactNode;
}) {
  return (
    <header className="k8k-header">
      {menu}
      <div className="k8k-header-context">{children}</div>
      <div className="k8k-header-account">
        {notifications}
        {account}
      </div>
    </header>
  );
}
export function NotificationBell({
  count,
  renderLink,
}: {
  count?: number | undefined;
  renderLink: (content: ReactNode, label: string) => ReactNode;
}) {
  const known = count !== undefined;
  return renderLink(
    <>
      <Icon name="bell" />
      {known && count > 0 && (
        <span className="k8k-count" aria-hidden="true">
          {count}
        </span>
      )}
    </>,
    `Уведомления${known ? `, непрочитанных: ${count}` : ', счётчик недоступен'}`,
  );
}
export function AppShell({
  role,
  activeId,
  renderNavigation,
  account,
  children,
  header,
  notifications,
  sidebarFooter,
  footer,
  aside,
  mainId = 'content',
  mainRef,
  priority,
  priorityEnabled = false,
  timeZone = 'Europe/Chisinau',
}: {
  role: CabinetRole;
  activeId: string;
  renderNavigation: NavigationRenderer;
  account: ReactNode;
  children: ReactNode;
  header?: ReactNode;
  notifications?: ReactNode;
  sidebarFooter?: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
  mainId?: string;
  mainRef?: RefObject<HTMLElement>;
  priority?: PrioritySource;
  priorityEnabled?: boolean;
  timeZone?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const mobileId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const items = roleNavigation[role];
  const close = () => setExpanded(false);
  useLayoutEffect(() => {
    if (expanded) menu.current?.querySelector<HTMLElement>('a, button')?.focus();
  }, [expanded]);
  const toggle = (button: HTMLButtonElement) => {
    trigger.current = button;
    setExpanded((value) => !value);
  };
  const nav = (subset: readonly NavigationItem[], compact = false) =>
    subset.map((item) => (
      <div className="k8k-nav-item" key={item.id}>
        {renderNavigation(
          item,
          <>
            <Icon name={item.icon} />
            <span>{compact ? (item.shortLabel ?? item.label) : item.label}</span>
          </>,
          {
            className: 'k8k-nav-link',
            'aria-current': item.id === activeId ? 'page' : undefined,
            onClick: close,
          },
        )}
      </div>
    ));
  return (
    <FreshnessTimeZone.Provider value={timeZone}>
      <div className={`k8k-shell k8k-role-${role.toLowerCase()}`}>
        <a className="k8k-skip" href={`#${mainId}`}>
          Перейти к содержимому
        </a>
        <Sidebar role={role} navigation={nav(items)} footer={sidebarFooter} />
        <div className="k8k-shell-body">
          <Header
            account={account}
            notifications={notifications}
            menu={
              <button
                className="k8k-menu-button"
                type="button"
                aria-label="Все разделы"
                aria-expanded={expanded}
                aria-controls={mobileId}
                onClick={(event) => toggle(event.currentTarget)}
              >
                <Icon name="menu" />
              </button>
            }
          >
            {header ?? cabinetLabels[role]}
          </Header>
          <div
            id={mobileId}
            ref={menu}
            className="k8k-mobile-menu"
            hidden={!expanded}
            onClick={(event) => {
              if (event.target instanceof globalThis.Element && event.target.closest('a[href]'))
                close();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
                trigger.current?.focus();
              }
            }}
          >
            <nav aria-label="Все разделы кабинета">{nav(items)}</nav>
            {sidebarFooter}
            <button
              type="button"
              onClick={() => {
                close();
                trigger.current?.focus();
              }}
            >
              Закрыть меню
            </button>
          </div>
          <div className={`k8k-shell-columns${aside ? ' k8k-has-aside' : ''}`}>
            <main className="k8k-main" id={mainId} tabIndex={-1} ref={mainRef}>
              <PriorityEvents enabled={priorityEnabled} source={priority} />
              {children}
            </main>
            {aside && <div className="k8k-shell-aside">{aside}</div>}
          </div>
          {footer && <footer className="k8k-shell-footer">{footer}</footer>}
        </div>
        <BottomNav>
          {nav(items.length > 5 ? items.slice(0, 4) : items, true)}
          {items.length > 5 && (
            <button
              className="k8k-nav-link"
              type="button"
              aria-expanded={expanded}
              aria-controls={mobileId}
              onClick={(event) => toggle(event.currentTarget)}
            >
              <Icon name="more" />
              <span>Ещё</span>
            </button>
          )}
        </BottomNav>
      </div>
    </FreshnessTimeZone.Provider>
  );
}
