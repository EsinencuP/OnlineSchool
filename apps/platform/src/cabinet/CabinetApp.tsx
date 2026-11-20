import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { SessionResponse, components } from '@online-school/api-contracts';
import { leaveSession, switchAccount } from '@online-school/account-ui';
import { Icon, LanguageSelector, useLocale } from '@online-school/ui';
import { AccessScreen, canEnter, sessionHome } from './Access.js';
import { academyName, Brand } from './Brand.js';
import { CabinetError, homes, request, roleNames } from './contract.js';
import type { Details, Role } from './contract.js';
import { CabinLink, Home, SchedulePreview } from './Home.js';
import { useEndpoint } from './hooks.js';
import { LoadState, OperationWorkspace } from './Operations.js';
import { DirectorPayrollChart, TeacherEarnings } from './Analytics.js';
import type { PaymentRoute } from './Payments.js';
import { StudentLessonCard, StudentManagerContacts, StudentSuspended } from './StudentLesson.js';
import { StudentHomework } from './StudentHomework.js';
import { StudentMaterials } from './StudentMaterials.js';
import { StudentAvatar, StudentProfile } from './StudentProfile.js';
import { StudentPassword, StudentSecurity } from './StudentSecurity.js';
import { studentPasswordPath, useAccountCopy } from './studentAccountCopy.js';
import {
  StudentNotificationBell,
  StudentNotificationPreview,
  StudentNotifications,
  useStudentNotificationInbox,
} from './StudentNotifications.js';
import { StudentSkills } from './StudentSkills.js';
import {
  StudentSubjects,
  SubjectBack,
  SubjectScope,
  SubjectUnavailable,
} from './StudentSubjects.js';
import { subjectSelection, withSubject } from './studentSubjectRoutes.js';
import { MeetConnection, PrivateUpload } from './Workflows.js';
import {
  managerPaymentsLink,
  recordPage,
  recordUrl,
  teacherHomeworkNavigation,
} from './recordRoutes.js';
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

const StudentSubscriptionPanel = lazy(() =>
  import('./StudentSubscription.js').catch(() => ({
    default: () => (
      <LoadState
        error={new Error('SUBSCRIPTION_VIEW_UNAVAILABLE')}
        retry={() => window.location.reload()}
      />
    ),
  })),
);

const StudentReportsPanel = lazy(() =>
  import('./StudentReports.js').catch(() => ({
    default: () => (
      <LoadState
        error={new Error('REPORTS_VIEW_UNAVAILABLE')}
        retry={() => window.location.reload()}
      />
    ),
  })),
);

const TeacherHomeworkPanel = lazy(() =>
  import('./TeacherHomework.js').catch(() => ({
    default: () => (
      <LoadState
        error={new Error('HOMEWORK_VIEW_UNAVAILABLE')}
        retry={() => window.location.reload()}
      />
    ),
  })),
);

const TeacherStudentsPanel = lazy(() =>
  import('./TeacherStudents.js').catch(() => ({
    default: () => (
      <LoadState
        error={new Error('TEACHER_STUDENTS_VIEW_UNAVAILABLE')}
        retry={() => window.location.reload()}
      />
    ),
  })),
);

const TeacherReportsPanel = lazy(() =>
  import('./TeacherReports.js').catch(() => ({
    default: () => (
      <LoadState
        error={new Error('TEACHER_REPORTS_VIEW_UNAVAILABLE')}
        retry={() => window.location.reload()}
      />
    ),
  })),
);

const routeRoles = Object.fromEntries(
  Object.entries(homes).map(([role, path]) => [path.slice(1), role]),
) as Record<string, Role>;
const roleFallbackZone = 'Europe/Chisinau';
const studentTitlesRo: Partial<Record<string, string>> = {
  subjects: 'Disciplinele mele',
  subscription: 'Abonament',
  help: 'Ajutor',
  notifications: 'Notificări',
  profile: 'Profil',
  security: 'Securitate',
  reports: 'Rapoarte de studiu',
};
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
  search,
  accountId,
  navigate,
  leave,
}: {
  role: Role;
  path: string;
  search: string;
  accountId: string;
  navigate: (url: string, replace?: boolean, preserveScroll?: boolean) => void;
  leave: () => void;
}) {
  const route = identify(path);
  const nav = sections[role];
  const { locale, t } = useLocale();
  const { text: accountText } = useAccountCopy();
  const homeworkText = teacherHomeworkNavigation[locale];
  const passwordPage =
    role === 'STUDENT' && route.section === 'security' && route.detail === 'change-password';
  const alias =
    role === 'TEACHER' && route.section === 'oauth'
      ? 'meet'
      : route.section === 'schedule' && (role === 'STUDENT' || role === 'TEACHER')
        ? 'lessons'
        : route.section === 'payroll' && role === 'TEACHER'
          ? 'payroll'
          : (route.section && sectionAliases[route.section]) || route.section;
  const section = nav.find((entry) => entry.id === alias) ?? nav[0]!;
  const skillPage = role === 'STUDENT' && route.section === 'skills';
  const studentSubscription = role === 'STUDENT' && section.id === 'subscription';
  const studentReports = role === 'STUDENT' && section.id === 'reports';
  const teacherHomework = role === 'TEACHER' && section.id === 'homework';
  const teacherStudents = role === 'TEACHER' && section.id === 'students';
  const teacherReports = role === 'TEACHER' && section.id === 'reports';
  const rosterTitle = locale === 'ro' ? 'Elevi' : 'Ученики';
  const studentHelp = role === 'STUDENT' && section.id === 'help';
  const subjectQuery = role === 'STUDENT' ? subjectSelection(search, 'subjectId') : null;
  function sectionTitle(item: { id: string; title: string }) {
    if (role === 'STUDENT' && locale === 'ro') return studentTitlesRo[item.id] ?? item.title;
    if (role === 'TEACHER' && item.id === 'homework') return homeworkText.title;
    if (role === 'TEACHER' && item.id === 'students') return rosterTitle;
    if (role === 'TEACHER' && item.id === 'reports' && locale === 'ro')
      return 'Registru și rapoarte';
    return item.title;
  }
  const title = passwordPage
    ? accountText('changePassword')
    : teacherHomework && route.detail === 'new'
      ? homeworkText.newTitle
      : teacherStudents && route.detail
        ? locale === 'ro'
          ? 'Fișa elevului'
          : 'Карточка ученика'
        : skillPage
          ? locale === 'ro'
            ? 'Harta competențelor'
            : 'Карта навыков'
          : sectionTitle(section);
  const profile = useEndpoint<Details>(profileOperation[role]);
  const accounts = useEndpoint<Accounts>('getPlatformAccounts');
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);
  const [accountError, setAccountError] = useState(false);
  const [profileChange, setProfileChange] = useState<{
    base: Details | null;
    name: string;
    avatarUrl: string | null;
  } | null>(null);
  const currentChange = profileChange?.base === profile.data ? profileChange : null;
  const name =
    currentChange?.name ??
    (typeof profile.data?.displayName === 'string' ? profile.data.displayName : '');
  const avatarUrl = currentChange
    ? currentChange.avatarUrl
    : typeof profile.data?.avatarUrl === 'string'
      ? profile.data.avatarUrl
      : null;
  const email = typeof profile.data?.email === 'string' ? profile.data.email : '';
  const zone = validZone(profile.data?.timeZone ?? profile.data?.timezone);
  const home = homes[role];
  const detailPage = recordPage(home + '/' + section.id, route.detail, route.action);
  const scopedCapability =
    section.id === 'lessons'
      ? 'canOpenLessons'
      : section.id === 'materials'
        ? 'canViewMaterials'
        : section.id === 'homework'
          ? 'canViewHomework'
          : null;
  const relatedSubject =
    role === 'STUDENT' && !detailPage && scopedCapability
      ? section.id === 'lessons' || section.id === 'materials'
        ? subjectSelection(search, 'subjectId', 'fromSubjectId')
        : subjectSelection(search, 'fromSubjectId')
      : null;
  const managerStudentId =
    role === 'MANAGER' && section.id === 'students' ? detailPage?.params.studentId : undefined;
  const studentPayments =
    managerStudentId &&
    (route.action === 'payments' || new URLSearchParams(search).get('tab') === 'payments');
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
  const studentNoticeAccess =
    role === 'STUDENT' && !locked && !suspended && profile.data?.hasActiveAccess === true;
  const inbox = useStudentNotificationInbox(studentNoticeAccess);
  const unread = useEndpoint<Details>(role === 'TEACHER' ? 'getTeacherNotificationSummary' : null);
  const unreadCount = unread.data?.unread ?? unread.data?.unreadCount ?? unread.data?.count;
  useEffect(() => {
    document.title = `${title} · ${academyName}`;
    setMenu(false);
    setAccount(false);
  }, [path, search, title]);
  useEffect(() => {
    if (locked && !passwordPage) navigate(studentPasswordPath, true);
    if (!locked && suspended && !passwordPage && route.section !== 'suspended')
      navigate(home + '/suspended', true);
    if (route.section === 'suspended' && profile.data?.hasActiveAccess === true && !locked)
      navigate(home, true);
  }, [
    locked,
    suspended,
    passwordPage,
    route.section,
    home,
    navigate,
    profile.data?.hasActiveAccess,
  ]);
  async function swap(key: string) {
    if (switchingRef.current) return;
    switchingRef.current = true;
    setSwitching(true);
    setAccountError(false);
    if ((await switchAccount(key)) === 'retired') return;
    switchingRef.current = false;
    setSwitching(false);
    setAccountError(true);
    accounts.refresh();
  }
  const currentDemo = accounts.data?.items.find((x) => x.key === accounts.data?.currentKey);
  const shownName = name || currentDemo?.name || roleNames[role];
  function sectionLink(id: string) {
    if (locked && id === 'security') return studentPasswordPath;
    return id === 'home' ? home : `${home}/${id}`;
  }

  function workspace(subject?: { subjectId: string; subjectName: string }) {
    const subjectId = subject?.subjectId;
    const subjectLessons = section.id === 'lessons' ? subjectId : undefined;
    const selectedSection = subjectLessons
      ? { ...section, reads: section.reads.filter((id) => id !== 'getStudentUpcomingLessons') }
      : section;
    const fixedQuery = subjectLessons ? { subjectId: subjectLessons } : null;
    const content =
      role === 'STUDENT' && section.id === 'materials' ? (
        <StudentMaterials
          key={search}
          {...(subjectId ? { subjectId } : {})}
          zone={zone}
          refreshAccess={profile.refresh}
        />
      ) : (
        <OperationWorkspace
          key={path + search + materialsRevision}
          section={selectedSection}
          {...(fixedQuery ? { fixedQuery } : {})}
          {...(detailPage ? { detailPage } : {})}
          extra={
            role === 'TEACHER' && section.id === 'lessons' ? (
              <TeacherSchedule zone={zone} navigate={navigate} />
            ) : role === 'TEACHER' && section.id === 'payroll' && !route.detail ? (
              <TeacherEarnings />
            ) : role === 'DIRECTOR' && section.id === 'finance' && !route.detail ? (
              <DirectorPayrollChart />
            ) : (role === 'STUDENT' && section.id === 'lessons' && !route.detail) ||
              (role === 'MANAGER' && section.id === 'schedule' && !route.detail) ? (
              <SchedulePreview
                role={role}
                zone={zone}
                navigate={navigate}
                {...(subjectId ? { subjectId } : {})}
              />
            ) : undefined
          }
          onPick={(id, row) => {
            const destination = recordUrl(id, row);
            if (destination) navigate(withSubject(destination, subjectLessons));
          }}
        />
      );
    return subject ? (
      <div className="cab-lesson-stack">
        <div className="cab-subject-toolbar">
          <SubjectBack id={subject.subjectId} navigate={navigate} />
          <strong>{subject.subjectName}</strong>
        </div>
        {content}
      </div>
    ) : (
      content
    );
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
                <span>{sectionTitle(item)}</span>
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
              <strong>{title}</strong>
            </div>
          </div>
          <div className="cab-top-actions">
            {studentNoticeAccess && (
              <StudentNotificationBell
                inbox={inbox}
                path={path}
                search={search}
                zone={zone}
                navigate={navigate}
              />
            )}
            {role !== 'STUDENT' && notices && (
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
                  setAccountError(false);
                }}
                aria-expanded={account}
                aria-label={accountText('profile') + ' · ' + shownName}
              >
                <span className="cab-avatar">
                  {role === 'STUDENT' ? (
                    <StudentAvatar name={shownName} url={studentNoticeAccess ? avatarUrl : null} />
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
                  {accounts.data?.enabled && !locked && (
                    <label className="cab-form-label">
                      <span>{t('account.switchUser')}</span>
                      <select
                        value={accounts.data.currentKey ?? ''}
                        disabled={switching}
                        onChange={(e) => {
                          if (e.target.value) void swap(e.target.value);
                        }}
                      >
                        <option value="" disabled>
                          {t('account.selectDemo')}
                        </option>
                        {accounts.data.items.map((choice) => (
                          <option key={choice.key} value={choice.key}>
                            {choice.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {accounts.error && !locked && (
                    <button className="cab-text-button" type="button" onClick={accounts.refresh}>
                      {t('account.catalogUnavailable')}
                    </button>
                  )}
                  <LanguageSelector />
                  <button
                    className="cab-text-button"
                    type="button"
                    onClick={leave}
                    disabled={switching}
                  >
                    Выйти
                  </button>
                  {accountError && (
                    <p className="cab-form-error" role="alert">
                      {t('account.switchFailed')}
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
          ) : locked || passwordPage ? (
            <StudentPassword required={locked} hasAccess={!suspended} navigate={navigate} />
          ) : suspended ? (
            <StudentSuspended
              {...(contacts ? { contacts } : {})}
              refresh={profile.refresh}
              navigate={navigate}
            />
          ) : section.id === 'home' ? (
            <Home
              key={role}
              role={role}
              name={name}
              zone={zone}
              navigate={navigate}
              noticePreview={
                studentNoticeAccess ? (
                  <StudentNotificationPreview inbox={inbox} zone={zone} navigate={navigate} />
                ) : undefined
              }
            />
          ) : (
            <>
              {!teacherLessonId && !studentLessonId && !studentPayments && (
                <div className="cab-page-title">
                  <div>
                    <h1>{title}</h1>
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
                  {...(subjectQuery ? { subjectId: subjectQuery } : {})}
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
              ) : teacherHomework ? (
                <Suspense fallback={<LoadState refreshing />}>
                  <TeacherHomeworkPanel
                    {...(route.detail
                      ? { detail: detailPage?.params.deliveryId ?? route.detail }
                      : {})}
                    search={search}
                    zone={zone}
                    navigate={navigate}
                  />
                </Suspense>
              ) : teacherStudents ? (
                <Suspense fallback={<LoadState refreshing />}>
                  <TeacherStudentsPanel
                    {...(route.detail
                      ? { detail: detailPage?.params.enrollmentId ?? route.detail }
                      : {})}
                    search={search}
                    zone={zone}
                    navigate={navigate}
                  />
                </Suspense>
              ) : teacherReports ? (
                <Suspense fallback={<LoadState refreshing />}>
                  <TeacherReportsPanel
                    {...(route.detail
                      ? { detail: detailPage?.params.checkpointId ?? route.detail }
                      : {})}
                    search={search}
                    zone={zone}
                    navigate={navigate}
                  />
                </Suspense>
              ) : skillPage ? (
                subjectQuery === '' ? (
                  <SubjectUnavailable navigate={navigate} />
                ) : (
                  <StudentSkills
                    key={search}
                    subjectId={subjectQuery}
                    zone={zone}
                    navigate={navigate}
                  />
                )
              ) : role === 'STUDENT' && section.id === 'subjects' ? (
                <StudentSubjects selected={subjectQuery} zone={zone} navigate={navigate} />
              ) : role === 'STUDENT' && section.id === 'profile' ? (
                <StudentProfile
                  name={name}
                  avatarUrl={avatarUrl}
                  email={email}
                  zone={zone}
                  navigate={navigate}
                  onSaved={(updated) =>
                    setProfileChange({
                      base: profile.data,
                      name: updated.displayName,
                      avatarUrl: updated.avatarUrl,
                    })
                  }
                />
              ) : role === 'STUDENT' && section.id === 'security' ? (
                <StudentSecurity email={email} zone={zone} navigate={navigate} />
              ) : role === 'STUDENT' && section.id === 'notifications' ? (
                <StudentNotifications
                  inbox={inbox}
                  search={search}
                  zone={zone}
                  navigate={navigate}
                />
              ) : studentReports ? (
                <Suspense fallback={<LoadState refreshing />}>
                  <StudentReportsPanel
                    path={path}
                    search={search}
                    {...(route.detail ? { detail: route.detail } : {})}
                    zone={zone}
                    accountId={accountId}
                    navigate={navigate}
                  />
                </Suspense>
              ) : studentSubscription ? (
                <Suspense fallback={<LoadState refreshing />}>
                  <StudentSubscriptionPanel
                    key={search}
                    search={search}
                    zone={zone}
                    navigate={navigate}
                    refreshAccess={profile.refresh}
                  />
                </Suspense>
              ) : studentHelp ? (
                <section className="cab-card cab-panel cab-lesson-stack">
                  <StudentManagerContacts {...(contacts ? { contacts } : {})} />
                  <CabinLink to="/student/lessons" navigate={navigate} className="cab-inline-link">
                    {locale === 'ro' ? 'Deschide orarul' : 'Открыть расписание'}{' '}
                    <Icon name="arrow" size={16} />
                  </CabinLink>
                </section>
              ) : relatedSubject !== null && scopedCapability ? (
                <SubjectScope id={relatedSubject} capability={scopedCapability} navigate={navigate}>
                  {workspace}
                </SubjectScope>
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
                  {workspace()}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function readLocation() {
  return {
    path: window.location.pathname.replace(/\/+$/, '') || '/',
    search: window.location.search,
  };
}

export function CabinetApp() {
  const [{ path, search }, setLocation] = useState(readLocation);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const onPop = () => setLocation(readLocation());
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

  function navigate(url: string, replace = false, preserveScroll = false) {
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin) return;
    if (target.pathname === path && target.search === window.location.search) return;
    if (replace) window.history.replaceState({}, '', target.pathname + target.search);
    else window.history.pushState({}, '', target.pathname + target.search);
    setLocation(readLocation());
    if (!preserveScroll) window.scrollTo({ top: 0 });
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
      search={search}
      navigate={navigate}
      leave={() => void signOut()}
    />
  );
}
