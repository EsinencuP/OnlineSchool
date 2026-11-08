import { useLocale } from './locale.js';
import type { MessageKey } from './locale.js';
import { FreshnessTimeZone } from './freshness.js';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { roleNavigation } from './navigation.js';
import type { CabinetRole, NavigationItem } from './navigation.js';
import { Icon } from './icon.js';
import { PriorityEvents } from './priority.js';
import type { PrioritySource } from './priority.js';

export type NavigationRenderer = (
  item: NavigationItem,
  content: ReactNode,
  props: { className: string; 'aria-current': 'page' | undefined; onClick: () => void },
) => ReactNode;
const cabinetTitle = {
  STUDENT: 'cabinetStudent',
  MANAGER: 'cabinetManager',
  TEACHER: 'cabinetTeacher',
  DIRECTOR: 'cabinetDirector',
  TECH_OPERATOR: 'cabinetOperator',
} as const satisfies Record<CabinetRole, MessageKey>;

export function Sidebar({
  role,
  navigation,
  footer,
}: {
  role: CabinetRole;
  navigation: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <aside className="k8k-sidebar">
      <div className="k8k-brand">
        <Icon name="brand" />
        <span>
          K8K Academy<small>{t(cabinetTitle[role])}</small>
        </span>
      </div>
      <p className="k8k-sidebar-label">{t('workspace')}</p>
      <nav aria-label={t('primaryNavigation')}>{navigation}</nav>
      <div className="k8k-sidebar-footer">{footer}</div>
    </aside>
  );
}
export function BottomNav({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  return (
    <nav className="k8k-bottom-nav" aria-label={t('mobileNavigation')}>
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
  const { t } = useLocale();
  return renderLink(
    <>
      <Icon name="bell" />
      {known && count > 0 && (
        <span className="k8k-count" aria-hidden="true">
          {count}
        </span>
      )}
    </>,
    `${t('notifications')}, ${known ? `${t('bellUnread')}: ${count}` : t('bellCountUnavailable')}`,
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
  mobileMore = false,
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
  mobileMore?: boolean;
  priority?: PrioritySource;
  priorityEnabled?: boolean;
  timeZone?: string;
}) {
  const { t } = useLocale();
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
  const nav = (subset: typeof items, compact = false) =>
    subset.map((item) => (
      <div className="k8k-nav-item" key={item.id}>
        {renderNavigation(
          item,
          <>
            <Icon name={item.icon} />
            <span>{t(compact ? (item.compactLabelKey ?? item.labelKey) : item.labelKey)}</span>
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
          {t('skip')}
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
                aria-label={t('sections')}
                aria-expanded={expanded}
                aria-controls={mobileId}
                onClick={(event) => toggle(event.currentTarget)}
              >
                <Icon name="menu" />
              </button>
            }
          >
            {header ?? t(cabinetTitle[role])}
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
            <nav aria-label={t('sections')}>{nav(items)}</nav>
            {sidebarFooter}
            <button
              type="button"
              onClick={() => {
                close();
                trigger.current?.focus();
              }}
            >
              {t('close')}
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
          {nav(items.length > 5 || mobileMore ? items.slice(0, 4) : items, true)}
          {(items.length > 5 || mobileMore) && (
            <button
              className="k8k-nav-link"
              type="button"
              aria-expanded={expanded}
              aria-controls={mobileId}
              onClick={(event) => toggle(event.currentTarget)}
            >
              <Icon name="more" />
              <span>{t('more')}</span>
            </button>
          )}
        </BottomNav>
      </div>
    </FreshnessTimeZone.Provider>
  );
}
