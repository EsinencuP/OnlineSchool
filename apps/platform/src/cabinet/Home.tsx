import { useState } from 'react';
import type { ReactNode } from 'react';
import type { components } from '@online-school/api-contracts';
import { Calendar, Icon } from '@online-school/ui';
import type { CalendarEvent, IconName } from '@online-school/ui';
import { StageArt } from './Access.js';
import { SubjectIcon } from './Brand.js';
import { display, LoadState, Status } from './Operations.js';
import { DirectorPayrollChart, ManagerAnalytics } from './Analytics.js';
import { useEndpoint } from './hooks.js';
import { homes, record, rowsOf, safeMeet } from './contract.js';
import { recordUrl } from './recordRoutes.js';
import { subjectSkills, subjectUrl, withSubject } from './studentSubjectRoutes.js';
import type { Details, Role } from './contract.js';

type Schemas = components['schemas'];
type Navigate = (url: string) => void;
type HomeProps = {
  role: Role;
  name: string;
  zone: string;
  navigate: Navigate;
  noticePreview?: ReactNode;
};
type Tone = 'violet' | 'mint' | 'peach' | 'blue' | 'rose';
type Summary = { title: string; value: unknown; icon: IconName; tone: Tone; to?: string };
const zeroDay = 86400_000;
const dateLabel = (date: Date, zone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
const dayHeading = (date: Date, zone: string) =>
  new Intl.DateTimeFormat('ru', {
    timeZone: zone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
const formatClock = (value: unknown, zone: string) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('ru', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(
        new Date(value),
      )
    : '—';
function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function CabinLink({
  to,
  navigate,
  className,
  children,
}: {
  to: string;
  navigate: Navigate;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      className={className}
      href={to}
      onClick={(event) => {
        if (
          event.button ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.shiftKey ||
          event.defaultPrevented
        )
          return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`cab-card cab-panel ${className}`}>
      <div className="cab-panel-title">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Metrics({ items, navigate }: { items: Summary[]; navigate: Navigate }) {
  return (
    <div className="cab-metrics">
      {items.map((item) => {
        const inside = (
          <>
            <div className="cab-metric-head">
              <span className={`cab-icon-disc cab-tone-${item.tone}`}>
                <Icon size={18} name={item.icon} />
              </span>
              {item.to && <Icon name="arrow" size={17} />}
            </div>
            <div className="cab-metric-value">{display(item.value)}</div>
            <div className="cab-metric-label">{item.title}</div>
          </>
        );
        return item.to ? (
          <CabinLink
            key={item.title}
            to={item.to}
            navigate={navigate}
            className="cab-card cab-metric"
          >
            {inside}
          </CabinLink>
        ) : (
          <div key={item.title} className="cab-card cab-metric">
            {inside}
          </div>
        );
      })}
    </div>
  );
}
function SectionLink({
  to,
  navigate,
  children,
}: {
  to: string;
  navigate: Navigate;
  children: ReactNode;
}) {
  return (
    <CabinLink className="cab-inline-link" to={to} navigate={navigate}>
      {children}
      <Icon name="arrow" size={15} />
    </CabinLink>
  );
}
function EventList({
  rows,
  zone,
  navigate,
  path,
  operation,
}: {
  rows: Details[];
  zone: string;
  navigate: Navigate;
  path: string;
  operation?: string;
}) {
  if (!rows.length) return <LoadState />;
  return (
    <div className="cab-agenda-list">
      {rows.slice(0, 6).map((row, index) => {
        const start = row.startsAt ?? row.scheduledAt ?? row.dueAt ?? row.requestedAt;
        const title = textValue(row.subjectName ?? row.title ?? row.studentName) || 'Занятие';
        const subtitle = [row.teacherName, row.studentName].find(
          (name) => typeof name === 'string' && name !== title,
        );
        const target = row.lessonId ?? row.id ?? row.taskId ?? row.deliveryId;
        const destination = operation ? recordUrl(operation, row) : null;
        return (
          <CabinLink
            key={String(target ?? index)}
            to={
              destination ??
              (!operation && path !== '/manager/schedule' && typeof target === 'string'
                ? `${path}/${encodeURIComponent(target)}`
                : path)
            }
            navigate={navigate}
            className="cab-agenda-item"
          >
            <span
              className={`cab-agenda-time cab-tone-${(['violet', 'mint', 'peach', 'blue'] as const)[index % 4]}`}
            >
              {formatClock(start, zone)}
            </span>
            <span className="cab-agenda-title">
              <strong>{title}</strong>
              {typeof subtitle === 'string' && <small>{subtitle}</small>}
            </span>
            <Status value={row.status} />
            <Icon name="arrow" size={16} />
          </CabinLink>
        );
      })}
    </div>
  );
}

function MiniCalendar({
  rows,
  zone,
  navigate,
  path,
}: {
  rows: Details[];
  zone: string;
  navigate: Navigate;
  path: string;
}) {
  const now = new Date();
  const today = dateLabel(now, zone);
  const [month, setMonth] = useState(() => new Date(`${today.slice(0, 7)}-01T12:00:00Z`));
  const [selected, setSelected] = useState(today);
  const firstDay = (month.getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const monthPrefix = month.toISOString().slice(0, 7);
  const scheduledDays = new Set(
    rows.flatMap((row) => {
      const start = row.startsAt ?? row.scheduledAt;
      return typeof start === 'string' && Number.isFinite(Date.parse(start))
        ? [dateLabel(new Date(start), zone)]
        : [];
    }),
  );
  const selectedLessons = rows.filter((row) => {
    const start = row.startsAt ?? row.scheduledAt;
    return (
      typeof start === 'string' &&
      Number.isFinite(Date.parse(start)) &&
      dateLabel(new Date(start), zone) === selected
    );
  });
  return (
    <Panel
      title="Календарь"
      className="cab-mini-calendar"
      action={
        <SectionLink to={path} navigate={navigate}>
          Расписание
        </SectionLink>
      }
    >
      <div className="cab-month-head">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          onClick={() =>
            setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1, 12)))
          }
        >
          ‹
        </button>
        <strong>
          {new Intl.DateTimeFormat('ru', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(month)}
        </strong>
        <button
          type="button"
          aria-label="Следующий месяц"
          onClick={() =>
            setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, 12)))
          }
        >
          ›
        </button>
      </div>
      <div className="cab-mini-grid">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label) => (
          <span className="cab-weekday" key={label}>
            {label}
          </span>
        ))}
        {Array.from({ length: firstDay }, (_, index) => (
          <span key={`before-${index}`} />
        ))}
        {Array.from({ length: total }, (_, index) => {
          const day = `${monthPrefix}-${String(index + 1).padStart(2, '0')}`;
          return (
            <button
              type="button"
              key={day}
              aria-label={`${dayHeading(new Date(`${day}T12:00:00Z`), zone)}${scheduledDays.has(day) ? ', есть уроки' : ''}`}
              aria-current={today === day ? 'date' : undefined}
              aria-pressed={day === selected}
              data-has-class={scheduledDays.has(day)}
              onClick={() => setSelected(day)}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
      {selectedLessons.length ? (
        <EventList rows={selectedLessons} zone={zone} navigate={navigate} path={path} />
      ) : (
        <p className="cab-calendar-hint">В ближайших занятиях на выбранный день записей нет.</p>
      )}
    </Panel>
  );
}

function StudentHome({ name, zone, navigate, noticePreview }: HomeProps) {
  const result = useEndpoint<Schemas['DashboardResponseDto']>('getStudentDashboard');
  const upcoming = useEndpoint<Schemas['LessonsResponseDto']>('getStudentUpcomingLessons');
  const homework = useEndpoint<Schemas['HomeworkResponseDto']>(
    'getStudentHomework',
    {},
    { page: 1, pageSize: 3 },
  );
  const subjects = useEndpoint<Schemas['StudentSubjectsResponseDto']>('getStudentSubjects');
  const lesson = result.data?.nextLesson;
  const meet = lesson?.canJoin ? safeMeet(lesson.meetLink) : null;
  const rows = rowsOf(upcoming.data);
  return (
    <>
      <div className="cab-page-title">
        <div>
          <h1>{name ? `Здравствуйте, ${name.split(' ')[0]}!` : 'Мой кабинет'}</h1>
          <p>{dayHeading(new Date(), zone)}</p>
        </div>
        <CabinLink to="/student/lessons" navigate={navigate} className="cab-button cab-secondary">
          <Icon name="calendar" size={18} /> Моё расписание
        </CabinLink>
      </div>
      <div className="cab-home-grid">
        <div className="cab-main-column">
          <section className="cab-hero">
            <div className="cab-hero-text">
              <span className="cab-hero-pill">
                <Icon name="video" size={16} /> Ближайший урок
              </span>
              <h2>
                {lesson?.subjectName ??
                  (result.pending ? 'Расписание загружается' : 'Время для учёбы')}
              </h2>
              {result.error ? (
                <p>
                  {result.error instanceof Error
                    ? 'Проверьте доступ к расписанию.'
                    : 'Расписание недоступно.'}
                </p>
              ) : lesson ? (
                <p>
                  {display(lesson.scheduledAt)} · {lesson.durationMinutes} мин
                  <br />
                  {lesson.teacherName}
                </p>
              ) : (
                <p>
                  {result.pending
                    ? 'Уточняем время следующего занятия.'
                    : 'Предстоящие занятия появятся после записи.'}
                </p>
              )}
              {meet ? (
                <a href={meet} target="_blank" rel="noreferrer" className="cab-button cab-primary">
                  Войти в урок <Icon name="external" size={17} />
                </a>
              ) : (
                <CabinLink
                  to={lesson ? `/student/lessons/${lesson.lessonId}` : '/student/lessons'}
                  navigate={navigate}
                  className="cab-button cab-primary"
                >
                  {lesson ? 'Открыть урок' : 'Посмотреть расписание'}{' '}
                  <Icon name="arrow" size={17} />
                </CabinLink>
              )}
            </div>
            <StageArt {...(lesson?.subjectName ? { subject: lesson.subjectName } : {})} />
          </section>
          <Metrics
            navigate={navigate}
            items={[
              {
                title: 'Заданий к сдаче',
                value: result.data?.homework.notSubmitted,
                icon: 'tasks',
                tone: 'violet',
                to: '/student/homework',
              },
              {
                title: 'Нужна доработка',
                value: result.data?.homework.needsRevision,
                icon: 'clock',
                tone: 'peach',
                to: '/student/homework',
              },
              {
                title: 'Уроков осталось',
                value: result.data?.subscription?.lessonsRemaining,
                icon: 'wallet',
                tone: 'mint',
                to: '/student/subscription',
              },
            ]}
          />
          <Panel
            title="Домашние задания"
            action={
              <SectionLink to="/student/homework" navigate={navigate}>
                Все задания
              </SectionLink>
            }
          >
            {homework.pending || homework.error ? (
              <LoadState
                error={homework.error}
                refreshing={homework.pending}
                retry={homework.refresh}
              />
            ) : !homework.data?.items.length ? (
              <LoadState />
            ) : (
              <div className="cab-agenda-list">
                {homework.data.items.map((entry, i) => {
                  const hw = record(entry);
                  return (
                    <CabinLink
                      to={`/student/homework/${encodeURIComponent(String(hw.homeworkId ?? hw.id ?? hw.hwId ?? ''))}`}
                      navigate={navigate}
                      key={String(hw.homeworkId ?? hw.id ?? i)}
                      className="cab-agenda-item"
                    >
                      <span className={`cab-icon-disc cab-tone-${i % 2 ? 'mint' : 'violet'}`}>
                        <SubjectIcon compact subject={textValue(hw.subjectName)} />
                      </span>
                      <span className="cab-agenda-title">
                        <strong>{display(hw.title)}</strong>
                        <small>{display(hw.subjectName ?? hw.dueAt)}</small>
                      </span>
                      <Status value={hw.status} />
                      <Icon name="arrow" size={16} />
                    </CabinLink>
                  );
                })}
              </div>
            )}
          </Panel>
          <Panel
            title="Мои предметы"
            action={
              <SectionLink to={subjectSkills} navigate={navigate}>
                Карта навыков
              </SectionLink>
            }
          >
            {subjects.pending || subjects.error ? (
              <LoadState
                error={subjects.error}
                refreshing={subjects.pending}
                retry={subjects.refresh}
              />
            ) : subjects.data?.items.length ? (
              <div className="cab-subject-grid">
                {subjects.data.items.map((row, i) => (
                  <CabinLink
                    to={subjectUrl(row.subjectId)}
                    navigate={navigate}
                    key={row.subjectId}
                    className={`cab-subject-tile cab-tone-${(['violet', 'mint', 'peach', 'blue'] as const)[i % 4]}`}
                  >
                    <SubjectIcon subject={row.subjectName} />
                    <strong>{row.subjectName}</strong>
                    <Status value={row.displayStatus} />
                  </CabinLink>
                ))}
              </div>
            ) : (
              <LoadState />
            )}
          </Panel>
        </div>
        <aside className="cab-side-column">
          <MiniCalendar
            rows={
              lesson && !rows.some((row) => row.lessonId === lesson.lessonId)
                ? [record(lesson), ...rows]
                : rows
            }
            zone={zone}
            navigate={navigate}
            path="/student/lessons"
          />
          <Panel
            title="Следующие занятия"
            action={
              <SectionLink to="/student/lessons" navigate={navigate}>
                Все
              </SectionLink>
            }
          >
            {upcoming.pending || upcoming.error ? (
              <LoadState
                error={upcoming.error}
                refreshing={upcoming.pending}
                retry={upcoming.refresh}
              />
            ) : (
              <EventList rows={rows} zone={zone} navigate={navigate} path="/student/lessons" />
            )}
          </Panel>
          {result.data?.subscription && (
            <div className="cab-access-card cab-tone-mint">
              <Icon name="wallet" size={22} />
              <div>
                <strong>Абонемент</strong>
                <p>
                  {result.data.subscription.isFrozen
                    ? 'На заморозке'
                    : result.data.subscription.validUntil
                      ? `До ${result.data.subscription.validUntil}`
                      : 'Действует'}
                </p>
              </div>
              <SectionLink to="/student/subscription" navigate={navigate}>
                Подробнее
              </SectionLink>
            </div>
          )}
          {noticePreview}
        </aside>
      </div>
    </>
  );
}

const roleHomeSource: Record<Exclude<Role, 'STUDENT'>, string> = {
  TEACHER: 'getTeacherToday',
  MANAGER: 'getManagerDashboard',
  DIRECTOR: 'getDirectorDecisionSummary',
  TECH_OPERATOR: 'getComponentStatus',
};
const roleDetailsSource: Record<Exclude<Role, 'STUDENT'>, string> = {
  TEACHER: 'getTeacherHomework',
  MANAGER: 'listManagerTasks',
  DIRECTOR: 'getDirectorDecisions',
  TECH_OPERATOR: 'getQueueHealth',
};
function StaffHome({ role, name, zone, navigate }: HomeProps & { role: Exclude<Role, 'STUDENT'> }) {
  const result = useEndpoint<unknown>(roleHomeSource[role]);
  const details = useEndpoint<unknown>(roleDetailsSource[role]);
  const payload = record(result.data);
  const home = homes[role];
  const summary: Record<typeof role, Summary[]> = {
    TEACHER: [
      {
        title: 'Занятий сегодня',
        value: result.data ? rowsOf(result.data).length : null,
        icon: 'calendar',
        tone: 'violet',
        to: home + '/lessons',
      },
      {
        title: 'Итоги записаны',
        value: result.data ? rowsOf(result.data).filter((row) => row.outcomeRecorded).length : null,
        icon: 'check',
        tone: 'mint',
        to: home + '/reports',
      },
      {
        title: 'Выданные задания',
        value: record(details.data).total,
        icon: 'tasks',
        tone: 'peach',
        to: home + '/homework',
      },
    ],
    MANAGER: [
      {
        title: 'Активных учеников',
        value: record(payload.students).active,
        icon: 'users',
        tone: 'violet',
        to: home + '/students',
      },
      {
        title: 'Просроченные задачи',
        value: record(payload.overdueTasks).count,
        icon: 'clock',
        tone: 'peach',
        to: home + '/tasks',
      },
      {
        title: 'Ожидают распределения',
        value: record(payload.pendingPayments).count,
        icon: 'wallet',
        tone: 'mint',
        to: home + '/payments',
      },
    ],
    DIRECTOR: [
      {
        title: 'Требуют решения',
        value: payload.total,
        icon: 'tasks',
        tone: 'violet',
        to: home + '/decisions',
      },
      {
        title: 'Поступления',
        value: payload.payment,
        icon: 'wallet',
        tone: 'mint',
        to: home + '/decisions',
      },
      {
        title: 'Запросы возврата',
        value: payload.refundRequest,
        icon: 'materials',
        tone: 'peach',
        to: home + '/refunds',
      },
    ],
    TECH_OPERATOR: [
      { title: 'API', value: payload.api, icon: 'health', tone: 'violet', to: home + '/health' },
      {
        title: 'База данных',
        value: payload.db,
        icon: 'materials',
        tone: 'mint',
        to: home + '/health',
      },
      {
        title: 'Worker',
        value: payload.worker,
        icon: 'clock',
        tone: 'peach',
        to: home + '/queues',
      },
    ],
  };
  const queueRows = rowsOf(details.data);
  const lessonRows =
    role === 'TEACHER'
      ? rowsOf(result.data)
      : Array.isArray(payload.upcomingLessons)
        ? payload.upcomingLessons.map(record)
        : [];
  const mainPage: Record<typeof role, { title: string; path: string }> = {
    TEACHER: { title: 'Задания к проверке', path: '/teacher/homework' },
    MANAGER: { title: 'Очередь задач', path: '/manager/tasks' },
    DIRECTOR: { title: 'Очередь решений', path: '/director/decisions' },
    TECH_OPERATOR: { title: 'Очереди worker', path: '/operator/queues' },
  };
  const page = mainPage[role];
  const schedule = role === 'MANAGER' ? '/manager/schedule' : '/teacher/lessons';
  const showCalendar = role === 'TEACHER' || role === 'MANAGER';
  return (
    <>
      <div className="cab-page-title">
        <div>
          <h1>{name ? `Здравствуйте, ${name.split(' ')[0]}!` : 'Рабочий обзор'}</h1>
          <p>{dayHeading(new Date(), zone)}</p>
        </div>
        <CabinLink to={page.path} navigate={navigate} className="cab-button cab-primary">
          <Icon name="tasks" size={18} /> {page.title}
        </CabinLink>
      </div>
      {result.error || result.pending ? (
        <LoadState error={result.error} refreshing={result.pending} retry={result.refresh} />
      ) : null}
      <Metrics items={summary[role]} navigate={navigate} />
      {role === 'MANAGER' && result.data ? <ManagerAnalytics payload={payload} /> : null}
      {role === 'DIRECTOR' ? <DirectorPayrollChart /> : null}
      <div className="cab-home-grid cab-staff-home">
        <div className="cab-main-column">
          <Panel
            title={page.title}
            action={
              <SectionLink to={page.path} navigate={navigate}>
                Открыть
              </SectionLink>
            }
          >
            {details.error || details.pending ? (
              <LoadState
                refreshing={details.pending}
                error={details.error}
                retry={details.refresh}
              />
            ) : queueRows.length ? (
              <EventList
                rows={queueRows}
                zone={zone}
                navigate={navigate}
                path={page.path}
                operation={roleDetailsSource[role]}
              />
            ) : role === 'TECH_OPERATOR' && details.data ? (
              <div className="cab-queue-summary">
                <Icon name="health" size={20} /> Состояние очередей получено.{' '}
                <SectionLink to={page.path} navigate={navigate}>
                  Подробности
                </SectionLink>
              </div>
            ) : (
              <LoadState />
            )}
          </Panel>
          {showCalendar && (
            <Panel
              title="Ближайшие занятия"
              action={
                <SectionLink to={schedule} navigate={navigate}>
                  Расписание
                </SectionLink>
              }
            >
              <EventList rows={lessonRows} zone={zone} navigate={navigate} path={schedule} />
            </Panel>
          )}
        </div>
        <aside className="cab-side-column">
          {showCalendar ? (
            <MiniCalendar rows={lessonRows} zone={zone} navigate={navigate} path={schedule} />
          ) : (
            <Panel title={role === 'DIRECTOR' ? 'Расчётные периоды' : 'Проверка платформы'}>
              <SectionLink
                to={role === 'DIRECTOR' ? '/director/finance' : '/operator/health'}
                navigate={navigate}
              >
                Открыть раздел
              </SectionLink>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}

export function Home(props: HomeProps) {
  if (props.role === 'STUDENT') return <StudentHome {...props} />;
  return <StaffHome {...props} role={props.role} />;
}
export function SchedulePreview({
  role,
  zone,
  navigate,
  subjectId,
}: {
  role: Role;
  zone: string;
  navigate: Navigate;
  subjectId?: string;
}) {
  const [now] = useState(() => new Date());
  const [range, setRange] = useState(0);
  const pivot = new Date(now.getTime() + range * 7 * zeroDay);
  const from = new Date(pivot.getTime() - 12 * 3600_000);
  const to = new Date(pivot.getTime() + 7.5 * zeroDay);
  const read = useEndpoint<unknown>(
    role === 'MANAGER'
      ? 'listManagerSchedule'
      : role === 'TEACHER'
        ? 'getTeacherToday'
        : 'getStudentLessons',
    {},
    role === 'MANAGER'
      ? { from: from.toISOString(), to: to.toISOString() }
      : role === 'TEACHER'
        ? { date: dateLabel(pivot, zone) }
        : { period: 'week', pageSize: 100, ...(subjectId ? { subjectId } : {}) },
  );
  const days =
    role === 'TEACHER'
      ? [dateLabel(pivot, zone)]
      : Array.from({ length: 7 }, (_, index) =>
          dateLabel(new Date(pivot.getTime() + index * zeroDay), zone),
        );
  const events: CalendarEvent[] = rowsOf(read.data).flatMap((row) => {
    const id = row.id ?? row.lessonId;
    const startsAt = row.startsAt ?? row.scheduledAt;
    const duration = row.durationMinutes;
    const end =
      row.endsAt ??
      (typeof startsAt === 'string' &&
      typeof duration === 'number' &&
      Number.isFinite(Date.parse(startsAt))
        ? new Date(Date.parse(startsAt) + duration * 60_000).toISOString()
        : null);
    if (
      typeof id !== 'string' ||
      typeof startsAt !== 'string' ||
      typeof end !== 'string' ||
      row.status === 'CANCELLED'
    )
      return [];
    return [
      {
        id,
        startsAt,
        endsAt: end,
        revision: null,
        state: row.status === 'STAR_PENDING' ? 'pending-renewal' : 'busy',
        title: textValue(row.subjectName ?? row.studentName) || 'Занятие',
      },
    ];
  });
  return (
    <Panel
      title="Календарь занятий"
      action={
        role !== 'STUDENT' && (
          <div className="cab-calendar-controls">
            <button
              type="button"
              className="cab-button cab-secondary"
              aria-label="Предыдущий интервал"
              onClick={() => setRange(range - 1)}
            >
              ‹
            </button>
            <button type="button" className="cab-button cab-secondary" onClick={() => setRange(0)}>
              Сегодня
            </button>
            <button
              type="button"
              className="cab-button cab-secondary"
              aria-label="Следующий интервал"
              onClick={() => setRange(range + 1)}
            >
              ›
            </button>
          </div>
        )
      }
    >
      {read.error || read.pending ? (
        <LoadState refreshing={read.pending} error={read.error} retry={read.refresh} />
      ) : (
        <Calendar
          label="Занятия"
          timeZone={zone}
          view={role === 'TEACHER' ? 'day' : 'week'}
          days={days}
          horizon={read.data ? { from: from.toISOString(), to: to.toISOString() } : null}
          events={events}
          {...(role === 'STUDENT'
            ? {
                renderEvent: (event: CalendarEvent) => (
                  <CabinLink
                    to={withSubject('/student/lessons/' + encodeURIComponent(event.id), subjectId)}
                    navigate={navigate}
                    className="cab-inline-link"
                  >
                    {event.title}
                  </CabinLink>
                ),
              }
            : {})}
        />
      )}
    </Panel>
  );
}
