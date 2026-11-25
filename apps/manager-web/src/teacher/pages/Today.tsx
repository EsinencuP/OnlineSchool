import { ArrowUpRight, Clock, TriangleAlert, Video, VideoOff } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const overdue = awaiting.filter((j) => j.overdue);
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

        {overdue.length > 0 && (
          <button type="button" className="row-item" style={{ background: 'var(--coral)', color: '#fff', padding: '14px 18px' }} onClick={() => navigate('/teacher/journal')}>
            <TriangleAlert size={20} />
            <span className="grow">
              <b>{overdue.length} {plural(overdue.length, 'урок', 'урока', 'уроков')} без результата дольше 24 часов</b>
              <span style={{ display: 'block', fontSize: 13, opacity: 0.9 }}>Задача уже ушла менеджеру. Внесите результат, чтобы урок попал в начисления.</span>
            </span>
            <ArrowUpRight size={18} />
          </button>
        )}

        <div className="grid-4">
          <Kpi tone="tile-yellow" label="Ждут результата" value={awaiting.length} hint="в течение 24 ч" onClick={() => navigate('/teacher/journal')} />
          <Kpi tone="tile-coral" label="На проверке" value={review.length} hint="до следующего урока" onClick={() => navigate('/teacher/homework')} />
          <Kpi tone="tile-violet" label="Контрольные точки" value={cps.length} hint="каждые 4 / 8 уроков" onClick={() => navigate('/teacher/checkpoints')} />
          <Kpi tone="tile-teal" label="Начислено за месяц" value={fmtMoney(totals.accrued, 'MDL')} hint={`ставка ${fmtMoney(rate.rate, 'MDL')}`} onClick={() => navigate('/teacher/payroll')} />
        </div>

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
            <Bars values={weekLoad} highlight={(new Date(state.now).getDay() + 6) % 7} color="var(--teal)" label={`Уроков по дням недели: ${weekLoad.join(', ')}`} />
            <div className="legend" style={{ justifyContent: 'space-between' }}>
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => <span key={d}>{d} <b className="num">{weekLoad[i]}</b></span>)}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Лимит: {state.limits.perDay} в день, {state.limits.perWeek} в неделю, перерыв {state.limits.breakMin} мин.</p>
          </section>
        </div>
      </div>

      <aside className="side-col" aria-label="Календарь и уведомления">
        <MiniCalendar now={state.now} busy={busy} />
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
