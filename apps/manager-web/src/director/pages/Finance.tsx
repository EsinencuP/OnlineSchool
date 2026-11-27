import { useSearchParams } from 'react-router-dom';
import { KpiCard, SortTh, useSort } from '../../shared/analytics';
import { fmtDay, fmtDateTime, fmtMoney } from '../../shared/format';
import { Avatar, Badge, Empty } from '../../shared/ui';
import { unresolvedKind } from '../logic';
import { useDirector } from '../store';
import type { PayrollTeacherRow, UnresolvedKind } from '../types';

type PKey = 'name' | 'accrued' | 'paid' | 'outstanding';

/** Teacher payroll, accounting periods and the facts that block closing them. */
export function DirectorFinance() {
  const { state } = useDirector();
  const [params, setParams] = useSearchParams();
  const kind = params.get('kind') as UnresolvedKind | null;
  const { sorted, sort, toggle } = useSort<PayrollTeacherRow, PKey>(state.payroll.teachers, { key: 'outstanding', dir: 'desc' }, (r, k) => (k === 'name' ? r.teacherName : Number(r[k])));
  const items = state.unresolved.items.filter((i) => !kind || i.kind === kind);
  const endLabel = (iso: string) => fmtDay(new Date(new Date(iso).getTime() - 12 * 3600_000).toISOString());

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div>
          <h1>Финансы</h1>
          <p>Начисления и выплаты преподавателям за текущий период, закрытие периодов и незакрытые факты.</p>
        </div>
      </div>

      {state.payroll.totals.map((t) => (
        <div key={t.currency} className="kpis" aria-label={`Итоги по зарплате, ${t.currency}`}>
          <KpiCard color="teal" label="Начислено преподавателям" value={fmtMoney(t.accrued, t.currency)} context="текущий период" />
          <KpiCard color="blue" label="Выплачено" value={fmtMoney(t.paid, t.currency)} context="подтверждённые выплаты" />
          <KpiCard color="yellow" label="Осталось выплатить" value={fmtMoney(t.outstanding, t.currency)} context="начислено − выплачено" tone={Number(t.outstanding) > 0 ? 'warn' : 'ok'} />
          <KpiCard color="violet" label="Ждут начисления" value={fmtMoney(t.pendingAccrual, t.currency)} context="подтверждённые уроки без начисления" to="/director/finance?kind=UNACCRUED_LESSON" />
        </div>
      ))}

      <section aria-labelledby="h-pay">
        <div className="section-title"><h2 id="h-pay">Расчёты с преподавателями</h2></div>
        <div className="table-wrap boxed">
          <table>
            <thead>
              <tr>
                <SortTh k="name" sort={sort} onSort={toggle}>Преподаватель</SortTh>
                <SortTh k="accrued" sort={sort} onSort={toggle} align="r">Начислено</SortTh>
                <SortTh k="paid" sort={sort} onSort={toggle} align="r">Выплачено</SortTh>
                <th scope="col" style={{ width: '22%' }}>Доля выплаченного</th>
                <SortTh k="outstanding" sort={sort} onSort={toggle} align="r">Долг</SortTh>
                <th scope="col" className="r">Выплаты в работе</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const share = Number(r.accrued) > 0 ? Number(r.paid) / Number(r.accrued) : 0;
                return (
                  <tr key={r.teacherId} style={{ cursor: 'default' }}>
                    <td><span className="cell-person"><Avatar name={r.teacherName} /><b>{r.teacherName}</b></span></td>
                    <td className="r">{fmtMoney(r.accrued, r.currency)}</td>
                    <td className="r">{fmtMoney(r.paid, r.currency)}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="hb-track" style={{ flex: 1 }} aria-hidden="true">
                          <i style={{ width: `${share * 100}%`, background: 'var(--c-money)' }} />
                        </span>
                        <span className="num muted" style={{ fontSize: 12, minWidth: 34, textAlign: 'right' }}>{Math.round(share * 100)}%</span>
                      </span>
                    </td>
                    <td className="r">{Number(r.outstanding) > 0 ? <b>{fmtMoney(r.outstanding, r.currency)}</b> : <span className="muted">—</span>}</td>
                    <td className="r">{r.openAttempts || <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid-dir">
        <section aria-labelledby="h-unres">
          <div className="section-title"><h2 id="h-unres">Незакрытые факты</h2></div>
          <div className="chips" role="group" aria-label="Тип факта" style={{ marginBottom: 10 }}>
            <button type="button" className="chip" aria-pressed={!kind} onClick={() => setParams({}, { replace: true })}>
              Все <span className="n">{state.unresolved.items.length}</span>
            </button>
            {(Object.keys(unresolvedKind) as UnresolvedKind[]).map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setParams({ kind: k }, { replace: true })}>
                {unresolvedKind[k]} <span className="n">{state.unresolved.counts[k] ?? 0}</span>
              </button>
            ))}
          </div>
          {items.length === 0 ? (
            <section className="card"><Empty title="Нет фактов этого типа" /></section>
          ) : (
            <div className="table-wrap boxed">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Факт</th>
                    <th scope="col">Кто</th>
                    <th scope="col" className="r">Сумма</th>
                    <th scope="col">С какого момента</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} style={{ cursor: 'default' }}>
                      <td><b>{unresolvedKind[i.kind]}</b><span className="muted" style={{ display: 'block', fontSize: 12 }}>{i.detail}</span></td>
                      <td>{[i.teacherName, i.studentName].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="r">{i.amount && i.currency ? fmtMoney(i.amount, i.currency) : '—'}</td>
                      <td>{fmtDateTime(i.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="h-per">
          <div className="section-title"><h2 id="h-per">Периоды</h2></div>
          <div className="table-wrap boxed">
            <table>
              <thead>
                <tr>
                  <th scope="col">Период</th>
                  <th scope="col">Состояние</th>
                  <th scope="col" className="r">Блокеры</th>
                </tr>
              </thead>
              <tbody>
                {state.periods.map((p) => (
                  <tr key={p.id} style={{ cursor: 'default' }}>
                    <td className="num">{fmtDay(p.startsAt)} — {endLabel(p.endsAt)}</td>
                    <td>
                      {p.closedAt ? <Badge tone="neutral">Закрыт</Badge> : p.readyToClose ? <Badge tone="teal">Можно закрыть</Badge> : p.finished ? <Badge tone="coral">Завершён, есть блокеры</Badge> : <Badge tone="blue">Идёт</Badge>}
                    </td>
                    <td className="r">{p.blockers || <span className="muted">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
