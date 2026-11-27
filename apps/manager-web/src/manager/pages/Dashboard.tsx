import { ArrowUpRight, Video, VideoOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AttentionItem, TileShape } from '../../shared/analytics';
import { Chart } from '../../shared/Chart';
import { MiniCalendar } from '../../shared/MiniCalendar';
import { Avatar, Badge, Empty } from '../../shared/ui';
import { selectDashboard } from '../logic';
import { useManager } from '../store';
import { dayKey, fmtDay, fmtMoney, fmtTime, plural, relative } from '../../shared/format';
import { leadStage, taskType } from '../labels';

const D = 24 * 3600_000;

function greeting(iso: string) {
  const h = Number(fmtTime(iso).slice(0, 2));
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

const dayLabel = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'short' }).replace('.', '');

/**
 * Manager home. Question: "What do I have to do now, and how is my funnel doing?"
 * Coloured v1 tiles (colour = kind of metric), precise numbers from the records,
 * every number links to the list behind it.
 */
export function Dashboard() {
  const { state } = useManager();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const d = useMemo(() => selectDashboard(state), [state]);
  const firstName = state.me.displayName.split(' ')[0];
  const now = new Date(state.now).getTime();

  const openTasks = state.tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const debtors = state.students.filter((s) => s.balance.startsWith('-'));
  const debtTotal = (-debtors.reduce((a, s) => a + Number(s.balance), 0)).toFixed(2);
  const pendingTotal = d.pendingPayments.totalsByCurrency.map((t) => fmtMoney(t.amount, t.currency)).join(' · ') || '0 лей';
  const notSent = state.payments.filter((p) => p.status === 'PENDING');
  const atDirector = state.payments.filter((p) => p.status === 'AWAITING_APPROVAL');
  const rejected = state.payments.filter((p) => p.status === 'REJECTED');
  const noLink = d.upcomingLessons.filter((l) => !l.hasMeetLink);
  const stages = ['NEW', 'IN_PROGRESS', 'TRIAL', 'AWAITING_PAYMENT'] as const;
  const openLeads = stages.reduce((a, s) => a + d.leads.countsByStage[s], 0);
  const stageMax = Math.max(1, ...stages.map((x) => d.leads.countsByStage[x]));

  // 30-day cohort from the lead records (school days). "Стали учениками" counts leads created
  // that day that are CONVERTED now, so the last cumulative point equals the 30-day KPI.
  const days = Array.from({ length: 30 }, (_, k) => dayKey(new Date(now - (29 - k) * D).toISOString()));
  const inWindow = state.leads.filter((l) => now - new Date(l.createdAt).getTime() < 30 * D);
  const created = days.map((k) => inWindow.filter((l) => dayKey(l.createdAt) === k).length);
  const converted = days.map((k) => inWindow.filter((l) => dayKey(l.createdAt) === k && l.stage === 'CONVERTED').length);
  const cum = (arr: number[], i: number) => arr.slice(0, i + 1).reduce((a, b) => a + b, 0);
  const wonTotal = cum(converted, 29);
  const conv30 = inWindow.length ? Math.round((wonTotal / inWindow.length) * 100) : null;

  const critical = openTasks.filter((t) => t.isOverdue).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const attention = [
    ...critical.map((t) => ({ key: `t-${t.taskId}`, tone: 'problem' as const, title: `${t.studentName} · ${taskType[t.type].label}`, meta: `просрочена ${relative(t.dueAt, state.now).replace(' назад', '')}`, to: `/manager/tasks?task=${t.taskId}`, action: 'Открыть задачу' })),
    ...noLink.map((l) => ({ key: `l-${l.lessonId}`, tone: 'problem' as const, title: `${l.studentName} · урок без ссылки на встречу`, meta: `${fmtDay(l.startsAt)}, ${fmtTime(l.startsAt)} · ${l.teacherName}`, to: `/manager/schedule?lesson=${l.lessonId}`, action: 'К уроку' })),
    ...rejected.map((p) => ({ key: `r-${p.id}`, tone: 'warn' as const, title: `${p.studentName} · оплата отклонена директором`, meta: p.rejectionReason ?? fmtMoney(p.amount, p.currency), to: '/manager/payments', action: 'К платежу' })),
    ...notSent.map((p) => ({ key: `p-${p.id}`, tone: 'warn' as const, title: `${p.studentName} · платёж не отправлен на подтверждение`, meta: fmtMoney(p.amount, p.currency), to: '/manager/payments', action: 'Отправить' })),
    ...d.expiringSubscriptions.filter((s) => s.remainingLessons <= 2).map((s) => ({ key: `s-${s.subscriptionId}`, tone: 'info' as const, title: `${s.studentName} · абонемент заканчивается`, meta: `${s.remainingLessons} ${plural(s.remainingLessons, 'занятие', 'занятия', 'занятий')} · до ${fmtDay(s.endsAt)}`, to: `/manager/students?id=${s.studentId}`, action: 'Продлить' })),
  ];

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div className="page-head">
        <div>
          <h1>
            {greeting(state.now)}, {firstName}
          </h1>
          <p>
            {d.overdueTasks.count} {plural(d.overdueTasks.count, 'просроченная задача', 'просроченные задачи', 'просроченных задач')} из {openTasks.length} открытых, {d.leads.countsByStage.NEW}{' '}
            {plural(d.leads.countsByStage.NEW, 'новая заявка', 'новые заявки', 'новых заявок')} и {d.pendingPayments.count} {plural(d.pendingPayments.count, 'платёж', 'платежа', 'платежей')} в работе.
          </p>
          <span className="stale">Данные на {fmtTime(state.now)}</span>
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

      <div className="dash">
        <div className="dash-main">
          <div className="tiles">
            <section className="tile tile-yellow" aria-labelledby="t-leads">
              <TileShape color="yellow" />
              <h3 id="t-leads">Заявки в воронке</h3>
              <div className="metric-row">
                <Link to="/manager/leads" className="metric metric-link">
                  <b className="num">{openLeads}</b>
                  <span>открытых</span>
                </Link>
                <Link to="/manager/leads?overdue=1" className="metric metric-link">
                  <b className={`num${d.leads.overdueFollowups ? ' neg' : ''}`}>{d.leads.overdueFollowups}</b>
                  <span>без контакта в срок</span>
                </Link>
                <div className="metric">
                  <b className="num">+{d.leads.createdToday}</b>
                  <span>сегодня</span>
                </div>
              </div>
              <ul className="stage-bars" aria-label="Открытые заявки по стадиям, сейчас">
                {stages.map((s) => {
                  const v = d.leads.countsByStage[s];
                  return (
                    <li key={s}>
                      <Link to="/manager/leads" className="stage-bar">
                        <span>{leadStage[s].label}</span>
                        <span className="stage-track">
                          <i style={{ width: `${(v / stageMax) * 100}%` }} />
                        </span>
                        <b className="num">{v}</b>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="tile tile-coral" aria-labelledby="t-conv">
              <TileShape color="coral" />
              <h3 id="t-conv">Конверсия за 30 дней</h3>
              <div className="metric-row">
                <Link to="/manager/leads?view=closed" className="metric metric-link">
                  <b className="num">{conv30 === null ? '—' : `${conv30}%`}</b>
                  <span>в учеников</span>
                </Link>
                <div className="metric">
                  <b className="num">{inWindow.length}</b>
                  <span>заявок за 30 дней</span>
                </div>
                <div className="metric">
                  <b className="num">{wonTotal}</b>
                  <span>стали учениками</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 10, position: 'relative' }}>
                <Chart
                  label="Новые заявки по дням за 30 дней и сколько из них стали учениками"
                  height={170}
                  labels={days.map(dayLabel)}
                  tipTitle={(i) => new Date(`${days[i]}T12:00:00Z`).toLocaleDateString('ru-RU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long' })}
                  series={[
                    { key: 'new', name: 'Новые заявки', color: 'rgb(13 26 56 / 30%)', type: 'bar', values: created },
                    { key: 'won', name: 'Из них стали учениками', color: 'var(--ink)', type: 'bar', values: converted },
                  ]}
                  extra={(i) => {
                    const c = cum(created, i);
                    const w = cum(converted, i);
                    return `С начала периода: ${w} из ${c}${c ? ` · ${Math.round((w / c) * 100)}%` : ''}`;
                  }}
                />
              </div>
            </section>
          </div>

          <div className="tiles-2">
            <section className="tile tile-teal" style={{ minHeight: 150 }} aria-labelledby="t-st">
              <TileShape color="teal" />
              <h3 id="t-st">Портфель учеников</h3>
              <div className="metric-row">
                <Link to="/manager/students?status=ACTIVE" className="metric metric-link">
                  <b className="num">{d.students.active}</b>
                  <span>учатся</span>
                </Link>
                <Link to="/manager/students?status=FROZEN" className="metric metric-link">
                  <b className="num">{d.students.frozen}</b>
                  <span>заморожены</span>
                </Link>
                <Link to="/manager/students?status=DEBT" className="metric metric-link">
                  <b className={`num${debtors.length ? ' neg' : ''}`}>{debtors.length ? fmtMoney(debtTotal, debtors[0]!.balanceCurrency) : '0'}</b>
                  <span>
                    долг · {debtors.length} {plural(debtors.length, 'ученик', 'ученика', 'учеников')}
                  </span>
                </Link>
              </div>
            </section>
            <section className="tile tile-blue" style={{ minHeight: 150 }} aria-labelledby="t-pay">
              <TileShape color="blue" />
              <h3 id="t-pay">Платежи в работе</h3>
              <div className="metric-row">
                <Link to="/manager/payments" className="metric metric-link">
                  <b className="num">{pendingTotal}</b>
                  <span>
                    {d.pendingPayments.count} {plural(d.pendingPayments.count, 'платёж', 'платежа', 'платежей')}
                  </span>
                </Link>
                <div className="metric">
                  <b className="num">{notSent.length}</b>
                  <span>не отправлены</span>
                </div>
                <div className="metric">
                  <b className="num">{atDirector.length}</b>
                  <span>у директора</span>
                </div>
              </div>
            </section>
          </div>

          <section className="card" aria-labelledby="h-attn">
            <div className="card-head">
              <h3 id="h-attn">Требует внимания</h3>
              <Badge tone={attention.length ? 'coral' : 'teal'}>{attention.length}</Badge>
              {d.priority && d.priority.criticalCount > 0 && <span className="right section-note">срочную задачу нужно принять за 10 минут</span>}
            </div>
            {attention.length === 0 ? (
              <Empty title="Всё под контролем" text="Просрочек, уроков без ссылки и зависших платежей нет." />
            ) : (
              <ul className="attn-list">
                {(showAll ? attention : attention.slice(0, 5)).map(({ key, ...a }) => (
                  <AttentionItem key={key} {...a} />
                ))}
              </ul>
            )}
            {attention.length > 5 && (
              <button type="button" className="link" style={{ marginTop: 12 }} onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Свернуть' : `Показать все · ${attention.length}`}
              </button>
            )}
          </section>

          <div className="two-col">
            <section className="card" aria-labelledby="h-exp">
              <div className="card-head">
                <h3 id="h-exp">Абонементы заканчиваются</h3>
                <span className="right muted">7 дней</span>
              </div>
              {d.expiringSubscriptions.length === 0 ? (
                <Empty title="Нет истекающих абонементов" />
              ) : (
                <div className="list">
                  {d.expiringSubscriptions.map((s) => {
                    const total = state.subscriptions.find((x) => x.id === s.subscriptionId)?.totalLessons ?? null;
                    return (
                      <button key={s.subscriptionId} type="button" className="row-item" onClick={() => navigate(`/manager/students?id=${s.studentId}`)}>
                        <Avatar name={s.studentName} />
                        <span className="grow">
                          <span className="title">{s.studentName}</span>
                          <span className="sub">
                            <b className={s.remainingLessons <= 2 ? 'neg' : undefined}>{s.remainingLessons}</b>
                            {total ? ` из ${total}` : ''} {plural(s.remainingLessons, 'занятие', 'занятия', 'занятий')} · до {fmtDay(s.endsAt)}
                          </span>
                        </span>
                        <span className="time-pill">{relative(s.endsAt, state.now)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="h-upcoming">
              <div className="card-head">
                <h3 id="h-upcoming">Ближайшие уроки · 48 часов</h3>
              </div>
              {d.upcomingLessons.length === 0 ? (
                <Empty title="Уроков в ближайшие 48 часов нет" />
              ) : (
                <div className="list">
                  {d.upcomingLessons.slice(0, 5).map((l) => (
                    <button key={l.lessonId} type="button" className="row-item" onClick={() => navigate(`/manager/schedule?lesson=${l.lessonId}`)}>
                      <span className="time-pill num">{fmtTime(l.startsAt)}</span>
                      <span className="grow">
                        <span className="title">{l.studentName}</span>
                        <span className="sub">
                          {fmtDay(l.startsAt)} · {l.teacherName}
                        </span>
                      </span>
                      {l.hasMeetLink ? (
                        <Badge tone="teal">
                          <Video size={13} /> Ссылка
                        </Badge>
                      ) : (
                        <Badge tone="coral">
                          <VideoOff size={13} /> Нет ссылки
                        </Badge>
                      )}
                    </button>
                  ))}
                  {d.upcomingLessons.length > 5 && (
                    <button type="button" className="link" style={{ justifySelf: 'start' }} onClick={() => navigate('/manager/schedule')}>
                      Ещё {d.upcomingLessons.length - 5} в расписании
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
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
  const items = state.lessons.filter((l) => dayKey(l.startsAt) === todayKey && l.status !== 'CANCELLED').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const nowIdx = items.findIndex((l) => l.startsAt > state.now);

  return (
    <section className="card" aria-labelledby="h-today">
      <div className="card-head">
        <h3 id="h-today">Сегодня</h3>
        <span className="right muted">
          {items.length} {plural(items.length, 'урок', 'урока', 'уроков')}
        </span>
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
              <button type="button" className="tl-item tl-btn" onClick={() => navigate(`/manager/schedule?lesson=${l.lessonId}`)}>
                <span className="tl-time num">{fmtTime(l.startsAt)}</span>
                <span className={`tl-card${l.kind === 'TRIAL' ? ' trial' : ''}${l.endsAt < state.now ? ' past' : ''}`}>
                  <b>{l.studentName}</b>
                  <span>
                    {l.kind === 'TRIAL' ? 'Пробный · ' : ''}
                    {l.subjectName} · {l.teacherName}
                  </span>
                </span>
              </button>
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
