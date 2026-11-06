import { useState } from 'react';
import {
  AppShell,
  Avatar,
  BottomNav,
  Header,
  LanguageSelector,
  NotificationBell,
  PriorityEvents,
  Sidebar,
} from '../src/index.js';
import type { CabinetRole, Locale } from '../src/index.js';

export default { title: 'UI/Shell', parameters: { layout: 'fullscreen' } };

function Cabinet({ role, locale }: { role: CabinetRole; locale: Locale }) {
  const [activeId, setActiveId] = useState(
    role === 'STUDENT' || role === 'MANAGER' ? 'home' : 'overview',
  );
  const ro = locale === 'ro';
  return (
    <AppShell
      role={role}
      activeId={activeId}
      account={
        <>
          <LanguageSelector />
          <Avatar name={ro ? 'Cont sintetic' : 'Тестовый аккаунт'} />
        </>
      }
      notifications={
        role === 'STUDENT' && (
          <NotificationBell
            count={2}
            renderLink={(content, label) => (
              <a className="k8k-bell" href="#bell-example" aria-label={label}>
                {content}
              </a>
            )}
          />
        )
      }
      renderNavigation={(item, label, props) => (
        <a
          key={item.id}
          href="#example"
          {...props}
          onClick={() => {
            props.onClick();
            setActiveId(item.id);
          }}
        >
          {label}
        </a>
      )}
    >
      <h1 id="example">{ro ? 'Exemplu local de cabinet' : 'Локальный пример кабинета'}</h1>
      <p id="bell-example">
        {ro
          ? 'Date sintetice pentru verificarea navigării.'
          : 'Синтетические данные для проверки навигации.'}
      </p>
    </AppShell>
  );
}

export const Student = { args: { role: 'STUDENT' }, render: Cabinet };
export const Teacher = { args: { role: 'TEACHER' }, render: Cabinet };
export const Manager = { args: { role: 'MANAGER' }, render: Cabinet };
export const Director = { args: { role: 'DIRECTOR' }, render: Cabinet };
export const Operator = { args: { role: 'TECH_OPERATOR' }, render: Cabinet };

export const ShellParts = {
  render: ({ locale }: { locale: Locale }) => {
    const ro = locale === 'ro';
    const link = <a href="#shell-example">{ro ? 'Exemplu' : 'Пример'}</a>;
    return (
      <div className="k8k-shell k8k-role-student">
        <Sidebar role="STUDENT" navigation={link} />
        <div className="k8k-shell-body">
          <Header
            account={<LanguageSelector />}
            notifications={
              <NotificationBell
                renderLink={(content, label) => (
                  <a className="k8k-bell" href="#shell-example" aria-label={label}>
                    {content}
                  </a>
                )}
              />
            }
          >
            <span id="shell-example">{ro ? 'Exemplu' : 'Пример'}</span>
          </Header>
        </div>
        <BottomNav>{link}</BottomNav>
      </div>
    );
  },
};

export const PrioritySlot = {
  parameters: { layout: 'padded' },
  render: ({ locale }: { locale: Locale }) => {
    const ro = locale === 'ro';
    return (
      <PriorityEvents
        enabled
        source={{
          primary: {
            id: 'fixture',
            title: ro ? 'Eveniment sintetic' : 'Синтетическое событие',
            action: (
              <a id="source" href="#source">
                {ro ? 'Deschide exemplul' : 'Открыть пример'}
              </a>
            ),
          },
          criticalCount: 1,
          queueAction: (
            <a id="queue" href="#queue">
              {ro ? 'Lista de exemple' : 'Список примеров'}
            </a>
          ),
        }}
      />
    );
  },
};
