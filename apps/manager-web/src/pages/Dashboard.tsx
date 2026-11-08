import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getManagerDashboard } from '@online-school/api-contracts';
import {
  ErrorState,
  FreshnessLabel,
  k8kEnabled,
  PriorityEvents,
  useLocale,
} from '@online-school/ui';
import { read } from '../api/client.js';
import { State, Select } from '../components/ui.js';
import { Icon, Initials } from '../components/icon.js';
import type { IconName } from '../components/icon.js';
import { useManager } from '../session.js';
import { ru, label } from '../i18n/ru.js';
import { formatMoney } from '../lib/money.js';
import { displayTime, schoolDate, localInput, dateShift } from '../lib/time.js';
import { MANAGER_ROUTES as routes } from '../routes.js';

type CalendarLesson = {
  lessonId: string;
  studentId: string;
  studentName: string;
  startsAt: string;
  teacherName: string;
  hasMeetLink: boolean;
};
const shortTime = (iso: string, zone: string) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
function EmptyBlock({ icon, title, caption }: { icon: IconName; title: string; caption: string }) {
  return (
    <div className="dashboard-empty">
      <span className="empty-icon">
        <Icon name={icon} size={23} />
      </span>
      <strong>{title}</strong>
      <p>{caption}</p>
    </div>
  );
}
function CalendarPanel({
  lessons,
  timezone,
  stamp,
}: {
  lessons: CalendarLesson[];
  timezone: string;
  stamp: string;
}) {
  const [selected, setSelected] = useState(stamp);
  const [month, setMonth] = useState(stamp.slice(0, 7));
  const first = new Date(`${month}-01T12:00:00Z`);
  const start = dateShift(`${month}-01`, -((first.getUTCDay() + 6) % 7));
  const monthLabel = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(first);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(`2026-11-${String(i + 2).padStart(2, '0')}T12:00:00Z`),
    ),
  );
  function shift(delta: number) {
    const d = new Date(first);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMonth(d.toISOString().slice(0, 7));
  }
  const selectedLessons = lessons.filter(
    (l) => localInput(l.startsAt, timezone).slice(0, 10) === selected,
  );
  return (
    <section className="panel dashboard-calendar">
      <div className="section-heading">
        <h2>{ru.workingCalendar}</h2>
        <Link className="icon-button" aria-label={ru.openCalendar} to={routes.schedule}>
          <Icon name="calendar" />
        </Link>
      </div>
      <div className="month-nav">
        <strong>{monthLabel}</strong>
        <div>
          <button
            className="icon-button"
            type="button"
            aria-label={ru.calendarPrevious}
            onClick={() => shift(-1)}
          >
            <Icon name="chevron" style={{ transform: 'rotate(180deg)' }} size={16} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label={ru.calendarNext}
            onClick={() => shift(1)}
          >
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </div>
      <div className="month-grid">
        {weekdays.map((day) => (
          <span className="weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const day = dateShift(start, i);
          const hasLesson = lessons.some(
            (l) => localInput(l.startsAt, timezone).slice(0, 10) === day,
          );
          return (
            <button
              type="button"
              className={`month-day ${day.slice(0, 7) !== month ? 'outside' : ''} ${day === stamp ? 'is-today' : ''}`}
              key={day}
              aria-label={dayLabel(day)}
              aria-pressed={day === selected}
              onClick={() => setSelected(day)}
            >
              {parseInt(day.slice(8), 10)}
              {hasLesson && <span className="lesson-dot" />}
            </button>
          );
        })}
      </div>
      <div className="selected-day">
        <strong>{dayLabel(selected)}</strong>
        <span>{ru.scheduleForDay}</span>
      </div>
      {selectedLessons.length ? (
        <ul className="mini-lessons">
          {selectedLessons.map((l) => (
            <li key={l.lessonId}>
              <time>{shortTime(l.startsAt, timezone)}</time>
              <Link to={`${routes.schedule}?studentId=${encodeURIComponent(l.studentId)}`}>
                {l.studentName}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="calendar-note">{ru.calendarEmpty}</p>
      )}
    </section>
  );
}
export default function Dashboard() {
  const me = useManager();
  const { locale, t } = useLocale();
  const [horizon, setHorizon] = useState<24 | 48 | 168>(48);
  const [days, setDays] = useState<3 | 7 | 14>(7);
  const query = useQuery({
    queryKey: ['manager', 'dashboard', horizon, days],
    queryFn: ({ signal }) =>
      read(
        (o) => getManagerDashboard({ lessonsHorizonHours: horizon, expiringDays: days }, o),
        signal,
      ),
  });
  const priority = k8kEnabled && !query.isError ? query.data?.priority : undefined;
  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <h1>{ru.dashboard}</h1>
        </div>
        <div className="dashboard-horizons">
          <Select
            name="horizon"
            label={ru.horizon}
            placeholder={false}
            value={horizon}
            options={[24, 48, 168].map((n) => ({ id: String(n), label: String(n) }))}
            onChange={(e) => setHorizon(parseInt(e.target.value, 10) as 24 | 48 | 168)}
          />
          <Select
            name="days"
            label={ru.expiringDays}
            placeholder={false}
            value={days}
            options={[3, 7, 14].map((n) => ({ id: String(n), label: String(n) }))}
            onChange={(e) => setDays(parseInt(e.target.value, 10) as 3 | 7 | 14)}
          />
        </div>
      </div>
      <State operational query={query} asOf={query.data?.generatedAt}>
        {(d) => {
          const metrics: Array<{
            title: string;
            count: number;
            icon: IconName;
            tone: string;
            to: string;
            hint: string;
          }> = [
            {
              title: ru.newLeads,
              count: d.leads.countsByStage.NEW,
              icon: 'users',
              tone: 'blue',
              to: `${routes.leads}?stage=NEW`,
              hint: ru.leads,
            },
            {
              title: ru.activeStudents,
              count: d.students.active,
              icon: 'users',
              tone: 'green',
              to: `${routes.students}?status=ACTIVE`,
              hint: ru.activeNow,
            },
            {
              title: ru.frozenStudents,
              count: d.students.frozen,
              icon: 'pause',
              tone: 'purple',
              to: `${routes.students}?status=FROZEN`,
              hint: ru.subscriptions,
            },
            {
              title: ru.visibleLessons,
              count: d.upcomingLessons.length,
              icon: 'calendar',
              tone: 'blue',
              to: routes.schedule,
              hint: ru.withinHorizon,
            },
            {
              title: ru.pendingPayments,
              count: d.pendingPayments.count,
              icon: 'wallet',
              tone: 'amber',
              to: '#pending-payments',
              hint: ru.paymentReviewHint,
            },
            {
              title: ru.overdue,
              count: d.overdueTasks.count,
              icon: 'tasks',
              tone: 'orange',
              to: `${routes.tasks}?overdue=true`,
              hint: ru.taskReviewHint,
            },
          ];
          return (
            <>
              {priority === null ? (
                <section aria-label={t('priorityAttention')}>
                  <ErrorState
                    retryRead={() => void query.refetch()}
                    refreshing={query.isFetching}
                  />
                </section>
              ) : (
                priority && (
                  <>
                    <PriorityEvents
                      enabled
                      source={{
                        primary: priority.primary && {
                          id: priority.primary.taskId,
                          title: priority.primary.title,
                          action: (
                            <Link className="button" to={routes.task(priority.primary.taskId)}>
                              {locale === 'ro' ? 'Deschide sarcina' : 'Открыть задачу'}
                            </Link>
                          ),
                        },
                        criticalCount: priority.criticalCount,
                        queueAction: priority.queueAction === 'TASK_QUEUE' && (
                          <Link className="button" to={routes.tasks}>
                            {t('chrome.openQueue')}
                          </Link>
                        ),
                      }}
                    />
                    <FreshnessLabel asOf={priority.sourceAsOf} receivedAt={query.dataUpdatedAt} />
                  </>
                )
              )}
              <div className="metrics dashboard-metrics">
                {metrics.map((m) => (
                  <Link className="metric-card" key={m.title} to={m.to}>
                    <span className={`metric-icon tone-${m.tone}`}>
                      <Icon name={m.icon} size={23} />
                    </span>
                    <div>
                      <span className="metric-label">{m.title}</span>
                      <strong>{m.count}</strong>
                      <small>{m.hint}</small>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="dashboard-main">
                <section className="panel dashboard-tasks">
                  <div className="section-heading">
                    <h2>
                      {ru.myTasks}
                      <span className="count">{d.overdueTasks.count}</span>
                    </h2>
                    <Link className="subtle-link" to={routes.tasks}>
                      {ru.viewAll}
                      <Icon name="arrow" size={15} />
                    </Link>
                  </div>
                  <div className="panel-tabs">
                    <Link className="selected" to={`${routes.tasks}?overdue=true`}>
                      {ru.overdue}
                      <span>{d.overdueTasks.count}</span>
                    </Link>
                    <Link to={routes.tasks}>{ru.openTasks}</Link>
                  </div>
                  {d.overdueTasks.top.length ? (
                    <ul className="workspace-list task-summary-list">
                      {d.overdueTasks.top.map((t) => (
                        <li key={t.taskId}>
                          <span className="row-icon tone-amber">
                            <Icon name="tasks" size={18} />
                          </span>
                          <div className="row-main">
                            <Link to={routes.task(t.taskId)}>{label(t.type)}</Link>
                            <span>{t.studentName}</span>
                          </div>
                          <time className="due-time">{displayTime(t.dueAt, me.timezone)}</time>
                          <Initials name={t.studentName} tone="purple" />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyBlock icon="tasks" title={ru.noOverdue} caption={ru.noOverdueHelp} />
                  )}
                </section>
                <section className="panel dashboard-lessons">
                  <div className="section-heading">
                    <h2>{ru.upcoming}</h2>
                    <Link className="subtle-link" to={routes.schedule}>
                      {ru.openCalendar}
                      <Icon name="arrow" size={15} />
                    </Link>
                  </div>
                  {d.upcomingLessons.length ? (
                    <ul className="workspace-list lesson-summary-list">
                      {d.upcomingLessons.map((l, i) => (
                        <li
                          key={l.lessonId}
                          style={
                            {
                              '--row-accent': ['#2864ed', '#13a782', '#9560d6'][i % 3],
                            } as React.CSSProperties
                          }
                        >
                          <time className="lesson-time">
                            {shortTime(l.startsAt, me.timezone)}
                            <small>
                              {dayLabel(localInput(l.startsAt, me.timezone).slice(0, 10))}
                            </small>
                          </time>
                          <Initials name={l.studentName} tone={i % 2 ? 'green' : 'blue'} />
                          <div className="row-main">
                            <Link to={routes.student(l.studentId)}>{l.studentName}</Link>
                            <span>{l.teacherName}</span>
                          </div>
                          <span
                            className={`meet-indicator ${l.hasMeetLink ? 'available' : ''}`}
                            title={l.hasMeetLink ? ru.meet : ru.noMeet}
                          >
                            <Icon name="calendar" size={16} />
                            <span>{l.hasMeetLink ? ru.meet : ru.noMeet}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyBlock icon="calendar" title={ru.noUpcoming} caption={ru.noUpcomingHelp} />
                  )}
                </section>
                <CalendarPanel
                  lessons={d.upcomingLessons}
                  timezone={me.timezone}
                  stamp={schoolDate(me.timezone)}
                />
              </div>
              <div className="dashboard-bottom">
                <section className="panel" id="pending-payments">
                  <div className="section-heading">
                    <h2>
                      {ru.payments}
                      <span className="count">{d.pendingPayments.count}</span>
                    </h2>
                    <span className="row-icon tone-green">
                      <Icon name="wallet" size={19} />
                    </span>
                  </div>
                  <div className="panel-tabs">
                    <span className="selected">{ru.pendingPayments}</span>
                  </div>
                  {d.pendingPayments.totalsByCurrency.length ? (
                    <>
                      <div className="payment-totals">
                        {d.pendingPayments.totalsByCurrency.map((b) => (
                          <div key={b.currency}>
                            <span className="currency-tag">{b.currency}</span>
                            <strong>{formatMoney(b.amount, b.currency)}</strong>
                            <span className="badge status-awaiting_approval">
                              {ru.paymentReviewHint}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="hint finance-caption">{ru.pendingHelp}</p>
                      <Link className="subtle-link" to={routes.students}>
                        {ru.paymentShortcutHelp}
                        <Icon name="arrow" size={15} />
                      </Link>
                    </>
                  ) : (
                    <EmptyBlock icon="wallet" title={ru.noPending} caption={ru.noPendingHelp} />
                  )}
                </section>
                <section className="panel">
                  <div className="section-heading">
                    <h2>
                      {ru.expiring}
                      <span className="count">{d.expiringSubscriptions.length}</span>
                    </h2>
                    <Link className="subtle-link" to={`${routes.students}?expiring=true`}>
                      {ru.viewAll}
                      <Icon name="arrow" size={15} />
                    </Link>
                  </div>
                  {d.expiringSubscriptions.length ? (
                    <ul className="workspace-list subscription-summary-list">
                      {d.expiringSubscriptions.map((s) => (
                        <li key={s.subscriptionId}>
                          <Initials name={s.studentName} tone="orange" />
                          <div className="row-main">
                            <Link to={`${routes.student(s.studentId)}?tab=subscriptions`}>
                              {s.studentName}
                            </Link>
                            <span>
                              {ru.remaining}: {s.remainingLessons}
                            </span>
                          </div>
                          <time>{displayTime(s.endsAt, me.timezone)}</time>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyBlock icon="clock" title={ru.noExpiring} caption={ru.noExpiringHelp} />
                  )}
                </section>
                <section className="panel dashboard-shortcuts">
                  <h2>{ru.quickActions}</h2>
                  <div className="quick-actions">
                    {[
                      {
                        icon: 'users' as const,
                        label: ru.quickStudent,
                        to: `${routes.students}?create=true`,
                        tone: 'blue',
                      },
                      {
                        icon: 'wallet' as const,
                        label: ru.quickPayment,
                        to: routes.students,
                        tone: 'green',
                      },
                      {
                        icon: 'calendar' as const,
                        label: ru.quickLesson,
                        to: `${routes.schedule}?create=true`,
                        tone: 'purple',
                      },
                      {
                        icon: 'tasks' as const,
                        label: ru.quickTask,
                        to: routes.tasks,
                        tone: 'orange',
                      },
                    ].map((a) => (
                      <Link key={a.label} className={`quick-action tone-${a.tone}`} to={a.to}>
                        <Icon name={a.icon} />
                        <span>{a.label}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="portfolio-summary">
                    <span className="row-icon tone-blue">
                      <Icon name="users" />
                    </span>
                    <div>
                      <strong>{me.portfolioSize}</strong>
                      <span>{ru.portfolio}</span>
                    </div>
                    <Link className="icon-button" aria-label={ru.myPortfolio} to={routes.students}>
                      <Icon name="arrow" />
                    </Link>
                  </div>
                </section>
              </div>
              <p className="dashboard-updated">
                <Icon name="clock" size={14} />
                {ru.generated}: {displayTime(d.generatedAt, me.timezone)}
              </p>
              <section className="panel">
                <div className="section-heading">
                  <h2>{ru.pipeline}</h2>
                  <Link to={routes.leads}>{ru.leads} →</Link>
                </div>
                <div className="lead-summary">
                  {Object.entries(d.leads.countsByStage).map(([stage, count]) => (
                    <Link key={stage} to={`${routes.leads}?stage=${stage}`}>
                      <span>{label(stage)}</span>
                      <strong>{count}</strong>
                    </Link>
                  ))}
                </div>
                <p className="hint">
                  {ru.createdToday}: {d.leads.createdToday} · {ru.trialsToday}:{' '}
                  {d.leads.trialsToday} · {ru.conversion30d}:{' '}
                  {(d.leads.conversion30dBp / 100).toFixed(2).replace('.', ',')}%
                </p>
              </section>
            </>
          );
        }}
      </State>
    </>
  );
}
