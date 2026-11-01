import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getManagerDashboard } from '@online-school/api-contracts';
import { read } from '../api/client.js';
import { State, Select } from '../components/ui.js';
import { useManager } from '../session.js';
import { ru } from '../i18n/ru.js';
import { formatMoney } from '../lib/money.js';
import { displayTime } from '../lib/time.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
export default function Dashboard() {
  const me = useManager();
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
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{ru.academy}</p>
          <h1>{ru.dashboard}</h1>
        </div>
        <Link className="button primary" to={routes.students}>
          {ru.students} →
        </Link>
      </div>
      <div className="filters">
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
      <State query={query}>
        {(d) => (
          <>
            <div className="metrics">
              <article>
                <span>{ru.activeStudents}</span>
                <strong>{d.students.active}</strong>
                <Link to={`${routes.students}?status=ACTIVE`}>{ru.students} →</Link>
              </article>
              <article>
                <span>{ru.frozenStudents}</span>
                <strong>{d.students.frozen}</strong>
                <Link to={`${routes.students}?status=FROZEN`}>{ru.students} →</Link>
              </article>
              <article>
                <span>{ru.leads}</span>
                <strong>{d.students.leads}</strong>
                <Link to={`${routes.students}?status=LEAD`}>{ru.students} →</Link>
              </article>
              <article>
                <span>{ru.overdue}</span>
                <strong>{d.overdueTasks.count}</strong>
                <Link to={`${routes.tasks}?overdue=true`}>{ru.tasks} →</Link>
              </article>
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <h2>{ru.upcoming}</h2>
                {d.upcomingLessons.length ? (
                  <ul className="record-list">
                    {d.upcomingLessons.map((l) => (
                      <li key={l.lessonId}>
                        <Link
                          to={`${routes.schedule}?studentId=${encodeURIComponent(l.studentId)}`}
                        >
                          {l.studentName}
                        </Link>
                        <time>{displayTime(l.startsAt, me.timezone)}</time>
                        <span>{l.teacherName}</span>
                        <small>{l.hasMeetLink ? ru.meet : ru.noMeet}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="state">{ru.empty}</p>
                )}
              </section>
              <section className="panel">
                <h2>{ru.overdue}</h2>
                {d.overdueTasks.top.length ? (
                  <ul className="record-list">
                    {d.overdueTasks.top.map((t) => (
                      <li key={t.taskId}>
                        <Link to={routes.task(t.taskId)}>{t.studentName}</Link>
                        <span>{displayTime(t.dueAt, me.timezone)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="state">{ru.empty}</p>
                )}
              </section>
              <section className="panel">
                <h2>{ru.expiring}</h2>
                {d.expiringSubscriptions.length ? (
                  <ul className="record-list">
                    {d.expiringSubscriptions.map((s) => (
                      <li key={s.subscriptionId}>
                        <Link to={`${routes.student(s.studentId)}?tab=subscriptions`}>
                          {s.studentName}
                        </Link>
                        <span>{displayTime(s.endsAt, me.timezone)}</span>
                        <small>
                          {ru.remaining}: {s.remainingLessons}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="state">{ru.empty}</p>
                )}
              </section>
              <section className="panel">
                <h2>
                  {ru.pendingPayments} <span className="count">{d.pendingPayments.count}</span>
                </h2>
                <p className="hint">{ru.pendingHelp}</p>
                {d.pendingPayments.totalsByCurrency.length ? (
                  d.pendingPayments.totalsByCurrency.map((b) => (
                    <p className="money-total" key={b.currency}>
                      {formatMoney(b.amount, b.currency)}
                    </p>
                  ))
                ) : (
                  <p className="state">{ru.empty}</p>
                )}
              </section>
            </div>
            <p className="hint">
              {ru.generated}: {displayTime(d.generatedAt, me.timezone)}
            </p>
          </>
        )}
      </State>
    </>
  );
}
