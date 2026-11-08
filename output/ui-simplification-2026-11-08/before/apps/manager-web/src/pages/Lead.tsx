import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  claimManagerLead,
  getManagerLead,
  loseManagerLead,
  reopenManagerLead,
  scheduleManagerTrial,
  transitionManagerLead,
} from '@online-school/api-contracts';
import type { LeadDto, LoseLeadDto } from '@online-school/api-contracts';
import { read } from '../api/client.js';
import { useManager } from '../session.js';
import { useOptions } from '../hooks/use-options.js';
import { useCommand } from '../hooks/use-command.js';
import {
  Badge,
  State,
  Input,
  Select,
  TextArea,
  Dialog,
  FormShell,
  ErrorBox,
  enumOptions,
  text,
} from '../components/ui.js';
import { LeadForm } from '../components/lead-form.js';
import { displayTime, localToIso } from '../lib/time.js';
import { ru, label } from '../i18n/ru.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
export default function Lead() {
  const id = useParams().id!,
    me = useManager();
  const query = useQuery({
    queryKey: ['manager', 'lead', id],
    queryFn: ({ signal }) => read((o) => getManagerLead(id, o), signal),
  });
  return (
    <>
      <Link className="back-link" to={routes.leads}>
        ← {ru.leads}
      </Link>
      <State query={query}>
        {(lead) => (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">{ru.leadCard}</p>
                <h1>{lead.contactName}</h1>
              </div>
              <Badge value={lead.stage} />
            </div>
            <LeadActions lead={lead} refresh={() => query.refetch()} />
            <div className="dashboard-grid">
              <section className="panel">
                <h2>{ru.leadBrief}</h2>
                <dl className="details">
                  <dt>{ru.audience}</dt>
                  <dd>{label(lead.audience)}</dd>
                  <dt>{ru.guardianNameLead}</dt>
                  <dd>{lead.guardianName ?? ru.dash}</dd>
                  <dt>{ru.phone}</dt>
                  <dd>{lead.phone ?? ru.dash}</dd>
                  <dt>{ru.email}</dt>
                  <dd>{lead.email ?? ru.dash}</dd>
                  <dt>{ru.studySubject}</dt>
                  <dd>{lead.subjectName}</dd>
                  <dt>{ru.ageYears}</dt>
                  <dd>{lead.ageYears ?? ru.dash}</dd>
                  <dt>{ru.grade}</dt>
                  <dd>{lead.grade ?? ru.dash}</dd>
                  <dt>{ru.level}</dt>
                  <dd>{lead.level ?? ru.dash}</dd>
                  <dt>{ru.source}</dt>
                  <dd>{label(lead.source)}</dd>
                </dl>
                <p className="plain-text">{lead.comment}</p>
                <p className="hint">{ru.leadContactHelp}</p>
                {lead.studentId && (
                  <Link className="button" to={routes.student(lead.studentId)}>
                    {ru.viewStudent}
                  </Link>
                )}
              </section>
              <section className="panel">
                <h2>{ru.trial}</h2>
                {lead.trial ? (
                  <>
                    <p>
                      {displayTime(lead.trial.startsAt, me.timezone)} —{' '}
                      {displayTime(lead.trial.endsAt, me.timezone)}
                    </p>
                    <p>{lead.trial.teacherName}</p>
                    <p>
                      {ru.trialOutcome}: <Badge value={lead.trial.outcome} />
                    </p>
                    <h3>{ru.feedback}</h3>
                    <Badge value={lead.trial.feedbackStatus} />
                    <p className="plain-text">
                      {lead.trial.feedbackSummary ??
                        (lead.trial.feedbackStatus === 'PENDING'
                          ? ru.feedbackPending
                          : ru.feedbackHidden)}
                    </p>
                    <div className="actions">
                      <Link
                        className="button"
                        to={`${routes.schedule}?studentId=${encodeURIComponent(lead.studentId ?? '')}`}
                      >
                        {ru.openCalendar}
                      </Link>
                      {lead.trial.meetLink &&
                        /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(
                          lead.trial.meetLink,
                        ) && (
                          <a
                            className="button"
                            href={lead.trial.meetLink}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {ru.joinMeet}
                          </a>
                        )}
                    </div>
                  </>
                ) : (
                  <p className="hint">{ru.trialHelp}</p>
                )}
              </section>
              <section className="panel">
                <h2>{ru.tasks}</h2>
                <ul className="record-cards">
                  {lead.openTasks.map((t) => (
                    <li key={t.taskId}>
                      <Link to={routes.task(t.taskId)}>{label(t.type)}</Link>
                      <p>{displayTime(t.dueAt, me.timezone)}</p>
                    </li>
                  ))}
                </ul>
                {!lead.openTasks.length && <p>{ru.empty}</p>}
              </section>
              <section className="panel">
                <h2>{ru.stageHistory}</h2>
                <ol className="lead-history">
                  {lead.history.map((h, i) => (
                    <li key={`${h.at}:${i}`}>
                      <p>
                        {h.from ? `${label(h.from)} → ` : ''}
                        {label(h.to)}
                      </p>
                      <small>
                        {displayTime(h.at, me.timezone)} ·{' '}
                        {h.byManager ? ru.byManager : ru.bySystem}
                      </small>
                    </li>
                  ))}
                </ol>
                {lead.lostReason && (
                  <p>
                    {ru.lostReason}: {label(lead.lostReason)}
                    <span className="plain-text"> {lead.lostComment}</span>
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </State>
    </>
  );
}
function LeadActions({ lead, refresh }: { lead: LeadDto; refresh: () => Promise<unknown> }) {
  const [action, setAction] = useState<'trial' | 'lose' | 'payment' | 'edit' | null>(null),
    command = useCommand(),
    options = useOptions(),
    me = useManager();
  const terminal = lead.stage === 'CONVERTED' || lead.stage === 'LOST';
  const done = (result: unknown) => {
    if (result) {
      setAction(null);
      void refresh();
    }
  };
  return (
    <>
      <ErrorBox error={command.error} retry={refresh} />
      <div className="actions lead-actions">
        {lead.stage === 'NEW' && (
          <button
            className="primary"
            type="button"
            disabled={command.busy}
            onClick={() => {
              void command
                .run({ version: lead.version }, (o) =>
                  claimManagerLead(lead.leadId, { version: lead.version }, o),
                )
                .then(done);
            }}
          >
            {ru.claimLead}
          </button>
        )}
        {['IN_PROGRESS', 'AWAITING_PAYMENT'].includes(lead.stage) && (
          <button className="primary" type="button" onClick={() => setAction('trial')}>
            {ru.scheduleTrial}
          </button>
        )}
        {(lead.stage === 'IN_PROGRESS' ||
          (lead.stage === 'TRIAL' && lead.trial?.outcome === 'ATTENDED')) && (
          <button type="button" onClick={() => setAction('payment')}>
            {ru.awaitPayment}
          </button>
        )}
        {lead.stage === 'TRIAL' &&
          lead.trial &&
          ['NO_SHOW', 'CANCELLED'].includes(lead.trial.outcome) && (
            <button
              type="button"
              disabled={command.busy}
              onClick={() => {
                const payload = { to: 'IN_PROGRESS' as const, version: lead.version };
                void command
                  .run(payload, (o) => transitionManagerLead(lead.leadId, payload, o))
                  .then(done);
              }}
            >
              {ru.returnLead}
            </button>
          )}
        {!terminal && (
          <>
            <button type="button" onClick={() => setAction('edit')}>
              {ru.editLead}
            </button>
            <button type="button" onClick={() => setAction('lose')}>
              {ru.loseLead}
            </button>
          </>
        )}
        {lead.stage === 'LOST' && (
          <button
            type="button"
            disabled={command.busy}
            onClick={() => {
              void command
                .run({ version: lead.version }, (o) =>
                  reopenManagerLead(lead.leadId, { version: lead.version }, o),
                )
                .then(done);
            }}
          >
            {ru.reopenLead}
          </button>
        )}
      </div>
      {lead.stage === 'AWAITING_PAYMENT' && (
        <p className="hint">
          {ru.leadMoneyHelp}{' '}
          {lead.studentId && (
            <Link to={`${routes.student(lead.studentId)}?tab=payments`}>{ru.payments} →</Link>
          )}
        </p>
      )}
      {terminal && <p className="hint">{ru.terminalLeadHelp}</p>}
      {action === 'edit' && (
        <Dialog title={ru.editLead} close={() => setAction(null)}>
          <LeadForm lead={lead} reload={refresh} done={done} />
        </Dialog>
      )}
      {action === 'trial' && (
        <Dialog title={ru.scheduleTrial} close={() => setAction(null)}>
          <p>{ru.trialHelp}</p>
          <p className="hint">{ru.localTime}</p>
          <FormShell
            busy={command.busy}
            error={command.error}
            reload={refresh}
            button={ru.scheduleTrial}
            submit={async (f) => {
              const startsAt = localToIso(text(f, 'startsAt'), me.timezone);
              if (!startsAt) return;
              const payload = { version: lead.version, teacherId: text(f, 'teacherId'), startsAt };
              done(
                await command.run(payload, (o) => scheduleManagerTrial(lead.leadId, payload, o)),
              );
            }}
          >
            <Select
              name="teacherId"
              label={ru.teacher}
              options={options.data?.teachers ?? []}
              required
            />
            <Input name="startsAt" label={ru.date} type="datetime-local" required />
          </FormShell>
        </Dialog>
      )}
      {action === 'payment' && (
        <Dialog title={ru.awaitPayment} close={() => setAction(null)}>
          <p className="hint">{ru.leadMoneyHelp}</p>
          <FormShell
            busy={command.busy}
            error={command.error}
            reload={refresh}
            button={ru.awaitPayment}
            submit={async (f) => {
              const payload = {
                to: 'AWAITING_PAYMENT' as const,
                version: lead.version,
                ...(lead.stage === 'IN_PROGRESS' ? { skipTrialReason: text(f, 'reason') } : {}),
              };
              done(
                await command.run(payload, (o) => transitionManagerLead(lead.leadId, payload, o)),
              );
            }}
          >
            {lead.stage === 'IN_PROGRESS' && (
              <TextArea
                name="reason"
                label={ru.skipTrialReason}
                required
                minLength={3}
                maxLength={500}
              />
            )}
          </FormShell>
        </Dialog>
      )}
      {action === 'lose' && (
        <Dialog title={ru.loseLead} close={() => setAction(null)}>
          <FormShell
            busy={command.busy}
            error={command.error}
            reload={refresh}
            button={ru.loseLead}
            submit={async (f) => {
              const payload: LoseLeadDto = {
                version: lead.version,
                reason: text(f, 'reason') as LoseLeadDto['reason'],
                ...(text(f, 'comment') ? { comment: text(f, 'comment') } : {}),
              };
              done(await command.run(payload, (o) => loseManagerLead(lead.leadId, payload, o)));
            }}
          >
            <Select
              name="reason"
              label={ru.lostReason}
              options={enumOptions([
                'NOT_INTERESTED',
                'PRICE',
                'NO_CONTACT',
                'COMPETITOR',
                'SCHEDULE_MISMATCH',
                'TRIAL_NO_SHOW',
                'OTHER',
              ])}
              required
            />
            <TextArea name="comment" label={ru.comment} maxLength={500} />
          </FormShell>
        </Dialog>
      )}
    </>
  );
}
