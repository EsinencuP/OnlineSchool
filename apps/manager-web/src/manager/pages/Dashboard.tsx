import { ArrowUpRight, Video, VideoOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AttentionItem, DailyColumns, HBarList, KpiCard } from '../../shared/analytics';
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

/**
 * Manager workspace. Question: "What do I have to do now?" — the attention queue leads,
 * KPIs give context and each one opens the records behind it.
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
  const pendingTotal = d.pendingPayments.totalsByCurrency.map((t) => fmtMoney(t.amount, t.currency)).join(' · ');
  const notSent = state.payments.filter((p) => p.status === 'PENDING');
  const rejected = state.payments.filter((p) => p.status === 'REJECTED');
  const created30 = state.leads.filter((l) => now - new Date(l.createdAt).getTime() < 30 * D);
  const converted30 = created30.filter((l) => l.stage === 'CONVERTED').length;
  const noLink = d.upcomingLessons.filter((l) => !l.hasMeetLink);
  const stages = ['NEW', 'IN_PROGRESS', 'TRIAL', 'AWAITING_PAYMENT'] as const;

  // Daily series come from the lead records themselves (createdAt / stageChangedAt), in school time.
  const days = Array.from({ length: 14 }, (_, k) => dayKey(new Date(now - (13 - k) * D).toISOString()));
  const createdByDay = days.map((k) => state.leads.filter((l) => dayKey(l.createdAt) === k).length);
  const convertedByDay = days.map((k) => state.leads.filter((l) => l.stage === 'CONVERTED' && dayKey(l.stageChangedAt) === k).length);

  const critical = openTasks.filter((t) => t.isOverdue).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const attention = [
    ...critical.slice(0, 4).map((t) => ({
      key: `t-${t.taskId}`,
      tone: 'problem' as const,
      title: `${t.studentName} · ${taskType[t.type].label}`,
      meta: `просрочена ${relative(t.dueAt, state.now).replace(' назад', '')}`,
      to: `/manager/tasks?task=${t.taskId}`,
      action: 'Открыть задачу',
    })),
    ...noLink.map((l) => ({
      key: `l-${l.lessonId}`,
      tone: 'problem' as const,
      title: `${l.studentName} · урок без ссылки на встречу`,
      meta: `${fmtDay(l.startsAt)}, ${fmtTime(l.startsAt)} · ${l.teacherName}`,
      to: `/manager/schedule?lesson=${l.lessonId}`,
      action: 'К уроку',
    })),
    ...rejected.map((p) => ({
      key: `r-${p.id}`,
      tone: 'warn' as const,
      title: `${p.studentName} · оплата отклонена директором`,
      meta: p.rejectionReason ?? fmtMoney(p.amount, p.currency),
      to: '/manager/payments',
      action: 'К платежу',
    })),
    ...notSent.map((p) => ({
      key: `p-${p.id}`,
      tone: 'warn' as const,
      title: `${p.studentName} · платёж не отправлен на подтверждение`,
      meta: fmtMoney(p.amount, p.currency),
      to: '/manager/payments',
      action: 'Отправить',
    })),
    ...d.expiringSubscriptions
      .filter((s) => s.remainingLessons <= 2)
      .map((s) => ({
        key: `s-${s.subscriptionId}`,
        tone: 'info' as const,
        title: `${s.studentName} · абонемент заканчивается`,
        meta: `${s.remainingLessons} ${plural(s.remainingLessons, 'занятие', 'занятия', 'занятий')} · до ${fmtDay(s.endsAt)}`,
        to: `/manager/students?id=${s.studentId}`,
        action: 'Продлить',
      })),
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="page-head">
        <div>
          <h1>
            {greeting(state.now)}, {firstName}
          </h1>
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

      <div className="kpis" aria-label="Ключевые показатели портфеля">
        <KpiCard label="Просроченные задачи" value={d.overdueTasks.count} context={`из ${openTasks.length} открытых`} tone={d.overdueTasks.count ? 'problem' : 'ok'} to="/manager/tasks?filter=overdue" />
        <KpiCard label="Новые заявки" value={d.leads.countsByStage.NEW} context={`+${d.leads.createdToday} сегодня · ${d.leads.overdueFollowups} без контакта в срок`} tone={d.leads.overdueFollowups ? 'warn' : 'neutral'} to="/manager/leads" />
        <KpiCard label="Конверсия в учеников" value={created30.length ? `${(d.leads.conversion30dBp / 100).toFixed(0)}%` : '—'} context={`${converted30} из ${created30.length} заявок за 30 дней`} to="/manager/leads?view=closed" />
        <KpiCard label="Платежи в работе" value={d.pendingPayments.count} context={pendingTotal || 'нет'} to="/manager/payments" />
        <KpiCard label="Долги учеников" value={debtors.length ? fmtMoney(debtTotal, debtors[0]!.balanceCurrency) : '—'} context={`${debtors.length} ${plural(debtors.length, 'ученик', 'ученика', 'учеников')} с минусом`} tone={debtors.length ? 'problem' : 'ok'} to="/manager/students?status=DEBT" />
      </div>

      <div className="dash">
        <div className="dash-main">
          <section className="card" aria-labelledby="h-attn">
            <div className="card-head">
              <h3 id="h-attn">Требует внимания</h3>
              <Badge tone={attention.length ? 'coral' : 'teal'}>{attention.length}</Badge>
              {d.priority && d.priority.criticalCount > 0 && (
                <span className="right section-note">срочную задачу нужно принять за 10 минут</span>
              )}
            </div>
            {attention.length === 0 ? (
              <Empty title="Всё под контролем" text="Просрочек, уроков без ссылки и зависших платежей нет." />
            ) : (
              <ul className="attn-list">
                {(showAll ? attention : attention.slice(0, 6)).map(({ key, ...a }) => (
                  <AttentionItem key={key} {...a} />
                ))}
              </ul>
            )}
            {attention.length > 6 && (
              <button type="button" className="link" style={{ marginTop: 10 }} onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Свернуть' : `Показать все · ${attention.length}`}
              </button>
            )}
          </section>

          <div className="two-col">
            <section className="card" aria-labelledby="h-funnel">
              <div className="card-head">
                <h3 id="h-funnel">Заявки по стадиям</h3>
                <span className="right section-note">сейчас</span>
              </div>
              <HBarList
                label="Открытые заявки по стадиям"
                rows={stages.map((s) => ({
                  key: s,
                  label: leadStage[s].label,
                  value: d.leads.countsByStage[s],
                  to: '/manager/leads',
                }))}
              />
            </section>
            <section className="card" aria-labelledby="h-daily">
              <div className="card-head">
                <h3 id="h-daily">Заявки по дням</h3>
                <span className="right section-note">14 дней</span>
              </div>
              <DailyColumns
                days={days}
                label="Новые заявки и переходы в ученики по дням за 14 дней"
                series={[
                  { name: 'Новые', color: 'var(--c-prev)', values: createdByDay },
                  { name: 'Стали учениками', color: 'var(--c-people)', values: convertedByDay },
                ]}
              />
            </section>
          </div>

          <div className="two-col">
            <section className="card" aria-labelledby="h-exp">
              <div className="card-head">
                <h3 id="h-exp">Абонементы заканчиваются</h3>
                <span className="right section-note">7 дней</span>
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
                <h3 id="h-upcoming">Ближайшие уроки</h3>
                <span className="right section-note">48 часов</span>
              </div>
              {d.upcomingLessons.length === 0 ? (
                <Empty title="Уроков в ближайшие 48 часов нет" />
              ) : (
                <div className="list">
                  {d.upcomingLessons.slice(0, 6).map((l) => (
                    <button key={l.lessonId} type="button" className="row-item" onClick={() => navigate(`/manager/schedule?lesson=${l.lessonId}`)}>
                      <span className="time-pill num">{fmtTime(l.startsAt)}</span>
                      <span className="grow">
                        <span className="title">{l.studentName}</span>
                        <span className="sub">
                          {fmtDay(l.startsAt)} · {l.teacherName}
                        </span>
                      </span>
                      {l.hasMeetLink ? (
                        <span className="muted" aria-label="Ссылка на встречу есть"><Video size={14} /></span>
                      ) : (
                        <Badge tone="coral">
                          <VideoOff size={13} /> Нет ссылки
                        </Badge>
                      )}
                    </button>
                  ))}
                  {d.upcomingLessons.length > 6 && (
                    <button type="button" className="link" style={{ justifySelf: 'start' }} onClick={() => navigate('/manager/schedule')}>
                      Ещё {d.upcomingLessons.length - 6} в расписании
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
      <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => navigate('/manager/schedule?view=day')}>
        Расписание на день
      </button>
    </section>
  );
}
