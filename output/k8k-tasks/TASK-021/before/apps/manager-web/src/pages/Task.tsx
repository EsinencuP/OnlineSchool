import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getManagerTask,
  claimManagerTask,
  resolveManagerTaskDispute,
  resolveManagerTaskReschedule,
} from '@online-school/api-contracts';
import type { ManagerTaskDetailDto } from '@online-school/api-contracts';
import { read } from '../api/client.js';
import { useCommand } from '../hooks/use-command.js';
import { useOptions } from '../hooks/use-options.js';
import { useManager } from '../session.js';
import {
  Badge,
  State,
  FormShell,
  Select,
  TextArea,
  ErrorBox,
  text,
  enumOptions,
} from '../components/ui.js';
import { DisputeForm, RescheduleForm } from '../components/business-forms.js';
import { displayTime, localInput } from '../lib/time.js';
import { formatMoney } from '../lib/money.js';
import { ru, label } from '../i18n/ru.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
export default function Task() {
  const id = useParams().id!;
  const me = useManager();
  const query = useQuery({
    queryKey: ['manager', 'task', id],
    queryFn: ({ signal }) => read((o) => getManagerTask(id, o), signal),
  });
  return (
    <>
      <Link className="back-link" to={routes.tasks}>
        {' '}
        {ru.tasks}
      </Link>
      <State query={query}>
        {(t) => (
          <>
            <div className="page-heading">
              <div>
                <h1>{label(t.type)}</h1>
                <Link
                  to={
                    t.leadId
                      ? routes.lead(t.leadId)
                      : t.studentId
                        ? routes.student(t.studentId)
                        : routes.tasks
                  }
                >
                  {t.studentName}
                </Link>
              </div>
              <Badge value={t.status} />
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <dl className="details">
                  <dt>{ru.createdAt}</dt>
                  <dd>{displayTime(t.createdAt, me.timezone)}</dd>
                  <dt>{ru.dueAt}</dt>
                  <dd className={t.isOverdue ? 'danger-text' : ''}>
                    {displayTime(t.dueAt, me.timezone)}
                  </dd>
                  <dt>{ru.approval}</dt>
                  <dd>
                    <Badge value={t.approvalStatus} />
                  </dd>
                </dl>
                {'studentComment' in t.payload && (
                  <>
                    <h2>{ru.studentComment}</h2>
                    <p className="plain-text">{t.payload.studentComment ?? ru.dash}</p>
                  </>
                )}
                {t.payload.kind === 'RESCHEDULE_REQUEST' && (
                  <>
                    <h2>{ru.preferredWindows}</h2>
                    {t.payload.preferredWindows.map((w) => (
                      <p key={w.from}>
                        {displayTime(w.from, me.timezone)} {displayTime(w.to, me.timezone)}
                      </p>
                    ))}
                  </>
                )}
                {t.payload.kind === 'CHARGE_DISPUTE' && (
                  <p>
                    {ru.lessons}: {t.payload.chargedLessons}
                    {t.payload.chargedAmount &&
                      t.payload.currency &&
                      `   ${formatMoney(t.payload.chargedAmount, t.payload.currency)}`}
                  </p>
                )}
                {t.resolution && (
                  <>
                    <h2>{ru.resolution}</h2>
                    {Object.entries(t.resolution)
                      .filter(
                        ([key, value]) =>
                          ['decision', 'reason', 'refundAmount', 'refundLessons'].includes(key) &&
                          (typeof value === 'string' || typeof value === 'number'),
                      )
                      .map(([key, value]) => (
                        <p className="plain-text" key={key}>
                          {key === 'reason'
                            ? ru.reason
                            : key === 'decision'
                              ? ru.decision
                              : key === 'refundAmount'
                                ? ru.refundAmount
                                : ru.refundLessons}
                          : {key === 'decision' ? label(String(value)) : String(value)}
                        </p>
                      ))}
                  </>
                )}
              </section>
              <section className="panel">
                <TaskDecision key={t.taskId} task={t} reload={async () => query.refetch()} />
              </section>
            </div>
          </>
        )}
      </State>
    </>
  );
}
function TaskDecision({
  task: t,
  reload,
}: {
  task: ManagerTaskDetailDto;
  reload: () => Promise<unknown>;
}) {
  const me = useManager();
  const command = useCommand();
  const options = useOptions(t.studentId ?? undefined);
  const [decision, setDecision] = useState('APPROVE');
  const [message, setMessage] = useState('');
  const teachers = Array.from(
    new Map(
      (options.data?.enrollments.flatMap((e) => e.teachers) ?? []).map((teacher) => [
        teacher.id,
        teacher,
      ]),
    ).values(),
  );
  async function refresh() {
    await reload();
    command.clearError();
  }
  function done(result: { status: string; approvalStatus?: string } | undefined) {
    if (result)
      setMessage(
        result.status === 'IN_PROGRESS' && result.approvalStatus !== 'NONE'
          ? ru.pendingApproval
          : ru.saved,
      );
  }
  if (t.status === 'RESOLVED' || t.status === 'REJECTED') return <p>{ru.taskReadonly}</p>;
  if (t.status === 'OPEN')
    return (
      <>
        <h2>{ru.claim}</h2>
        <FormShell
          busy={command.busy}
          error={command.error}
          reload={refresh}
          button={ru.claim}
          submit={async () => {
            const payload = { version: t.version };
            done(await command.run(payload, (o) => claimManagerTask(t.taskId, payload, o)));
          }}
        >
          <p>{label(t.type)}</p>
        </FormShell>
      </>
    );
  return (
    <>
      <h2>{ru.resolve}</h2>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {t.payload.kind === 'CHARGE_DISPUTE' ? (
        <DisputeForm
          version={t.version}
          busy={command.busy}
          error={command.error}
          reload={refresh}
          submit={async (payload) =>
            done(await command.run(payload, (o) => resolveManagerTaskDispute(t.taskId, payload, o)))
          }
        />
      ) : t.payload.kind === 'RESCHEDULE_REQUEST' ? (
        <>
          <Select
            name="rescheduleDecision"
            label={ru.decision}
            options={enumOptions(['APPROVE', 'DECLINE'])}
            value={decision}
            placeholder={false}
            onChange={(e) => setDecision(e.target.value)}
          />
          {decision === 'APPROVE' ? (
            <>
              <ErrorBox
                error={options.error}
                retry={() => {
                  void options.refetch();
                }}
              />
              <RescheduleForm
                timezone={me.timezone}
                teachers={teachers}
                initialTime={localInput(t.payload.currentStartsAt, me.timezone)}
                busy={command.busy}
                error={command.error}
                reload={refresh}
                submit={async (input) => {
                  const payload = {
                    decision: 'APPROVE' as const,
                    newStartsAt: input.newStartsAt,
                    reason: input.reason,
                    version: t.version,
                    ...(input.newTeacherId ? { newTeacherId: input.newTeacherId } : {}),
                    ...(input.overrideLateRule ? { overrideLateRule: true } : {}),
                  };
                  done(
                    await command.run(payload, (o) =>
                      resolveManagerTaskReschedule(t.taskId, payload, o),
                    ),
                  );
                }}
              />
            </>
          ) : (
            <FormShell
              busy={command.busy}
              error={command.error}
              reload={refresh}
              button={ru.decline}
              submit={async (f) => {
                const payload = {
                  decision: 'DECLINE' as const,
                  reason: text(f, 'reason'),
                  version: t.version,
                };
                done(
                  await command.run(payload, (o) =>
                    resolveManagerTaskReschedule(t.taskId, payload, o),
                  ),
                );
              }}
            >
              <TextArea name="reason" label={ru.reason} required minLength={3} maxLength={500} />
            </FormShell>
          )}
        </>
      ) : (
        <>
          <p>{ru.taskOther}</p>
          <Link
            to={
              t.leadId
                ? routes.lead(t.leadId)
                : t.studentId
                  ? routes.student(t.studentId)
                  : routes.tasks
            }
          >
            {t.leadId ? ru.openLead : ru.viewStudent}
          </Link>
        </>
      )}
    </>
  );
}
