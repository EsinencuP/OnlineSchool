import { lazy, Suspense, useEffect, useState } from 'react';
import type { SessionResponse, components } from '@online-school/api-contracts';
import { leaveSession } from '@online-school/account-ui';
import { Icon, LanguageSelector, useLocale } from '@online-school/ui';
import { AccessScreen, canEnter, sessionHome } from './Access.js';
import { academyName, Brand } from './Brand.js';
import { CabinetError, homes, readableError, request, roleNames } from './contract.js';
import type { Details, Role } from './contract.js';
import { CabinLink, Home, SchedulePreview } from './Home.js';
import { useEndpoint } from './hooks.js';
import { CommandPanel, LoadState, OperationWorkspace } from './Operations.js';
import type { PaymentRoute } from './Payments.js';
import { StudentLessonCard, StudentSuspended } from './StudentLesson.js';
import { StudentHomework } from './StudentHomework.js';
import { MeetConnection, PrivateUpload } from './Workflows.js';
import { managerPaymentsLink, recordPage, recordUrl } from './recordRoutes.js';
import { TeacherLessonCard } from './TeacherLesson.js';
import { TeacherSchedule } from './TeacherSchedule.js';
import { profileOperation, sections, sectionAliases } from './sections.js';

const PaymentRoutePanel = lazy(() =>
  import('./Payments.js').catch(() => ({
    default: () => (
      <LoadState
        error={new Error('PAYMENT_VIEW_UNAVAILABLE')}
        retry={() => window.location.reload()}
      />
    ),
  })),
);

const routeRoles = Object.fromEntries(
  Object.entries(homes).map(([role, path]) => [path.slice(1), role]),
) as Record<string, Role>;
const roleFallbackZone = 'Europe/Chisinau';
type Accounts = components['schemas']['PlatformAccountsDto'];
type ManagerContacts = components['schemas']['ManagerContactsDto'];

function identify(path: string) {
  const [prefix, section, detail, action] = path.split('/').filter(Boolean);
  const role = prefix ? routeRoles[prefix] : undefined;
  return { role, section, detail, action };
}

function validZone(value: unknown) {
  if (typeof value !== 'string') return roleFallbackZone;
  try {
    new Intl.DateTimeFormat('ru', { timeZone: value });
    return value;
  } catch {
    return roleFallbackZone;
  }
}
function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => [...part][0])
      .join('')
      .toUpperCase() || '2K'
  );
}

function Shell({
  role,
  path,
  accountId,
  navigate,
  leave,
}: {
  role: Role;
  path: string;
  accountId: string;
  navigate: (url: string, replace?: boolean) => void;
  leave: () => void;
}) {
  const route = identify(path);
  const nav = sections[role];
  const { locale } = useLocale();
  const alias =
    role === 'TEACHER' && route.section === 'oauth'
      ? 'meet'
      : route.section === 'schedule' && (role === 'STUDENT' || role === 'TEACHER')
        ? 'lessons'
        : route.section === 'payroll' && role === 'TEACHER'
          ? 'payroll'
          : (route.section && sectionAliases[route.section]) || route.section;
  const section = nav.find((entry) => entry.id === alias) ?? nav[0]!;
  const profile = useEndpoint<Details>(profileOperation[role]);
  const accounts = useEndpoint<Accounts>('getPlatformAccounts');
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [passwordGate, setPasswordGate] = useState(false);
  const name = typeof profile.data?.displayName === 'string' ? profile.data.displayName : '';
  const zone = validZone(profile.data?.timeZone ?? profile.data?.timezone);
  const home = homes[role];
  const detailPage = recordPage(home + '/' + section.id, route.detail, route.action);
  const managerStudentId =
    role === 'MANAGER' && section.id === 'students' ? detailPage?.params.studentId : undefined;
  const studentPayments =
    managerStudentId &&
    (route.action === 'payments' ||
      new URLSearchParams(window.location.search).get('tab') === 'payments');
  const managerPayment = role === 'MANAGER' && section.id === 'payments';
  const directorPaymentId =
    role === 'DIRECTOR' && section.id === 'decisions' && detailPage?.params.kind === 'PAYMENT'
      ? detailPage.params.id
      : undefined;
  const paymentRoute: PaymentRoute | null =
    studentPayments && managerStudentId
      ? { kind: 'student', id: managerStudentId }
      : managerPayment
        ? route.detail === 'corrections' && route.action
          ? { kind: 'correction', id: route.action }
          : detailPage?.params.paymentId
            ? { kind: 'receipt', id: detailPage.params.paymentId }
            : { kind: 'directory' }
        : directorPaymentId
          ? { kind: 'decision', id: directorPaymentId }
          : null;
  const studentLessonId =
    role === 'STUDENT' && section.id === 'lessons' ? detailPage?.params.lessonId : undefined;
  const teacherLessonId =
    role === 'TEACHER' && section.id === 'lessons' ? detailPage?.params.id : undefined;
  const locked = role === 'STUDENT' && profile.data?.mustChangePassword === true;
  const suspended = role === 'STUDENT' && profile.data?.hasActiveAccess === false;
  const profileUnknown =
    role === 'STUDENT' && !locked && typeof profile.data?.hasActiveAccess !== 'boolean';
  const contacts = profile.data?.managerContacts as ManagerContacts | undefined;
  const [materialsRevision, setMaterialsRevision] = useState(0);
  const [uploadedMaterial, setUploadedMaterial] = useState<string | null>(null);
  const notices = nav.find((entry) => entry.id === 'notifications');
  const unread = useEndpoint<Details>(
    role === 'STUDENT' && !locked && !suspended && profile.data?.hasActiveAccess === true
      ? 'getStudentUnreadNotificationCount'
      : role === 'TEACHER'
        ? 'getTeacherNotificationSummary'
        : null,
  );
  const unreadCount = unread.data?.unread ?? unread.data?.unreadCount ?? unread.data?.count;
  useEffect(() => {
    document.title = `${section.title} · ${academyName}`;
    setMenu(false);
    setAccount(false);
  }, [path, section.title]);
  useEffect(() => {
    if (locked && section.id !== 'security') navigate(home + '/security/change-password', true);
    if (!locked && suspended && route.section !== 'suspended') navigate(home + '/suspended', true);
    if (route.section === 'suspended' && profile.data?.hasActiveAccess === true && !locked)
      navigate(home, true);
  }, [locked, suspended, section.id, route.section, home, navigate, profile.data?.hasActiveAccess]);
  async function swap(key: string) {
    if (switching) return;
    setSwitching(true);
    setAccountError('');
    try {
      const result = await request<{ home: string }>('switchDemoUser', { body: { key } });
      if (!Object.values(homes).includes(result.home)) {
        setAccountError('Не удалось открыть кабинет.');
        setSwitching(false);
        return;
      }
      leaveSession(result.home);
    } catch (error) {
      setAccountError(readableError(error));
      setSwitching(false);
    }
  }
  const currentDemo = accounts.data?.items.find((x) => x.key === accounts.data?.currentKey);
  const shownName = name || currentDemo?.name || roleNames[role];
  function sectionLink(id: string) {
    return id === 'home' ? home : `${home}/${id}`;
  }

  return (
    <div className="cab-frame" data-cab-role={role === 'STUDENT' ? 'student' : 'staff'}>
      <a href="#cabinet-content" className="cab-skip">
        К основному содержимому
      </a>
      {menu && (
        <button
          type="button"
          aria-label="Закрыть навигацию"
          className="cab-shell-scrim"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`cab-sidebar ${menu ? 'is-open' : ''}`} aria-label="Навигация кабинета">
        <CabinLink to={home} navigate={navigate} className="cab-sidebar-home">
          <Brand />
        </CabinLink>
        <span className="cab-role-label">{roleNames[role]}</span>
        <nav className="cab-nav" aria-label="Разделы кабинета">
          {nav
            .filter(
              (item) =>
                (!locked && !suspended && !profileUnknown) || (locked && item.id === 'security'),
            )
            .map((item) => (
              <a
                key={item.id}
                href={sectionLink(item.id)}
                className={`cab-nav-link ${item.id === section.id ? 'is-active' : ''}`}
                aria-current={item.id === section.id ? 'page' : undefined}
                onClick={(event) => {
                  if (
                    event.ctrlKey ||
                    event.metaKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button
                  )
                    return;
                  event.preventDefault();
                  navigate(sectionLink(item.id));
                }}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.title}</span>
              </a>
            ))}
        </nav>
        <div className="cab-sidebar-foot">
          <button type="button" className="cab-nav-link cab-exit" onClick={leave}>
            <Icon name="arrow" size={18} /> Выйти
          </button>
        </div>
      </aside>
      <div className="cab-shell-main">
        <header className="cab-top">
          <div className="cab-top-left">
            <button
              type="button"
              className="cab-icon-button cab-menu-trigger"
              aria-label="Открыть навигацию"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Icon name="menu" size={21} />
            </button>
            <div className="cab-breadcrumb">
              <CabinLink to={home} navigate={navigate}>
                Кабинет
              </CabinLink>
              <span>/</span>
              <strong>{section.title}</strong>
            </div>
          </div>
          <div className="cab-top-actions">
            {notices && !locked && !suspended && !profileUnknown && (
              <CabinLink
                to={sectionLink(notices.id)}
                navigate={navigate}
                className="cab-icon-button cab-bell"
              >
                <Icon name="bell" size={20} />
                <span className="cab-sr-only">
                  Уведомления
                  {typeof unreadCount === 'number' && unreadCount > 0
                    ? `, новых ${unreadCount}`
                    : ''}
                </span>
                {typeof unreadCount === 'number' && unreadCount > 0 && (
                  <span className="cab-bell-dot" />
                )}
              </CabinLink>
            )}
            <div className="cab-account">
              <button
                type="button"
                className="cab-account-button"
                onClick={() => {
                  setAccount(!account);
                  setAccountError('');
                }}
                aria-expanded={account}
              >
                <span className="cab-avatar">
                  {role === 'STUDENT' &&
                  typeof profile.data?.avatarUrl === 'string' &&
                  /^\/api\/v1\/student\/profile\/avatar(?:\?|$)/.test(profile.data.avatarUrl) ? (
                    <img alt="" src={profile.data.avatarUrl} />
                  ) : (
                    initials(shownName)
                  )}
                </span>
                <span className="cab-account-name">
                  <strong>{shownName}</strong>
                  <small>{roleNames[role]}</small>
                </span>
                <Icon name="more" size={17} />
              </button>
              {account && (
                <div
                  className="cab-account-popover"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setAccount(false);
                      (event.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
                    }
                  }}
                >
                  {!locked && !suspended && (
                    <CabinLink to={sectionLink('profile')} navigate={navigate}>
                      Мой профиль
                    </CabinLink>
                  )}
                  {accounts.data?.enabled &&
                    accounts.data.items.length > 0 &&
                    !locked &&
                    !suspended && (
                      <label className="cab-form-label">
                        <span>Сменить пользователя</span>
                        <select
                          value={accounts.data.currentKey ?? ''}
                          disabled={switching}
                          onChange={(e) => {
                            if (e.target.value) void swap(e.target.value);
                          }}
                        >
                          <option value="">Выберите демо-аккаунт</option>
                          {accounts.data.items.map((choice) => (
                            <option key={choice.key} value={choice.key}>
                              {choice.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  <LanguageSelector />
                  <button className="cab-text-button" type="button" onClick={leave}>
                    Выйти
                  </button>
                  {accountError && (
                    <p className="cab-form-error" role="alert">
                      {accountError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="cab-main" id="cabinet-content" tabIndex={-1}>
          {role === 'STUDENT' && (profile.pending || profile.error || profileUnknown) ? (
            <LoadState
              refreshing={profile.pending}
              error={profile.error ?? (profileUnknown ? new Error('INVALID_RESPONSE') : undefined)}
              retry={profile.refresh}
            />
          ) : locked ? (
            <div className="cab-card cab-password-gate">
              <Icon name="health" size={27} />
              <h1>Смените временный пароль</h1>
              <p>Установите свой пароль для входа в учебный кабинет.</p>
              <button
                className="cab-button cab-primary"
                type="button"
                onClick={() => setPasswordGate(true)}
              >
                Сменить пароль
              </button>
              {passwordGate && (
                <CommandPanel
                  id="changeStudentPassword"
                  close={() => setPasswordGate(false)}
                  context={{}}
                  onDone={profile.refresh}
                />
              )}
            </div>
          ) : suspended ? (
            <StudentSuspended {...(contacts ? { contacts } : {})} refresh={profile.refresh} />
          ) : section.id === 'home' ? (
            <Home key={role} role={role} name={name} zone={zone} navigate={navigate} />
          ) : (
            <>
              {!teacherLessonId && !studentLessonId && !studentPayments && (
                <div className="cab-page-title">
                  <div>
                    <h1>{section.title}</h1>
                  </div>
                  {managerStudentId && !studentPayments && (
                    <CabinLink
                      to={managerPaymentsLink(managerStudentId)}
                      navigate={navigate}
                      className="cab-button cab-secondary"
                    >
                      {locale === 'ro' ? 'Plățile elevului' : 'Оплаты ученика'}{' '}
                      <Icon name="arrow" size={16} />
                    </CabinLink>
                  )}
                </div>
              )}
              {paymentRoute ? (
                <Suspense fallback={<LoadState refreshing />}>
                  <PaymentRoutePanel
                    key={path}
                    route={paymentRoute}
                    zone={zone}
                    navigate={navigate}
                  />
                </Suspense>
              ) : role === 'STUDENT' && section.id === 'homework' && detailPage?.params.hwId ? (
                <StudentHomework
                  key={detailPage.params.hwId}
                  id={detailPage.params.hwId}
                  zone={zone}
                  navigate={navigate}
                  refreshAccess={profile.refresh}
                />
              ) : studentLessonId ? (
                <StudentLessonCard
                  key={studentLessonId}
                  id={studentLessonId}
                  accountId={accountId}
                  zone={zone}
                  navigate={navigate}
                  refreshAccess={profile.refresh}
                />
              ) : teacherLessonId ? (
                <TeacherLessonCard
                  key={teacherLessonId}
                  id={teacherLessonId}
                  zone={zone}
                  navigate={navigate}
                />
              ) : (
                <>
                  {role === 'TEACHER' && section.id === 'meet' && <MeetConnection />}
                  {role === 'TEACHER' && section.id === 'materials' && (
                    <section className="cab-card cab-panel">
                      <h2>Загрузить материал</h2>
                      <PrivateUpload
                        uploaded={(file) => {
                          setUploadedMaterial(file.name);
                          setMaterialsRevision((old) => old + 1);
                        }}
                      />
                      {uploadedMaterial && (
                        <p className="cab-calendar-hint">Добавлен материал {uploadedMaterial}</p>
                      )}
                    </section>
                  )}
                  <OperationWorkspace
                    key={path + materialsRevision}
                    section={section}
                    {...(detailPage ? { detailPage } : {})}
                    extra={
                      role === 'TEACHER' && section.id === 'lessons' ? (
                        <TeacherSchedule zone={zone} navigate={navigate} />
                      ) : (role === 'STUDENT' && section.id === 'lessons' && !route.detail) ||
                        (role === 'MANAGER' && section.id === 'schedule' && !route.detail) ? (
                        <SchedulePreview role={role} zone={zone} />
                      ) : undefined
                    }
                    onPick={(id, row) => {
                      const destination = recordUrl(id, row);
                      if (destination) navigate(destination);
                    }}
                  />
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export function CabinetApp() {
  const [path, setPath] = useState(window.location.pathname.replace(/\/+$/, '') || '/');
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname.replace(/\/+$/, '') || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setPending(true);
    setError(null);
    void request<SessionResponse>('currentSession', { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setSession(value);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof CabinetError && reason.issue.status === 401) setSession(null);
        else setError(reason);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false);
      });
    return () => controller.abort();
  }, [attempt]);

  function navigate(url: string, replace = false) {
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin) return;
    if (target.pathname === path && target.search === window.location.search) return;
    if (replace) window.history.replaceState({}, '', target.pathname + target.search);
    else window.history.pushState({}, '', target.pathname + target.search);
    setPath(target.pathname.replace(/\/+$/, '') || '/');
    window.scrollTo({ top: 0 });
  }
  function accept(value: SessionResponse) {
    setSession(value);
    if (canEnter(value)) navigate(sessionHome(value), true);
  }
  async function signOut() {
    if (exiting) return;
    setExiting(true);
    try {
      await request('deleteSession');
      leaveSession('/account');
    } catch (reason) {
      setError(reason);
      setExiting(false);
    }
  }

  const route = identify(path);
  const role =
    route.role && session?.account.roles.includes(route.role)
      ? route.role
      : session?.account.roles.find((entry) => entry in homes);
  const accessible = session && canEnter(session);
  useEffect(() => {
    if (accessible && role && route.role !== role) navigate(homes[role], true);
  }, [accessible, role, route.role]);
  if (pending || exiting)
    return (
      <main className="cab-full-state">
        <Brand />
        <LoadState refreshing />
      </main>
    );
  if (error)
    return (
      <main className="cab-full-state">
        <Brand />
        <LoadState error={error} retry={() => setAttempt((value) => value + 1)} />
      </main>
    );
  if (!session || !accessible || !role)
    return <AccessScreen session={session} signedIn={accept} signOut={() => void signOut()} />;
  return (
    <Shell
      key={`${session.account.id}:${role}`}
      role={role}
      accountId={session.account.id}
      path={path}
      navigate={navigate}
      leave={() => void signOut()}
    />
  );
}
