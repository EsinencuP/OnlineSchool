import { Lock } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useManager } from '../../manager/store';
import { Segmented, SortTh, useSort } from '../../shared/analytics';
import { fmtDateTime, fmtMoney, plural } from '../../shared/format';
import { Badge, Empty, Notice, Panel } from '../../shared/ui';
import { ageDays, allDecisions, DECISION_KINDS, DECLINABLE, decisionKind } from '../logic';
import { useDirector } from '../store';
import type { DecisionItem } from '../types';

type ReadyFilter = 'ALL' | 'READY' | 'BLOCKED';
type SortKey = 'age' | 'amount' | 'student' | 'kind';

/** Decision queue: one table for every kind, filters kept in the URL so links from the overview land filtered. */
export function DirectorDecisions() {
  const { state } = useDirector();
  const { state: manager } = useManager();
  const [params, setParams] = useSearchParams();
  const rawKind = params.get('kind');
  const kind = DECISION_KINDS.find((k) => k === rawKind) ?? null;
  const rawReady = params.get('ready');
  const ready: ReadyFilter = rawReady === 'READY' || rawReady === 'BLOCKED' ? rawReady : 'ALL';
  const [openId, setOpenId] = useState<string | null>(null);

  const all = allDecisions(state, manager);
  const rows = all.filter((d) => (!kind || d.kind === kind) && (ready === 'ALL' || (ready === 'READY' ? d.ready : !d.ready)));
  const { sorted, sort, toggle } = useSort<DecisionItem, SortKey>(rows, { key: 'age', dir: 'desc' }, (d, k) =>
    k === 'age' ? -new Date(d.requestedAt).getTime() : k === 'amount' ? (d.amount ? Number(d.amount) : null) : k === 'student' ? d.studentName : decisionKind[d.kind].label,
  );
  const open = all.find((d) => `${d.kind}:${d.id}` === openId) ?? null;
  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div>
          <h1>Решения</h1>
          <p>Всё, что ждёт руководителя: оплаты, распределения, исключения в расписании, споры, доступы и возвраты. Сначала самые старые.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="Тип решения">
          <button type="button" className="chip" aria-pressed={!kind} onClick={() => setParam('kind', null)}>
            Все <span className="n">{all.length}</span>
          </button>
          {DECISION_KINDS.map((k) => {
            const n = all.filter((d) => d.kind === k).length;
            return (
              <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setParam('kind', k)} disabled={n === 0 && kind !== k}>
                {decisionKind[k].short} <span className="n">{n}</span>
              </button>
            );
          })}
        </div>
        <span className="grow" />
        <Segmented<ReadyFilter>
          label="Готовность"
          value={ready}
          onChange={(v) => setParam('ready', v === 'ALL' ? null : v)}
          options={[['ALL', 'Все'], ['READY', 'Можно решить'], ['BLOCKED', 'Заблокированы']]}
        />
      </div>

      {sorted.length === 0 ? (
        <section className="card">
          <Empty title="Нет решений по этому фильтру" text={all.length ? 'Сбросьте фильтр, чтобы увидеть остальные.' : 'Очередь пуста.'} />
        </section>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh k="kind" sort={sort} onSort={toggle}>Тип</SortTh>
                <SortTh k="student" sort={sort} onSort={toggle}>Ученик</SortTh>
                <SortTh k="amount" sort={sort} onSort={toggle} align="r">Сумма</SortTh>
                <th scope="col">Запросил</th>
                <SortTh k="age" sort={sort} onSort={toggle} align="r">Ждёт</SortTh>
                <th scope="col">Готовность</th>
                <th scope="col"><span className="sr-only">Действия</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const age = ageDays(d.requestedAt, state.now);
                const key = `${d.kind}:${d.id}`;
                return (
                  <tr key={key} onClick={() => setOpenId(key)}>
                    <td><Badge tone={decisionKind[d.kind].tone}>{decisionKind[d.kind].label}</Badge></td>
                    <td><b>{d.studentName ?? '—'}</b></td>
                    <td className="r">{d.amount && d.currency ? fmtMoney(d.amount, d.currency) : '—'}</td>
                    <td>{d.requestedBy ?? '—'}</td>
                    <td className="r">{age === 0 ? <span className="muted">сегодня</span> : <span className={age >= 3 ? 'neg' : undefined}>{age} {plural(age, 'день', 'дня', 'дней')}</span>}</td>
                    <td>{d.ready ? <Badge tone="teal">Можно решить</Badge> : <span className="muted" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12 }}><Lock size={12} /> {d.blockedBy}</span>}</td>
                    <td className="r">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setOpenId(key); }}>
                        Открыть
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && <DecisionDrawer d={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function DecisionDrawer({ d, onClose }: { d: DecisionItem; onClose: () => void }) {
  const director = useDirector();
  const manager = useManager();
  const [reason, setReason] = useState('');
  const [declining, setDeclining] = useState(false);
  const meta = decisionKind[d.kind];

  const decide = (approve: boolean) => {
    const ok =
      d.kind === 'PAYMENT'
        ? manager.run({ type: 'payment.decide', paymentId: d.id, decision: approve ? 'CONFIRM' : 'REJECT', reason }).ok
        : approve
          ? director.run({ type: 'decision.approve', kind: d.kind, id: d.id }).ok
          : director.run({ type: 'decision.decline', kind: d.kind, id: d.id, reason }).ok;
    if (ok) onClose();
  };

  return (
    <Panel title={meta.label} onClose={onClose}>
      <div className="chips">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {d.ready ? <Badge tone="teal">Можно решить</Badge> : <Badge tone="neutral">Заблокировано</Badge>}
      </div>
      <section className="card">
        <dl className="kv">
          <dt>Ученик</dt>
          <dd>{d.studentName ?? '—'}</dd>
          <dt>Сумма</dt>
          <dd className="num">{d.amount && d.currency ? fmtMoney(d.amount, d.currency) : '—'}</dd>
          <dt>Запросил</dt>
          <dd>{d.requestedBy ?? '—'}</dd>
          <dt>Ждёт с</dt>
          <dd>{fmtDateTime(d.requestedAt)}</dd>
        </dl>
      </section>
      {!d.ready && d.blockedBy && <Notice tone="yellow" icon={<Lock size={16} />}>Пока нельзя выполнить: {d.blockedBy.toLowerCase()}.</Notice>}
      {declining ? (
        <form
          className="card"
          style={{ display: 'grid', gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            decide(false);
          }}
        >
          <div className="field">
            <label htmlFor="decline-reason">Причина отказа</label>
            <textarea id="decline-reason" rows={3} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            <span className="hint">Её увидит менеджер. От 3 до 500 символов.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-danger">Отклонить</button>
            <button type="button" className="btn btn-ghost" onClick={() => setDeclining(false)}>Назад</button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-dark" disabled={!d.ready} onClick={() => decide(true)}>
            {meta.approve}
          </button>
          {DECLINABLE.has(d.kind) && (
            <button type="button" className="btn btn-ghost" onClick={() => setDeclining(true)}>
              Отклонить…
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}
