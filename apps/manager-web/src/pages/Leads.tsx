import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getManagerLeadSummary, listManagerLeads } from '@online-school/api-contracts';
import type { ListManagerLeadsParams } from '@online-school/api-contracts';
import { read } from '../api/client.js';
import { useManager } from '../session.js';
import { useOptions } from '../hooks/use-options.js';
import { Badge, State, Select, Input, Check, Dialog, enumOptions, text } from '../components/ui.js';
import { LeadForm } from '../components/lead-form.js';
import { displayTime } from '../lib/time.js';
import { ru, label } from '../i18n/ru.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
const stages = ['NEW', 'IN_PROGRESS', 'TRIAL', 'AWAITING_PAYMENT', 'CONVERTED', 'LOST'];
export default function Leads() {
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate(),
    me = useManager(),
    options = useOptions();
  const [creating, setCreating] = useState(params.get('create') === 'true'),
    [board, setBoard] = useState(false);
  const q: ListManagerLeadsParams = {
    limit: 25,
    ...Object.fromEntries(
      ['stage', 'search', 'source', 'subjectId', 'cursor'].flatMap((k) =>
        params.get(k) ? [[k, params.get(k)]] : [],
      ),
    ),
    ...(params.get('overdue') === 'true' ? { overdue: true } : {}),
  };
  const query = useQuery({
    queryKey: ['manager', 'leads', q],
    queryFn: ({ signal }) => read((o) => listManagerLeads(q, o), signal),
  });
  const summary = useQuery({
    queryKey: ['manager', 'lead-summary'],
    queryFn: ({ signal }) => read((o) => getManagerLeadSummary(o), signal),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{ru.pipeline}</p>
          <h1>{ru.leads}</h1>
        </div>
        <button type="button" className="primary" onClick={() => setCreating(true)}>
          + {ru.newLead}
        </button>
      </div>
      <State operational query={summary}>
        {(s) => (
          <>
            <div className="lead-summary">
              {Object.entries(s.countsByStage).map(([stage, count]) => (
                <Link className="panel" key={stage} to={`${routes.leads}?stage=${stage}`}>
                  <span>{label(stage)}</span>
                  <strong>{count}</strong>
                </Link>
              ))}
            </div>
            <p className="heading-caption">
              {ru.createdToday}: {s.createdToday} · {ru.trialsToday}: {s.trialsToday} ·{' '}
              {ru.conversion30d}: {(s.conversion30dBp / 100).toFixed(2).replace('.', ',')}%
            </p>
            <p className="hint">{ru.conversionHelp}</p>
          </>
        )}
      </State>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            next = new URLSearchParams();
          for (const k of ['search', 'stage', 'source', 'subjectId'])
            if (text(f, k)) next.set(k, text(f, k));
          if (f.has('overdue')) next.set('overdue', 'true');
          setParams(next);
        }}
      >
        <Input
          name="search"
          label={ru.search}
          minLength={2}
          maxLength={100}
          defaultValue={params.get('search') ?? ''}
        />
        <Select
          name="stage"
          label={ru.status}
          options={enumOptions(stages)}
          defaultValue={params.get('stage') ?? ''}
        />
        <Select
          name="source"
          label={ru.source}
          options={enumOptions(['SITE', 'PHONE', 'MESSENGER', 'REFERRAL', 'OTHER'])}
          defaultValue={params.get('source') ?? ''}
        />
        <Select
          name="subjectId"
          label={ru.studySubject}
          options={options.data?.subjects ?? []}
          defaultValue={params.get('subjectId') ?? ''}
        />
        <Check
          name="overdue"
          label={ru.overdueOnly}
          defaultChecked={params.get('overdue') === 'true'}
        />
        <button type="submit">{ru.filter}</button>
      </form>
      <div className="pagination">
        <button type="button" aria-pressed={!board} onClick={() => setBoard(false)}>
          {ru.list}
        </button>
        <button type="button" aria-pressed={board} onClick={() => setBoard(true)}>
          {ru.board}
        </button>
      </div>
      <p className="hint">{ru.leadPageHint}</p>
      <State operational query={query} empty={query.data?.items.length === 0}>
        {(d) => (
          <>
            {board ? (
              <div className="lead-board">
                {stages.map((stage) => (
                  <section className="lead-column" key={stage}>
                    <h2>{label(stage)}</h2>
                    {d.items
                      .filter((l) => l.stage === stage)
                      .map((l) => (
                        <article className="panel lead-tile" key={l.leadId}>
                          <Link className="record-title" to={routes.lead(l.leadId)}>
                            {l.contactName}
                          </Link>
                          <p>
                            {l.subjectName} · {label(l.audience)}
                          </p>
                          <p>{l.maskedPhone ?? ru.dash}</p>
                          <p className={l.isOverdue ? 'danger-text' : ''}>
                            {l.nextActionAt ? displayTime(l.nextActionAt, me.timezone) : ru.dash}
                          </p>
                        </article>
                      ))}
                    {!d.items.some((l) => l.stage === stage) && (
                      <p className="hint">{ru.noStageLeads}</p>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {[
                        ru.contactName,
                        ru.status,
                        ru.studySubject,
                        ru.phone,
                        ru.source,
                        ru.trial,
                        ru.dueAt,
                      ].map((h) => (
                        <th key={h} scope="col">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((l) => (
                      <tr key={l.leadId}>
                        <td>
                          <Link to={routes.lead(l.leadId)}>{l.contactName}</Link>
                        </td>
                        <td>
                          <Badge value={l.stage} />
                        </td>
                        <td>{l.subjectName}</td>
                        <td>{l.maskedPhone ?? ru.dash}</td>
                        <td>{label(l.source)}</td>
                        <td>{l.trialAt ? displayTime(l.trialAt, me.timezone) : ru.dash}</td>
                        <td className={l.isOverdue ? 'danger-text' : ''}>
                          {l.nextActionAt ? displayTime(l.nextActionAt, me.timezone) : ru.dash}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="pagination">
              {params.has('cursor') && (
                <button
                  type="button"
                  onClick={() => {
                    const p = new URLSearchParams(params);
                    p.delete('cursor');
                    setParams(p);
                  }}
                >
                  {ru.firstPage}
                </button>
              )}
              {d.nextCursor && (
                <button
                  type="button"
                  onClick={() => {
                    const p = new URLSearchParams(params);
                    p.set('cursor', d.nextCursor!);
                    setParams(p);
                  }}
                >
                  {ru.next}
                </button>
              )}
            </div>
          </>
        )}
      </State>
      {creating && (
        <Dialog title={ru.newLead} close={() => setCreating(false)}>
          <LeadForm done={(lead) => navigate(routes.lead(lead.leadId))} />
        </Dialog>
      )}
    </>
  );
}
