import { ArrowUpRight, TriangleAlert, Video, VideoOff } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bars, Ring, Sparkline } from '../../shared/charts';
import { MiniCalendar } from '../../shared/MiniCalendar';
import { Avatar, Badge, Empty } from '../../shared/ui';
import { selectDashboard } from '../logic';
import { useManager } from '../store';
import { dayKey, fmtDay, fmtMoney, fmtTime, plural, relative } from '../../shared/format';
import { leadStage, taskType } from '../labels';

function greeting(iso: string) {
  const h = Number(fmtTime(iso).slice(0, 2));
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function Dashboard() {
  const { state } = useManager();
  const navigate = useNavigate();
  const d = useMemo(() => selectDashboard(state), [state]);
  const firstName = state.me.displayName.split(' ')[0];
  const todayKey = dayKey(state.now);
  const todayLessons = state.lessons.filter((l) => dayKey(l.startsAt) === todayKey && l.status !== 'CANCELLED');
  const pendingTotal = d.pendingPayments.totalsByCurrency.map((t) => fmtMoney(t.amount, t.currency)).join(' · ') || '0';
  const stages = ['NEW', 'IN_PROGRESS', 'TRIAL', 'AWAITING_PAYMENT'] as const;
  const stageCounts = stages.map((s) => d.leads.countsByStage[s]);
  const funnelMax = stages.reduce((m, s) => Math.max(m, d.leads.countsByStage[s]), 0);
  const conv = (d.leads.conversion30dBp / 100).toFixed(0);

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div className="page-head">
        <div>
          <h1>
            {greeting(state.now)}, {firstName}
          </h1>
          <p>
            Сегодня {todayLessons.length} {plural(todayLessons.length, 'урок', 'урока', 'уроков')} у ваших учеников,{' '}
            {d.overdueTasks.count} {plural(d.overdueTasks.count, 'просроченная задача', 'просроченные задачи', 'просроченных задач')} и{' '}
            {d.pendingPayments.count} {plural(d.pendingPayments.count, 'платёж ждёт', 'платежа ждут', 'платежей ждут')} подтверждения.
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/manager/leads?new=1')}>
            Новая заявка
          </button>
          <button type="button" className="btn btn-dark" onClick={() => navigate('/manager/tasks')}>
            Очередь задач
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {d.priority && d.priority.criticalCount > 0 && (
        <button
          type="button"
          className="row-item"
          style={{ background: 'var(--coral)', color: '#fff', padding: '14px 18px' }}
          onClick={() => navigate('/manager/tasks?filter=overdue')}
        >
          <TriangleAlert size={20} />
          <span className="grow">
            <b>Срочно: {d.priority.criticalCount} {plural(d.priority.criticalCount, 'критичная задача', 'критичные задачи', 'критичных задач')}</b>
            <span style={{ display: 'block', fontSize: 13, opacity: 0.9 }}>
              Первая в очереди — {d.priority.primary?.title}. Таймер принятия срочной задачи — 10 минут.
            </span>
          </span>
          <ArrowUpRight size={18} />
        </button>
      )}

      <div className="dash">
        <div className="dash-main">
          <div className="tiles">
            <section className="tile tile-yellow" aria-labelledby="t-leads">
              <svg className="shape" viewBox="0 0 100 100" aria-hidden="true">
                <path d="M35 0h30v35h35v30H65v35H35V65H0V35h35z" fill="var(--yellow)" />
              </svg>
              <h3 id="t-leads">Заявки в воронке</h3>
              <div className="metric-row">
                {stages.map((s) => (
                  <div key={s} className={`metric${s === 'NEW' ? ' underline' : ''}`}>
                    <b className="num">{d.leads.countsByStage[s]}</b>
                    <span>{leadStage[s].label}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                <Bars values={stageCounts} highlight={stageCounts.indexOf(funnelMax)} label={`Заявки по стадиям: ${stages.map((s) => `${leadStage[s].label} ${d.leads.countsByStage[s]}`).join(', ')}`} />
              </div>
            </section>

            <section className="tile tile-coral" aria-labelledby="t-conv">
              <svg className="shape" viewBox="0 0 100 100" aria-hidden="true">
                <path d="M50 88 10 50a22 22 0 0 1 40-30 22 22 0 0 1 40 30z" fill="var(--coral)" />
              </svg>
              <h3 id="t-conv">Конверсия за 30 дней</h3>
              <div className="metric-row">
                <div className="metric">
                  <b className="num">{conv}%</b>
                  <span>в учеников</span>
                </div>
                <div className="metric">
                  <b className="num">{d.leads.createdToday}</b>
                  <span>новых сегодня</span>
                </div>
                <div className="metric">
                  <b className="num">{d.leads.trialsToday}</b>
                  <span>пробных сегодня</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                <Sparkline
                  series={[state.leadTrend.map((x) => x.created), state.leadTrend.map((x) => x.converted)]}
                  colors={['var(--ink)', 'var(--coral-ink)']}
                  label="Динамика заявок и конверсий за 14 дней"
                  height={92}
                />
                <div className="legend" style={{ marginTop: 4 }}>
                  <span><i style={{ background: 'var(--ink)' }} />Новые заявки</span>
                  <span><i style={{ background: 'var(--coral-ink)' }} />Стали учениками</span>
                  <span style={{ marginLeft: 'auto' }}>14 дней</span>
                </div>
              </div>
            </section>
          </div>

          <div className="tiles-2">
            <section className="tile tile-teal" style={{ minHeight: 150 }} aria-labelledby="t-st">
              <svg className="shape" viewBox="0 0 100 100" aria-hidden="true">
                <path d="M50 100 0 0h100z" fill="var(--teal)" />
              </svg>
              <h3 id="t-st">Портфель учеников</h3>
              <div className="metric-row">
                <div className="metric">
                  <b className="num">{d.students.active}</b>
                  <span>учатся</span>
                </div>
                <div className="metric">
                  <b className="num">{d.students.frozen}</b>
                  <span>заморожены</span>
                </div>
                <div className="metric">
                  <b className="num">{d.students.leads}</b>
                  <span>открытых заявок</span>
                </div>
              </div>
              <button type="button" className="link" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} onClick={() => navigate('/manager/students')}>
                Все ученики
              </button>
            </section>
            <section className="tile tile-blue" style={{ minHeight: 150 }} aria-labelledby="t-pay">
              <svg className="shape" viewBox="0 0 100 100" aria-hidden="true">
                <path d="m50 0 12 30 32-6-20 26 20 26-32-6-12 30-12-30-32 6 20-26L6 24l32 6z" fill="var(--blue)" />
              </svg>
              <h3 id="t-pay">Ожидают оплаты</h3>
              <div className="metric-row">
                <div className="metric">
                  <b className="num">{d.pendingPayments.count}</b>
                  <span>поступлений</span>
                </div>
                <div className="metric">
                  <b className="num">{pendingTotal}</b>
                  <span>сумма</span>
                </div>
              </div>
              <button type="button" className="link" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} onClick={() => navigate('/manager/payments')}>
                К платежам
              </button>
            </section>
          </div>

          <div className="two-col">
            <section className="card" aria-labelledby="h-overdue">
              <div className="card-head">
                <h3 id="h-overdue">Просроченные задачи</h3>
                <span className="right">
                  <Badge tone={d.overdueTasks.count ? 'coral' : 'teal'}>{d.overdueTasks.count}</Badge>
                </span>
              </div>
              {d.overdueTasks.top.length === 0 ? (
                <Empty title="Всё вовремя" text="Просроченных задач нет." />
              ) : (
                <div className="list">
                  {d.overdueTasks.top.map((t) => (
                    <button key={t.taskId} type="button" className="row-item" onClick={() => navigate(`/manager/tasks?task=${t.taskId}`)}>
                      <Avatar name={t.studentName} />
                      <span className="grow">
                        <span className="title">{t.studentName}</span>
                        <span className="sub">{taskType[t.type].label}</span>
                      </span>
                      <span className="time-pill overdue">{relative(t.dueAt, state.now)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="h-exp">
              <div className="card-head">
                <h3 id="h-exp">Абонементы заканчиваются</h3>
                <span className="right muted">7 дней</span>
              </div>
              {d.expiringSubscriptions.length === 0 ? (
                <Empty title="Нет истекающих абонементов" />
              ) : (
                <div className="list">
                  {d.expiringSubscriptions.map((s) => (
                    <button key={s.subscriptionId} type="button" className="row-item" onClick={() => navigate(`/manager/students?id=${s.studentId}`)}>
                      <Ring value={s.remainingLessons} max={8} size={44} color="var(--coral)" label={`Осталось ${s.remainingLessons} занятий`}>
                        <b className="num" style={{ fontSize: 13 }}>{s.remainingLessons}</b>
                      </Ring>
                      <span className="grow">
                        <span className="title">{s.studentName}</span>
                        <span className="sub">
                          {plural(s.remainingLessons, 'осталось занятие', 'осталось занятия', 'осталось занятий')} · до {fmtDay(s.endsAt)}
                        </span>
                      </span>
                      <span className="time-pill">{relative(s.endsAt, state.now)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="card" aria-labelledby="h-upcoming">
            <div className="card-head">
              <h3 id="h-upcoming">Ближайшие уроки · 48 часов</h3>
              <button type="button" className="link right" onClick={() => navigate('/manager/schedule')}>
                Расписание
              </button>
            </div>
            {d.upcomingLessons.length === 0 ? (
              <Empty title="Уроков в ближайшие 48 часов нет" />
            ) : (
              <div className="list">
                {d.upcomingLessons.slice(0, 6).map((l) => (
                  <div key={l.lessonId} className="row-item">
                    <span className="time-pill num">{fmtTime(l.startsAt)}</span>
                    <span className="grow">
                      <span className="title">{l.studentName}</span>
                      <span className="sub">
                        {fmtDay(l.startsAt)} · {l.teacherName}
                      </span>
                    </span>
                    {l.hasMeetLink ? (
                      <Badge tone="teal">
                        <Video size={13} /> Ссылка есть
                      </Badge>
                    ) : (
                      <Badge tone="coral">
                        <VideoOff size={13} /> Нет ссылки
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="side-col" aria-label="Календарь и день">
          <MiniCalendar now={state.now} busy={new Set(state.lessons.filter((l) => l.status !== 'CANCELLED').map((l) => dayKey(l.startsAt)))} />
          <DayTimeline />
        </aside>
      </div>
    </div>
  );
}

function DayTimeline() {
  const { state } = useManager();
  const navigate = useNavigate();
  const todayKey = dayKey(state.now);
  const items = state.lessons.filter((l) => dayKey(l.startsAt) === todayKey && l.status !== 'CANCELLED');
  const nowIdx = items.findIndex((l) => l.startsAt > state.now);

  return (
    <section className="card" aria-labelledby="h-today">
      <div className="card-head">
        <h3 id="h-today">Сегодня</h3>
        <span className="right muted">{items.length} {plural(items.length, 'урок', 'урока', 'уроков')}</span>
      </div>
      {items.length === 0 ? (
        <Empty title="Сегодня уроков нет" />
      ) : (
        <div className="timeline">
          {items.map((l, i) => (
            <div key={l.lessonId} style={{ display: 'contents' }}>
              {i === nowIdx && (
                <div className="now-line" aria-label="Сейчас">
                  <span className="num">{fmtTime(state.now)}</span>
                  <i />
                </div>
              )}
              <div className="tl-item">
                <span className="tl-time num">{fmtTime(l.startsAt)}</span>
                <div className={`tl-card${l.kind === 'TRIAL' ? ' trial' : ''}${l.endsAt < state.now ? ' past' : ''}`}>
                  <b>{l.studentName}</b>
                  <span>
                    {l.kind === 'TRIAL' ? 'Пробный · ' : ''}
                    {l.subjectName} · {l.teacherName}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-dark" style={{ width: '100%', marginTop: 14 }} onClick={() => navigate('/manager/schedule')}>
        Открыть расписание
      </button>
    </section>
  );
}
