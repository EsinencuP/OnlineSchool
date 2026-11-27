import { Download, Info, Share2, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HBarList, TileShape } from '../../shared/analytics';
import { Chart } from '../../shared/Chart';
import { dayKey, fmtDateTime, fmtDay, fmtMoney, relative } from '../../shared/format';
import { Avatar, Badge, Empty, Notice, Panel } from '../../shared/ui';
import { selectPayrollTotals, selectRate } from '../logic';
import { RATE_TABLE } from '../seed';
import { useTeacher } from '../store';
import type { Checkpoint, HomeworkItem } from '../types';

export const HW_STATE: Record<HomeworkItem['state'], { label: string; tone: 'blue' | 'yellow' | 'coral' | 'teal' | 'neutral' }> = {
  NOT_SUBMITTED: { label: 'Не сдано', tone: 'blue' },
  AWAITING_REVIEW: { label: 'Ждёт проверки', tone: 'yellow' },
  NEEDS_REVISION: { label: 'На доработке', tone: 'coral' },
  REVIEWED: { label: 'Принято', tone: 'teal' },
  CANCELLED: { label: 'Отменено', tone: 'neutral' },
};

export function TeacherHomework() {
  const { state } = useTeacher();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<HomeworkItem['state'] | 'ALL'>('AWAITING_REVIEW');
  const selected = state.homework.find((h) => h.deliveryId === params.get('id')) ?? null;
  const rows = state.homework.filter((h) => tab === 'ALL' || h.state === tab);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Задания</h1>
          <p>Сданную работу проверьте до следующего урока ученика. Ошибки можно разобрать прямо на уроке.</p>
        </div>
      </div>
      <div className="chips" role="group" aria-label="Статус">
        {(['AWAITING_REVIEW', 'NOT_SUBMITTED', 'NEEDS_REVISION', 'REVIEWED', 'ALL'] as const).map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={tab === s} onClick={() => setTab(s)}>
            {s === 'ALL' ? 'Все' : HW_STATE[s].label} <span className="n">{s === 'ALL' ? state.homework.length : state.homework.filter((h) => h.state === s).length}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? <section className="card"><Empty title="Пусто" text="Новых работ на проверку нет." /></section> : (
        <div className="list" style={{ gap: 10 }}>
          {rows.map((h) => {
            const next = state.lessons.find((l) => l.studentId === h.studentId && l.status === 'SCHEDULED' && l.startsAt > state.now);
            return (
              <button key={h.deliveryId} type="button" className="row-item card" style={{ padding: 16, borderRadius: 20 }} onClick={() => setParams({ id: h.deliveryId })}>
                <Avatar name={h.studentName} />
                <span className="grow">
                  <span className="title">{h.title}</span>
                  <span className="sub">{h.studentName} · выдано {fmtDay(h.issuedAt)}{h.dueAt ? ` · срок ${fmtDay(h.dueAt)}` : ''}</span>
                </span>
                {h.state === 'AWAITING_REVIEW' && next && <span className="time-pill">урок {relative(next.startsAt, state.now)}</span>}
                {h.isLate && <Badge tone="coral">Просрочено</Badge>}
                <Badge tone={HW_STATE[h.state].tone}>{HW_STATE[h.state].label}</Badge>
              </button>
            );
          })}
        </div>
      )}
      {selected && <ReviewPanel h={selected} onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}

function ReviewPanel({ h, onClose }: { h: HomeworkItem; onClose: () => void }) {
  const { run } = useTeacher();
  const [comment, setComment] = useState('');
  const submit = (result: 'ACCEPTED' | 'NEEDS_REVISION') => {
    if (run({ type: 'homework.review', deliveryId: h.deliveryId, result, comment }).ok) onClose();
  };
  return (
    <Panel title={h.title} onClose={onClose}>
      <div className="chips"><Badge tone={HW_STATE[h.state].tone}>{HW_STATE[h.state].label}</Badge><Badge tone="neutral">{h.studentName}</Badge></div>
      <section className="card">
        <dl className="kv"><dt>Выдано</dt><dd>{fmtDateTime(h.issuedAt)}</dd><dt>Срок</dt><dd>{h.dueAt ? fmtDateTime(h.dueAt) : 'без срока'}</dd><dt>Сдач</dt><dd>{h.submissionCount}</dd></dl>
        <p style={{ marginTop: 10 }}>{h.description}</p>
      </section>
      {h.answer && (
        <section className="card">
          <div className="card-head"><h3>Ответ ученика</h3><span className="right muted" style={{ fontSize: 12 }}>{h.latestSubmittedAt ? fmtDateTime(h.latestSubmittedAt) : ''}</span></div>
          <p style={{ whiteSpace: 'pre-wrap' }}>{h.answer}</p>
        </section>
      )}
      {h.reviews.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>История проверок</h3></div>
          {h.reviews.map((r) => (
            <div key={r.reviewId} className={`version ${r.result === 'ACCEPTED' ? 'ok' : 'needs'}`} style={{ marginBottom: 8 }}>
              <b>{r.result === 'ACCEPTED' ? 'Принято' : 'На доработку'} · {fmtDateTime(r.reviewedAt)}</b>
              {r.comment && <span style={{ fontSize: 13 }}>{r.comment}</span>}
            </div>
          ))}
        </section>
      )}
      {h.state === 'AWAITING_REVIEW' && (
        <section className="card" style={{ display: 'grid', gap: 12 }}>
          <div className="field">
            <label htmlFor="rv">Комментарий ученику</label>
            <textarea id="rv" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Обязателен, если работа уходит на доработку" />
          </div>
          <div className="chips">
            <button type="button" className="btn btn-dark" onClick={() => submit('ACCEPTED')}>Принять</button>
            <button type="button" className="btn btn-danger" onClick={() => submit('NEEDS_REVISION')}>На доработку</button>
          </div>
        </section>
      )}
    </Panel>
  );
}

export function TeacherCheckpoints() {
  const { state, run } = useTeacher();
  const [open, setOpen] = useState<Checkpoint | null>(null);
  const pending = state.checkpoints.filter((c) => c.state === 'PENDING');
  const done = state.checkpoints.filter((c) => c.state === 'COMPLETED');
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Контрольные точки</h1>
          <p>Каждые 4 подтверждённых урока — пересмотр навыков, каждые 8 — структурированный отчёт для ученика и семьи. Сроки контролирует CRM, при задержке — напоминание менеджеру.</p>
        </div>
      </div>
      <div className="grid-3">
        {pending.length === 0 && <section className="card" style={{ gridColumn: '1 / -1' }}><Empty title="Всё закрыто" /></section>}
        {pending.map((c) => (
          <section key={c.checkpointId} className={`tile ${c.type === 'LESSON_8' ? 'tile-violet' : 'tile-yellow'}`}>
            <Badge tone={c.type === 'LESSON_8' ? 'violet' : 'yellow'}>{c.type === 'LESSON_8' ? 'Отчёт за 8 уроков' : 'Пересмотр навыков'}</Badge>
            <h3 style={{ marginTop: 12 }}>{c.studentName}</h3>
            <span className="muted" style={{ fontSize: 13 }}>{c.subjectName} · подтверждено {c.confirmedLessonCount} уроков · с {fmtDay(c.triggeredAt)}</span>
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              {c.type === 'LESSON_4' ? (
                <button type="button" className="btn btn-dark btn-sm" onClick={() => run({ type: 'checkpoint.complete', checkpointId: c.checkpointId })}>Навыки пересмотрены</button>
              ) : (
                <button type="button" className="btn btn-dark btn-sm" onClick={() => setOpen(c)}>Составить отчёт</button>
              )}
            </div>
          </section>
        ))}
      </div>
      {done.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>Закрытые</h3></div>
          <div className="list">
            {done.map((c) => (
              <div key={c.checkpointId} className="row-item">
                <Avatar name={c.studentName} />
                <span className="grow"><span className="title">{c.studentName}</span><span className="sub">{c.type === 'LESSON_8' ? 'Отчёт опубликован' : 'Навыки пересмотрены'} · {c.completedAt ? fmtDateTime(c.completedAt) : ''}</span></span>
                <Badge tone="teal">Готово</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
      {open && <ReportDialog c={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ReportDialog({ c, onClose }: { c: Checkpoint; onClose: () => void }) {
  const { state, run } = useTeacher();
  const [form, setForm] = useState({ achievements: '', growthAreas: '', recommendations: '' });
  const skills = state.skills[c.enrollmentId] ?? [];
  return (
    <Panel title={`Отчёт: ${c.studentName}`} onClose={onClose}>
      <Notice tone="blue" icon={<Info size={16} />}>
        Сейчас «Применяю»: {skills.filter((s) => s.status === 'APPLYING').map((s) => s.name).join(', ') || 'нет'}. «Практикую»: {skills.filter((s) => s.status === 'PRACTICING').map((s) => s.name).join(', ') || 'нет'}.
      </Notice>
      <form style={{ display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); if (run({ type: 'checkpoint.publish', checkpointId: c.checkpointId, content: { ...form, teacherSignature: state.me.displayName } }).ok) onClose(); }}>
        {([['achievements', 'Достижения'], ['growthAreas', 'Что подтянуть'], ['recommendations', 'Рекомендации и следующие шаги']] as const).map(([k, label]) => (
          <div key={k} className="field">
            <label htmlFor={`rp-${k}`}>{label}</label>
            <textarea id={`rp-${k}`} rows={3} required minLength={10} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
        <p className="muted" style={{ fontSize: 12 }}>Отчёт заверяется вашим именем. Исправления после публикации фиксируются в техническом журнале.</p>
        <button type="submit" className="btn btn-dark">Опубликовать ученику</button>
      </form>
    </Panel>
  );
}

export function TeacherMaterials() {
  const { state, run } = useTeacher();
  const [shareFor, setShareFor] = useState<string | null>(null);
  const file = state.materials.find((m) => m.fileId === shareFor) ?? null;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Материалы</h1>
          <p>Файлы хранятся в защищённом хранилище академии. Ученик видит только то, что вы ему открыли; доступ можно отозвать.</p>
        </div>
      </div>
      <section className="card">
        <div className="list">
          {state.materials.map((m) => (
            <div key={m.fileId} className="file-row">
              <span className={`file-ico tone-${m.mimeType.includes('pdf') ? 'coral' : m.mimeType.includes('sheet') ? 'teal' : 'blue'}`}>{m.mimeType.includes('pdf') ? 'PDF' : m.mimeType.includes('sheet') ? 'XLS' : 'DOC'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fileName}</b>
                <span className="muted" style={{ fontSize: 12 }}>{(m.sizeBytes / 1_048_576).toFixed(1)} МБ · {fmtDay(m.createdAt)} · открыт {m.activeGrants} {m.activeGrants === 1 ? 'ученику' : 'ученикам'}</span>
              </span>
              {m.status === 'PENDING' ? <Badge tone="yellow">Проверяется</Badge> : <Badge tone="teal">Готов</Badge>}
              <button type="button" className="btn btn-ghost btn-sm" disabled={m.status !== 'VERIFIED'} onClick={() => setShareFor(m.fileId)}><Share2 size={14} /> Доступ</button>
              <button type="button" className="icon-btn" aria-label={`Скачать ${m.fileName}`}><Download size={16} /></button>
            </div>
          ))}
        </div>
      </section>
      {file && (
        <Panel title={file.fileName} variant="modal" onClose={() => setShareFor(null)}>
          <div className="list">
            {state.enrollments.map((e) => {
              const has = file.grantedTo.includes(e.studentId);
              return (
                <div key={e.enrollmentId} className="row-item">
                  <Avatar name={e.studentName} />
                  <span className="grow"><span className="title">{e.studentName}</span></span>
                  {has ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => run({ type: 'material.unshare', fileId: file.fileId, studentId: e.studentId })}><X size={14} /> Закрыть</button>
                  ) : (
                    <button type="button" className="btn btn-dark btn-sm" onClick={() => run({ type: 'material.share', fileId: file.fileId, studentId: e.studentId })}>Открыть</button>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

const PAY_STATUS = {
  PENDING_ACCRUAL: { label: 'Ожидает начисления', tone: 'yellow' },
  ACCRUED: { label: 'Начислено', tone: 'blue' },
  PARTIALLY_PAID: { label: 'Частично выплачено', tone: 'violet' },
  PAID: { label: 'Выплачено', tone: 'teal' },
  NO_PAYMENT: { label: 'Без оплаты', tone: 'neutral' },
} as const;

export function TeacherPayroll() {
  const { state } = useTeacher();
  const t = selectPayrollTotals(state.payroll.lines);
  const r = selectRate(state);
  const month = new Date(`${state.payroll.month}-01T12:00:00`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Начисления</h1>
          <p>Детальная ведомость за {month}. Ставка фиксируется на момент фактического начала урока. Спор по конкретному уроку направляется менеджеру, решение утверждает руководитель.</p>
        </div>
      </div>
      <div className="grid-4">
        <section className="tile tile-teal" style={{ minHeight: 120 }}><TileShape color="teal" /><span style={{ fontWeight: 600, position: 'relative' }}>Начислено</span><span className="big-num num" style={{ fontSize: 26, marginTop: 'auto', position: 'relative' }}>{fmtMoney(t.accrued, 'MDL')}</span></section>
        <section className="tile tile-blue" style={{ minHeight: 120 }}><TileShape color="blue" /><span style={{ fontWeight: 600, position: 'relative' }}>Выплачено</span><span className="big-num num" style={{ fontSize: 26, marginTop: 'auto', position: 'relative' }}>{fmtMoney(t.paid, 'MDL')}</span></section>
        <section className="tile tile-yellow" style={{ minHeight: 120 }}><TileShape color="yellow" /><span style={{ fontWeight: 600, position: 'relative' }}>К выплате</span><span className="big-num num" style={{ fontSize: 26, marginTop: 'auto', position: 'relative' }}>{fmtMoney(t.outstanding, 'MDL')}</span></section>
        <section className="tile tile-violet" style={{ minHeight: 120 }}><TileShape color="violet" /><span style={{ fontWeight: 600, position: 'relative' }}>Ожидает начисления</span><span className="big-num num" style={{ fontSize: 26, marginTop: 'auto', position: 'relative' }}>{fmtMoney(t.pendingAccrual, 'MDL')}</span></section>
      </div>

      <PayrollAnalytics />

      <section className="card" aria-labelledby="h-rate">
        <div className="card-head"><h3 id="h-rate">Текущая ставка: {fmtMoney(r.rate, 'MDL')} за урок</h3></div>
        <div className="two-col">
          <dl className="kv">
            <dt>Стаж</dt><dd>{state.me.seniorityMonths} мес. → <b>{r.seniority}</b> из 6 очков</dd>
            <dt>Активные ученики</dt><dd>{r.active} → <b>{r.students}</b> из 4 очков</dd>
            <dt>Итого очков</dt><dd><b>{r.points}</b> из 10</dd>
          </dl>
          <div className="list">
            {RATE_TABLE.map((row, i) => {
              const from = i === 0 ? 0 : RATE_TABLE[i - 1]!.maxPoints + 1;
              const active = r.points >= from && r.points <= row.maxPoints;
              return (
                <div key={row.rate} className="row-item" style={active ? { background: 'var(--accent-tint)' } : undefined}>
                  <span className="grow"><span className="title">{from}–{row.maxPoints} очков</span></span>
                  <b className="num">{fmtMoney(row.rate, 'MDL')}</b>
                  {active && <Badge tone="teal">ваша</Badge>}
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="card" style={{ padding: 14 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Урок</th><th>Ученик</th><th>Основание</th><th className="r">Сумма</th><th>Статус</th></tr></thead>
            <tbody>
              {state.payroll.lines.map((l) => (
                <tr key={l.outcomeId} style={{ cursor: 'default' }}>
                  <td className="num">{fmtDateTime(l.lessonStartedAt)}</td>
                  <td>{l.studentName}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{l.rateBasis}</td>
                  <td className="num r" style={{ fontWeight: 600 }}>{fmtMoney(l.amount, l.currency)}</td>
                  <td><Badge tone={PAY_STATUS[l.status].tone}>{PAY_STATUS[l.status].label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const GOAL_KEY = 'teacher.payroll.goal';
const readGoal = () => {
  try {
    const v = Number(window.localStorage.getItem(GOAL_KEY));
    return Number.isFinite(v) && v > 0 ? v : 12000;
  } catch {
    return 12000;
  }
};
const monthName = (m: string, opts: Intl.DateTimeFormatOptions = { month: 'short' }) =>
  new Date(`${m}-15T12:00:00Z`).toLocaleDateString('ru-RU', { timeZone: 'UTC', ...opts }).replace('.', '');

/**
 * Earnings analytics from payroll lines only (GET /teacher/payroll?month=… per month).
 * The goal calculator is a projection at the current rate, labelled as such.
 */
function PayrollAnalytics() {
  const { state } = useTeacher();
  const [goal, setGoal] = useState(readGoal);
  const r = selectRate(state);
  const months = [...state.payrollHistory, state.payroll];
  const sums = months.map((m) => selectPayrollTotals(m.lines));
  const accrued = sums.map((x) => Number(x.accrued));
  const paid = sums.map((x) => Number(x.paid));
  const lessonsCount = months.map((m) => m.lines.filter((l) => l.status !== 'NO_PAYMENT').length);
  const best = accrued.slice(0, -1).reduce((b, v, i, a) => (v > a[b]! ? i : b), 0);

  // Current month by school day: daily amount and running total.
  const current = state.payroll.lines.filter((l) => l.status !== 'NO_PAYMENT');
  const today = dayKey(state.now);
  const days = Array.from({ length: Number(today.slice(8, 10)) }, (_, i) => `${today.slice(0, 8)}${String(i + 1).padStart(2, '0')}`);
  const daily = days.map((k) => current.filter((l) => dayKey(l.lessonStartedAt) === k).reduce((a, l) => a + Number(l.amount), 0));
  const running = daily.map((_, i) => daily.slice(0, i + 1).reduce((a, b) => a + b, 0));

  const byStudent = new Map<string, number>();
  for (const l of current) byStudent.set(l.studentName, (byStudent.get(l.studentName) ?? 0) + Number(l.amount));

  const earned = running.at(-1) ?? 0;
  const rate = Number(r.rate);
  const left = Math.max(0, goal - earned);
  const need = rate > 0 ? Math.ceil(left / rate) : 0;
  const scheduled = state.lessons.filter((l) => l.status === 'SCHEDULED' && l.startsAt > state.now && dayKey(l.startsAt).slice(0, 7) === today.slice(0, 7)).length;
  const forecast = earned + scheduled * rate;
  const money = (v: number) => fmtMoney(v.toFixed(2), 'MDL');

  return (
    <>
      <div className="two-col">
        <section className="card" aria-labelledby="h-months">
          <div className="card-head">
            <h3 id="h-months">Доход по месяцам</h3>
            <span className="right muted" style={{ fontSize: 13 }}>
              лучший: {monthName(months[best]!.month, { month: 'long' })}
            </span>
          </div>
          <Chart
            label="Начислено и выплачено по месяцам"
            height={220}
            labels={months.map((m, i) => (i === months.length - 1 ? `${monthName(m.month)} · идёт` : monthName(m.month)))}
            tipTitle={(i) => `${monthName(months[i]!.month, { month: 'long', year: 'numeric' })}${i === months.length - 1 ? ' (идёт)' : ''}`}
            series={[
              { key: 'acc', name: 'Начислено', color: 'var(--teal)', type: 'bar', values: accrued, format: money },
              { key: 'paid', name: 'Выплачено', color: 'var(--blue)', type: 'bar', values: paid, format: money },
            ]}
            extra={(i) => `${lessonsCount[i]} уроков · ${months[i]!.lines[0] ? `ставка ${fmtMoney(months[i]!.lines[0]!.rate, 'MDL')}` : 'нет уроков'}`}
          />
        </section>
        <section className="card" aria-labelledby="h-days">
          <div className="card-head">
            <h3 id="h-days">Этот месяц по дням</h3>
            <span className="right muted" style={{ fontSize: 13 }}>
              {money(earned)}
            </span>
          </div>
          <Chart
            label="Начисления текущего месяца по дням, нарастающим итогом"
            height={220}
            labels={days.map((k) => String(Number(k.slice(8, 10))))}
            tipTitle={(i) => new Date(`${days[i]}T12:00:00Z`).toLocaleDateString('ru-RU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long' })}
            series={[
              { key: 'run', name: 'С начала месяца', color: 'var(--teal)', type: 'area', values: running, format: money },
              { key: 'day', name: 'За день', color: 'var(--ink)', type: 'bar', values: daily, format: money },
            ]}
          />
        </section>
      </div>

      <div className="two-col">
        <section className="card" aria-labelledby="h-by-student">
          <div className="card-head">
            <h3 id="h-by-student">По ученикам · этот месяц</h3>
          </div>
          <HBarList
            label="Начисления текущего месяца по ученикам"
            empty="В этом месяце ещё нет начислений"
            rows={[...byStudent]
              .sort((a, b) => b[1] - a[1])
              .map(([name, v]) => ({ key: name, label: name, value: v, display: money(v), sub: `${Math.round(v / (rate || 1))} ур.` }))}
          />
        </section>
        <section className="tile tile-yellow" aria-labelledby="h-goal">
          <TileShape color="yellow" />
          <h3 id="h-goal">Цель на месяц</h3>
          <div className="field" style={{ marginTop: 12, position: 'relative', maxWidth: 260 }}>
            <label htmlFor="goal">Сколько хочу заработать, лей</label>
            <input
              id="goal"
              type="number"
              min={0}
              step={500}
              value={goal}
              onChange={(e) => {
                const v = Math.max(0, Number(e.target.value) || 0);
                setGoal(v);
                try {
                  window.localStorage.setItem(GOAL_KEY, String(v));
                } catch {
                  // storage unavailable: keep the value for this visit only
                }
              }}
            />
          </div>
          <div className="metric-row" style={{ position: 'relative' }}>
            <div className="metric">
              <b className="num">{money(earned)}</b>
              <span>уже начислено</span>
            </div>
            <div className="metric">
              <b className="num">{left > 0 ? need : 0}</b>
              <span>уроков осталось провести</span>
            </div>
            <div className="metric">
              <b className="num">{money(forecast)}</b>
              <span>прогноз · {scheduled} запланировано</span>
            </div>
          </div>
          <div className="hb-track" style={{ position: 'relative', marginTop: 14 }} aria-hidden="true">
            <i style={{ width: `${goal > 0 ? Math.min(100, (earned / goal) * 100) : 0}%`, background: 'var(--ink)' }} />
          </div>
          <span className="section-note" style={{ position: 'relative', marginTop: 8 }}>
            Расчёт по текущей ставке {fmtMoney(r.rate, 'MDL')} за урок — это прогноз, а не начисление.
          </span>
        </section>
      </div>
    </>
  );
}
