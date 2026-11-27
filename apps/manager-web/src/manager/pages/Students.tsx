import { Mail, Phone, Search, Snowflake } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ring } from '../../shared/charts';
import { SortTh, useSort } from '../../shared/analytics';
import { Avatar, Badge, Bar, Empty, Notice, Panel } from '../../shared/ui';
import { FREEZE_MAX_DAYS, FREEZE_MAX_TOTAL_DAYS } from '../logic';
import { useManager } from '../store';
import type { StudentListItem, StudentStatus } from '../types';
import { fmtDateTime, fmtDay, fmtMoney, relative } from '../../shared/format';
import { paymentStatus, studentStatus, taskType } from '../labels';

type Filter = StudentStatus | 'ALL' | 'DEBT';
const FILTERS: Filter[] = ['ALL', 'ACTIVE', 'FROZEN', 'EXPIRED', 'DEBT'];
const isDebt = (s: StudentListItem) => s.balance.startsWith('-');
const matches = (s: StudentListItem, f: Filter) => f === 'ALL' || (f === 'DEBT' ? isDebt(s) : s.status === f);
type SortKey = 'name' | 'remaining' | 'balance' | 'next' | 'tasks';

export function Students() {
  const { state } = useManager();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('status') as Filter | null) ?? 'ALL';
  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params);
    if (f === 'ALL') next.delete('status');
    else next.set('status', f);
    setParams(next, { replace: true });
  };
  const [q, setQ] = useState(params.get('q') ?? '');
  const selected = state.students.find((s) => s.studentId === params.get('id')) ?? null;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.students.filter((s) => {
      if (!matches(s, filter)) return false;
      if (!needle) return true;
      const card = state.cards[s.studentId];
      return [s.fullName, card?.contacts.guardianName ?? '', s.maskedPhone ?? ''].some((v) => v.toLowerCase().includes(needle));
    });
  }, [state.students, state.cards, filter, q]);
  const { sorted, sort, toggle } = useSort<StudentListItem, SortKey>(rows, { key: 'tasks', dir: 'desc' }, (s, k) =>
    k === 'name' ? s.fullName
    : k === 'remaining' ? (s.activeSubscription?.remainingLessons ?? null)
    : k === 'balance' ? Number(s.balance)
    : k === 'next' ? (s.nextLessonAt ? -new Date(s.nextLessonAt).getTime() : null)
    : s.overdueTasksCount * 100 + s.openTasksCount,
  );

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('id', id);
    else next.delete('id');
    setParams(next, { replace: true });
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Ученики</h1>
          <p>Ваш портфель: {state.students.length} учеников. Баланс — опубликованные движения по абонементам; ожидающие платежи не учитываются.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="chips" role="group" aria-label="Статус">
          {FILTERS.map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'ALL' ? 'Все' : f === 'DEBT' ? 'С долгом' : studentStatus[f].label}
              <span className="n">{state.students.filter((s) => matches(s, f)).length}</span>
            </button>
          ))}
        </div>
        <div className="search" style={{ maxWidth: 320, marginLeft: 'auto' }}>
          <span className="search-icon"><Search size={14} /></span>
          <label htmlFor="st-q" className="sr-only">Поиск</label>
          <input id="st-q" placeholder="Имя, родитель, телефон" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {rows.length === 0 ? (
        <section className="card">
          <Empty title="Никого не нашли" text="Измените фильтр или запрос." />
        </section>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh k="name" sort={sort} onSort={toggle}>Ученик</SortTh>
                <th scope="col">Статус</th>
                <SortTh k="remaining" sort={sort} onSort={toggle}>Абонемент</SortTh>
                <SortTh k="balance" sort={sort} onSort={toggle} align="r">Баланс</SortTh>
                <SortTh k="next" sort={sort} onSort={toggle}>Следующий урок</SortTh>
                <SortTh k="tasks" sort={sort} onSort={toggle}>Задачи</SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <StudentRow key={s.studentId} s={s} now={state.now} total={state.subscriptions.find((x) => x.id === s.activeSubscription?.id)?.totalLessons ?? null} onOpen={() => open(s.studentId)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <StudentDrawer studentId={selected.studentId} onClose={() => open(null)} />}
    </div>
  );
}

function StudentRow({ s, now, total, onOpen }: { s: StudentListItem; now: string; total: number | null; onOpen: () => void }) {
  const sub = s.activeSubscription;
  const neg = s.balance.startsWith('-');
  return (
    <tr tabIndex={0} onClick={onOpen} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())} aria-label={`Открыть карточку: ${s.fullName}`}>
      <td>
        <div className="cell-person">
          <Avatar name={s.fullName} />
          <div>
            <b>{s.fullName}</b>
            <span className="num">{s.maskedPhone}{s.hasAccount ? '' : ' · нет доступа в кабинет'}</span>
          </div>
        </div>
      </td>
      <td><Badge tone={studentStatus[s.status].tone}>{studentStatus[s.status].label}</Badge></td>
      <td style={{ minWidth: 170 }}>
        {sub ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <span className="num" style={{ fontSize: 13 }}>
              {sub.remainingLessons}{total ? ` из ${total}` : ''} зан. · до {sub.endsAt ? fmtDay(sub.endsAt) : '—'}
            </span>
            {total ? <Bar value={sub.remainingLessons} max={total} color={sub.remainingLessons <= 2 ? 'var(--danger)' : 'var(--c-people)'} /> : null}
          </div>
        ) : (
          <span className="muted">Нет активного</span>
        )}
      </td>
      <td className={`num r${neg ? ' neg' : ''}`}>{fmtMoney(s.balance, s.balanceCurrency)}</td>
      <td className="num">{s.nextLessonAt ? `${fmtDateTime(s.nextLessonAt)}` : <span className="muted">—</span>}<div className="muted" style={{ fontSize: 12 }}>{s.nextLessonAt ? relative(s.nextLessonAt, now) : ''}</div></td>
      <td>
        {s.openTasksCount === 0 ? (
          <span className="muted">—</span>
        ) : (
          <Badge tone={s.overdueTasksCount ? 'coral' : 'yellow'}>
            {s.openTasksCount}
            {s.overdueTasksCount ? ` · ${s.overdueTasksCount} проср.` : ''}
          </Badge>
        )}
      </td>
    </tr>
  );
}

function StudentDrawer({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { state, run } = useManager();
  const card = state.cards[studentId];
  const sub = state.subscriptions.find((x) => x.studentId === studentId);
  const [days, setDays] = useState(14);
  if (!card) return null;
  const l = card.learning;
  const freezeLeft = sub ? Math.min(FREEZE_MAX_DAYS, FREEZE_MAX_TOTAL_DAYS - sub.freezeDaysUsed) : 0;

  return (
    <Panel title={card.fullName} onClose={onClose} header={<Avatar name={card.fullName} size="lg" />}>
      <div className="chips">
        <Badge tone={studentStatus[card.status].tone}>{studentStatus[card.status].label}</Badge>
        <Badge tone={card.hasAccount ? 'teal' : 'neutral'}>{card.hasAccount ? 'Кабинет активен' : 'Нет доступа в кабинет'}</Badge>
      </div>

      <section className="card">
        <div className="card-head"><h3>Контакты</h3></div>
        <dl className="kv">
          <dt>Телефон</dt>
          <dd className="num"><a href={`tel:${card.contacts.phone ?? ''}`}><Phone size={13} /> {card.contacts.phone ?? '—'}</a></dd>
          <dt>Email</dt>
          <dd>{card.contacts.email ? <a href={`mailto:${card.contacts.email}`}><Mail size={13} /> {card.contacts.email}</a> : '—'}</dd>
          <dt>Родитель</dt>
          <dd>{card.contacts.guardianName ?? '—'}{card.contacts.guardianPhone ? `, ${card.contacts.guardianPhone}` : ''}</dd>
          {card.managerNote && (
            <>
              <dt>Заметка</dt>
              <dd>{card.managerNote}</dd>
            </>
          )}
        </dl>
      </section>

      {sub && (
        <section className="card">
          <div className="card-head">
            <h3>Абонемент</h3>
            <span className="right"><Badge tone={sub.status === 'FROZEN' ? 'violet' : sub.status === 'ACTIVE' ? 'teal' : 'coral'}>{{ ACTIVE: 'Активен', FROZEN: 'Заморожен', EXPIRED: 'Истёк', CANCELLED: 'Отменён' }[sub.status]}</Badge></span>
          </div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <Ring value={sub.remainingLessons} max={sub.totalLessons} size={96} color="var(--teal)" label={`Осталось ${sub.remainingLessons} из ${sub.totalLessons}`}>
              <div><b className="num" style={{ fontSize: 22 }}>{sub.remainingLessons}</b><div className="muted" style={{ fontSize: 11 }}>из {sub.totalLessons}</div></div>
            </Ring>
            <dl className="kv" style={{ flex: 1 }}>
              <dt>Период</dt>
              <dd>{fmtDay(sub.startsAt)} — {fmtDay(sub.endsAt)}</dd>
              <dt>Стоимость</dt>
              <dd className="num">{fmtMoney(sub.price, sub.currency)}</dd>
              <dt>Баланс</dt>
              <dd className={`num${card.balance.startsWith('-') ? ' neg' : ''}`}>{card.balances.map((b) => fmtMoney(b.amount, b.currency)).join(' · ')}</dd>
              <dt>Заморозка</dt>
              <dd>{sub.freezeDaysUsed} из {FREEZE_MAX_TOTAL_DAYS} дн. использовано{sub.frozenUntil ? ` · до ${fmtDay(sub.frozenUntil)}` : ''}</dd>
            </dl>
          </div>
          {sub.status === 'ACTIVE' && freezeLeft > 0 && (
            <form
              style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}
              onSubmit={(e) => {
                e.preventDefault();
                run({ type: 'subscription.freeze', subscriptionId: sub.id, days });
              }}
            >
              <div className="field" style={{ width: 160 }}>
                <label htmlFor="freeze-days">Заморозить на, дней</label>
                <input id="freeze-days" type="number" min={1} max={freezeLeft} value={days} onChange={(e) => setDays(Number(e.target.value))} />
              </div>
              <button type="submit" className="btn btn-ghost"><Snowflake size={16} /> Заморозить</button>
              <span className="hint muted" style={{ fontSize: 12 }}>Доступно: {freezeLeft} дн. Самостоятельная работа с материалами сохраняется.</span>
            </form>
          )}
          {sub.status === 'FROZEN' && (
            <button type="button" className="btn btn-dark" style={{ marginTop: 16 }} onClick={() => run({ type: 'subscription.unfreeze', subscriptionId: sub.id })}>
              Разморозить
            </button>
          )}
          {sub.status === 'EXPIRED' && <div style={{ marginTop: 12 }}><Notice tone="coral">Абонемент истёк. Для продления зарегистрируйте платёж — директор подтвердит поступление и распределение.</Notice></div>}
        </section>
      )}

      <section className="card">
        <div className="card-head"><h3>Обучение</h3><span className="right muted" style={{ fontSize: 12 }}>{l.lastReportAt ? `отчёт ${fmtDay(l.lastReportAt)}` : ''}</span></div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span>Навыки освоены</span><b className="num">{l.skillsMastered}/{l.skillsTotal}</b></div>
            <Bar value={l.skillsMastered} max={l.skillsTotal} color="var(--violet)" />
          </div>
          <div className="metric-row" style={{ marginTop: 0 }}>
            <div className="metric"><b className="num">{l.homeworkSubmitted}</b><span>ДЗ сдано</span></div>
            <div className="metric"><b className="num">{l.homeworkPending}</b><span>на проверке</span></div>
            <div className="metric"><b className={`num${l.homeworkOverdue ? ' neg' : ''}`}>{l.homeworkOverdue}</b><span>просрочено</span></div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h3>Ближайшие уроки</h3></div>
        {card.upcomingLessons.length === 0 ? <p className="muted">Нет запланированных уроков.</p> : (
          <div className="list">
            {card.upcomingLessons.map((x) => (
              <div key={x.id} className="row-item">
                <span className="time-pill num">{fmtDateTime(x.startsAt)}</span>
                <span className="grow"><span className="title">{x.subjectName}</span><span className="sub">{x.teacherName}</span></span>
              </div>
            ))}
          </div>
        )}
      </section>

      {card.openTasks.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>Открытые задачи</h3></div>
          <div className="list">
            {state.tasks.filter((t) => t.studentId === studentId && (t.status === 'OPEN' || t.status === 'IN_PROGRESS')).map((t) => (
              <div key={t.taskId} className="row-item">
                <Badge tone={taskType[t.type].tone}>{taskType[t.type].label}</Badge>
                <span className="grow" />
                <span className={`time-pill${t.isOverdue ? ' overdue' : ''}`}>{relative(t.dueAt, state.now)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h3>Платежи ученика</h3></div>
        {card.recentPayments.length === 0 ? <p className="muted">Распределённых платежей нет.</p> : (
          <div className="list">
            {card.recentPayments.map((p) => {
              const live = state.payments.find((x) => x.id === p.paymentId);
              const st = live?.status ?? p.status;
              return (
                <div key={p.id} className="row-item">
                  <span className="grow"><span className="title num">{fmtMoney(p.amount, p.currency)}</span><span className="sub">{fmtDateTime(p.registeredAt)}</span></span>
                  <Badge tone={paymentStatus[st].tone}>{paymentStatus[st].label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </Panel>
  );
}
