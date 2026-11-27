import { Clock, Video, VideoOff } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TileShape } from '../../shared/analytics';
import { Bars } from '../../shared/charts';
import { dayKey, fmtDay, fmtMoney, fmtTime, plural, relative } from '../../shared/format';
import { MiniCalendar } from '../../shared/MiniCalendar';
import { Avatar, Badge, Empty } from '../../shared/ui';
import { selectJournal, selectPayrollTotals, selectRate } from '../logic';
import { useTeacher } from '../store';
import type { TeacherNotification } from '../types';

const NOTE_TEXT: Record<TeacherNotification['type'], string> = {
  LESSON_SCHEDULED: 'Назначен урок',
  LESSON_RESCHEDULED: 'Урок перенесён',
  LESSON_CANCELLED: 'Урок отменён',
  HOMEWORK_SUBMITTED: 'Сдано задание',
  CHECKPOINT_DUE: 'Контрольная точка',
  SCHEDULE_REQUEST_RESOLVED: 'Запрос по расписанию решён',
};

export function TeacherToday() {
  const { state, run } = useTeacher();
  const navigate = useNavigate();
  const journal = useMemo(() => selectJournal(state), [state]);
  const awaiting = journal.filter((j) => j.state === 'AWAITING_REPORT');
  const todayKey = dayKey(state.now);
  const today = state.lessons.filter((l) => dayKey(l.startsAt) === todayKey && l.status !== 'CANCELLED');
  const upcomingToday = today.filter((l) => l.endsAt > state.now);
  const review = state.homework.filter((h) => h.state === 'AWAITING_REVIEW');
  const cps = state.checkpoints.filter((c) => c.state === 'PENDING');
  const totals = selectPayrollTotals(state.payroll.lines);
  const rate = selectRate(state);
  const first = state.me.displayName.split(' ')[0];
  const nowMs = new Date(state.now).getTime();
  const busy = new Set(state.lessons.filter((l) => l.status !== 'CANCELLED').map((l) => dayKey(l.startsAt)));
  const weekLoad = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(state.now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + i);
    return state.lessons.filter((l) => dayKey(l.startsAt) === dayKey(d.toISOString()) && l.status !== 'CANCELLED').length;
  });
  const h = new Date(state.now).getHours();

  return (
    <div className="split">
      <div className="stack">
        <section className="hero" aria-labelledby="t-hello">
          <div>
            <h1 id="t-hello">
              {h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'}, {first}
            </h1>
            <p>
              Сегодня {today.length} {plural(today.length, 'урок', 'урока', 'уроков')}
              {upcomingToday[0] ? `, ближайший в ${fmtTime(upcomingToday[0].startsAt)} — ${upcomingToday[0].studentName}` : ''}. Будьте готовы за 5 минут: интернет, камера, материалы.
            </p>
            <div className="actions">
              <button type="button" className="btn btn-dark" onClick={() => navigate('/teacher/journal')}>
                Внести результаты {awaiting.length ? `(${awaiting.length})` : ''}
              </button>
              <button type="button" className="btn btn-accent" onClick={() => navigate('/teacher/homework')}>
                Проверить задания {review.length ? `(${review.length})` : ''}
              </button>
            </div>
          </div>
          <img className="mascot" src="/mascot.svg" alt="" />
        </section>

        <AfterLesson />

        <div className="grid-4">
          <Kpi tone="tile-yellow" label="Ждут результата" value={awaiting.length} hint="в течение 24 ч" onClick={() => navigate('/teacher/journal')} />
          <Kpi tone="tile-coral" label="На проверке" value={review.length} hint="до следующего урока" onClick={() => navigate('/teacher/homework')} />
          <Kpi tone="tile-violet" label="Контрольные точки" value={cps.length} hint="каждые 4 / 8 уроков" onClick={() => navigate('/teacher/checkpoints')} />
          <Kpi tone="tile-teal" label="Начислено за месяц" value={fmtMoney(totals.accrued, 'MDL')} hint={`ставка ${fmtMoney(rate.rate, 'MDL')}`} onClick={() => navigate('/teacher/payroll')} />
        </div>

        <LessonProgress />

        <section className="card" aria-labelledby="h-today">
          <div className="card-head">
            <h3 id="h-today">Уроки сегодня</h3>
            <button type="button" className="link right" onClick={() => navigate('/teacher/schedule')}>Неделя</button>
          </div>
          {today.length === 0 ? (
            <Empty title="Сегодня уроков нет" />
          ) : (
            <div className="list">
              {today.map((l) => {
                const opens = new Date(l.joinOpensAt).getTime();
                const ended = new Date(l.endsAt).getTime() <= nowMs;
                const canJoin = !ended && nowMs >= opens && l.meetLinkState === 'PRESENT';
                const reported = Boolean(state.reports[l.lessonId]);
                return (
                  <div key={l.lessonId} className="row-item" style={{ flexWrap: 'wrap' }}>
                    <span className="time-pill num">{fmtTime(l.startsAt)}</span>
                    <Avatar name={l.studentName} />
                    <span className="grow">
                      <span className="title">{l.studentName}</span>
                      <span className="sub">{l.kind === 'TRIAL' ? 'Пробный урок · диагностика' : l.subjectName}</span>
                    </span>
                    {l.meetLinkState === 'MISSING' && <Badge tone="coral"><VideoOff size={12} /> Нет ссылки Meet</Badge>}
                    {ended ? (
                      reported ? <Badge tone="teal">Результат внесён</Badge> : (
                        <button type="button" className="btn btn-dark btn-sm" onClick={() => navigate(`/teacher/journal?lesson=${l.lessonId}`)}>Внести результат</button>
                      )
                    ) : canJoin ? (
                      <a className="btn btn-dark btn-sm" href="https://meet.google.com" target="_blank" rel="noreferrer"><Video size={14} /> Начать урок</a>
                    ) : (
                      <span className="time-pill"><Clock size={12} /> {relative(l.startsAt, state.now)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="two-col">
          <section className="card" aria-labelledby="h-review">
            <div className="card-head">
              <h3 id="h-review">Сданные работы</h3>
              <button type="button" className="link right" onClick={() => navigate('/teacher/homework')}>Все</button>
            </div>
            {review.length === 0 ? <Empty title="Всё проверено" /> : (
              <div className="list">
                {review.map((h) => (
                  <button key={h.deliveryId} type="button" className="row-item" onClick={() => navigate(`/teacher/homework?id=${h.deliveryId}`)}>
                    <Avatar name={h.studentName} />
                    <span className="grow">
                      <span className="title">{h.title}</span>
                      <span className="sub">{h.studentName} · сдано {h.latestSubmittedAt ? relative(h.latestSubmittedAt, state.now) : ''}</span>
                    </span>
                    {h.isLate && <Badge tone="coral">После срока</Badge>}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="card" aria-labelledby="h-load">
            <div className="card-head">
              <h3 id="h-load">Нагрузка недели</h3>
              <span className="right muted num" style={{ fontSize: 13 }}>{weekLoad.reduce((a, b) => a + b, 0)} / {state.limits.perWeek}</span>
            </div>
            <Bars values={weekLoad} highlight={(new Date(state.now).getDay() + 6) % 7} color="var(--teal)" limit={state.limits.perDay} label={`Уроков по дням недели: ${weekLoad.join(', ')}; лимит ${state.limits.perDay} в день`} />
            <div className="legend" style={{ justifyContent: 'space-between' }}>
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => <span key={d}>{d} <b className="num">{weekLoad[i]}</b></span>)}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Лимит: {state.limits.perDay} в день, {state.limits.perWeek} в неделю, перерыв {state.limits.breakMin} мин.</p>
          </section>
        </div>
      </div>

      <aside className="side-col" aria-label="Календарь и уведомления">
        <MiniCalendar now={state.now} busy={busy} />
        <MonthSummary />
        <ManagerContact />
        <section className="card" aria-labelledby="h-notes">
          <div className="card-head">
            <h3 id="h-notes">Уведомления</h3>
            <button type="button" className="link right" onClick={() => run({ type: 'notification.readAll' })}>Прочитать все</button>
          </div>
          <div className="list">
            {state.notifications.map((n) => (
              <button key={n.key} type="button" className="row-item" style={{ background: n.read ? undefined : 'var(--accent-tint)' }} onClick={() => !n.read && run({ type: 'notification.read', key: n.key })}>
                <span className="grow">
                  <span className="title">{NOTE_TEXT[n.type]}</span>
                  <span className="sub">{n.studentName}{n.lessonAt ? ` · ${fmtDay(n.lessonAt)}, ${fmtTime(n.lessonAt)}` : ''}</span>
                </span>
                <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{relative(n.occurredAt, state.now)}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Kpi({ tone, label, value, hint, onClick }: { tone: string; label: string; value: string | number; hint: string; onClick: () => void }) {
  return (
    <button type="button" className={`tile ${tone}`} style={{ minHeight: 130, border: 0, textAlign: 'left' }} onClick={onClick}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span className="big-num num" style={{ marginTop: 'auto', fontSize: typeof value === 'number' ? 40 : 24 }}>{value}</span>
      <span className="muted" style={{ fontSize: 12 }}>{hint}</span>
    </button>
  );
}

/** This month vs last month from payroll lines (GET /teacher/payroll?month=…). */
function MonthSummary() {
  const { state } = useTeacher();
  const navigate = useNavigate();
  const prev = state.payrollHistory.at(-1);
  const sum = (lines: typeof state.payroll.lines) => lines.reduce((a, l) => a + Number(l.amount), 0);
  const now = state.payroll.lines.filter((l) => l.status !== 'NO_PAYMENT');
  const before = prev ? prev.lines.filter((l) => l.status !== 'NO_PAYMENT') : [];
  // Same elapsed days of the previous month, so the comparison is fair mid-month.
  const day = Number(dayKey(state.now).slice(8, 10));
  const beforeSoFar = before.filter((l) => Number(dayKey(l.lessonStartedAt).slice(8, 10)) <= day);
  const delta = now.length - beforeSoFar.length;
  return (
    <button type="button" className="tile tile-teal" style={{ border: 0, textAlign: 'left', minHeight: 0 }} onClick={() => navigate('/teacher/payroll')}>
      <TileShape color="teal" />
      <span style={{ fontWeight: 600, position: 'relative' }}>Мой месяц</span>
      <div className="metric-row" style={{ position: 'relative' }}>
        <div className="metric">
          <b className="num">{now.length}</b>
          <span>уроков проведено</span>
        </div>
        <div className="metric">
          <b className="num">{fmtMoney(sum(now).toFixed(2), 'MDL')}</b>
          <span>начислено</span>
        </div>
      </div>
      <span className="muted" style={{ fontSize: 12, position: 'relative', marginTop: 8 }}>
        {prev ? `${delta >= 0 ? '+' : '−'}${Math.abs(delta)} уроков к тому же дню прошлого месяца` : 'нет данных за прошлый месяц'} · аналитика в «Начислениях»
      </span>
    </button>
  );
}

/** Requests to the manager (POST/GET /teacher/schedule-requests) surfaced on the home page. */
function ManagerContact() {
  const { state } = useTeacher();
  const navigate = useNavigate();
  const pending = state.requests.filter((r) => r.status === 'PENDING');
  return (
    <section className="card" aria-labelledby="h-mgr">
      <div className="card-head">
        <h3 id="h-mgr">Связь с менеджером</h3>
        <span className="right">
          <Badge tone={pending.length ? 'yellow' : 'teal'}>{pending.length ? `${pending.length} ждут ответа` : 'всё решено'}</Badge>
        </span>
      </div>
      <div className="list">
        {state.requests.slice(0, 3).map((r) => (
          <button key={r.requestId} type="button" className="row-item" onClick={() => navigate('/teacher/schedule')}>
            <span className="grow">
              <span className="title">{r.reason}</span>
              <span className="sub">{r.studentName ?? 'Без привязки к уроку'}</span>
            </span>
            <Badge tone={r.status === 'PENDING' ? (r.emergency ? 'coral' : 'yellow') : 'teal'}>{r.status === 'PENDING' ? (r.emergency ? 'Экстренно' : 'Ждёт') : 'Решён'}</Badge>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-dark btn-sm" onClick={() => navigate('/teacher/schedule?request=new')}>
          Написать запрос
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/teacher/schedule')}>
          Все запросы
        </button>
      </div>
    </section>
  );
}

/**
 * "После урока": every past lesson still waiting for its result, oldest deadline first,
 * with the action on the row. Mirrors GET /teacher/journal (state AWAITING_REPORT).
 */
function AfterLesson() {
  const { state } = useTeacher();
  const navigate = useNavigate();
  const items = selectJournal(state)
    .filter((j) => j.state === 'AWAITING_REPORT')
    .sort((a, b) => a.reportDeadlineAt.localeCompare(b.reportDeadlineAt));
  if (items.length === 0) return null;
  return (
    <section className="card after-lesson" aria-labelledby="h-after">
      <div className="card-head">
        <h3 id="h-after">После урока</h3>
        <Badge tone={items.some((j) => j.overdue) ? 'coral' : 'yellow'}>{items.length}</Badge>
        <span className="right muted" style={{ fontSize: 12 }}>подтвердите факт и тему урока — без этого он не попадёт в начисления</span>
      </div>
      <div className="list">
        {items.map((j) => (
          <div key={j.lessonId} className={`row-item${j.overdue ? ' overdue-row' : ''}`}>
            <span className="time-pill num">{fmtDay(j.startsAt)}, {fmtTime(j.startsAt)}</span>
            <span className="grow">
              <span className="title">{j.studentName}</span>
              <span className="sub">
                {j.subjectName}
                {j.kind === 'TRIAL' ? ' · пробный' : ''} ·{' '}
                {j.overdue ? <b className="neg">срок прошёл {relative(j.reportDeadlineAt, state.now)}, задача ушла менеджеру</b> : `внести до ${fmtTime(j.reportDeadlineAt)}, ${fmtDay(j.reportDeadlineAt)}`}
              </span>
            </span>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => navigate(`/teacher/journal?lesson=${j.lessonId}`)}>
              Внести результат
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Lessons of this month and week: how many are planned and how many already have a result. */
function LessonProgress() {
  const { state } = useTeacher();
  const navigate = useNavigate();
  const today = dayKey(state.now);
  const done = new Set(selectJournal(state).filter((j) => j.state === 'CONDUCTED').map((j) => j.lessonId));
  const monday = (() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const sunday = (() => {
    const d = new Date(`${monday}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    return d.toISOString().slice(0, 10);
  })();
  const live = state.lessons.filter((l) => l.status !== 'CANCELLED');
  const month = live.filter((l) => dayKey(l.startsAt).slice(0, 7) === today.slice(0, 7));
  const week = live.filter((l) => dayKey(l.startsAt) >= monday && dayKey(l.startsAt) <= sunday);
  const trials = month.filter((l) => l.kind === 'TRIAL');
  const nextTrial = trials.find((l) => l.startsAt > state.now);
  const tile = (title: string, list: typeof live, tone: string, range: string) => {
    const d = list.filter((l) => done.has(l.lessonId)).length;
    const pct = list.length ? Math.round((d / list.length) * 100) : 0;
    return (
      <button type="button" className={`tile ${tone}`} style={{ border: 0, textAlign: 'left', minHeight: 0 }} onClick={() => navigate(`/teacher/lessons?range=${range}`)}>
        <span style={{ fontWeight: 600, position: 'relative' }}>{title}</span>
        <span className="big-num num" style={{ fontSize: 34, marginTop: 10, position: 'relative' }}>{list.length}</span>
        <span style={{ fontSize: 12, position: 'relative', display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span>проведено {d}</span>
          <b className="num">{pct}%</b>
        </span>
        <span className="bar" style={{ position: 'relative', marginTop: 6, background: 'rgb(13 26 56 / 10%)' }} aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </span>
      </button>
    );
  };
  return (
    <div className="grid-3">
      {tile('Уроки в этом месяце', month, 'tile-blue', 'month')}
      {tile('Уроки на этой неделе', week, 'tile-violet', 'week')}
      <button type="button" className="tile tile-yellow" style={{ border: 0, textAlign: 'left', minHeight: 0 }} onClick={() => navigate('/teacher/lessons?range=month&kind=TRIAL')}>
        <span style={{ fontWeight: 600, position: 'relative' }}>Пробные уроки</span>
        <span className="big-num num" style={{ fontSize: 34, marginTop: 10, position: 'relative' }}>{trials.length}</span>
        <span style={{ fontSize: 12, position: 'relative', marginTop: 6 }}>
          {nextTrial ? `ближайший ${fmtDay(nextTrial.startsAt)}, ${fmtTime(nextTrial.startsAt)} · ${nextTrial.studentName}` : 'в этом месяце больше нет'}
        </span>
      </button>
    </div>
  );
}
