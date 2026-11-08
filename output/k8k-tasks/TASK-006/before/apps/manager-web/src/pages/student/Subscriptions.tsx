import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listManagerSubscriptions,
  listManagerDistributions,
  createManagerSubscription,
  renewManagerSubscription,
  freezeManagerSubscription,
  unfreezeManagerSubscription,
} from '@online-school/api-contracts';
import type { ManagerSubscriptionDto } from '@online-school/api-contracts';
import { read } from '../../api/client.js';
import { useCommand } from '../../hooks/use-command.js';
import { useOptions } from '../../hooks/use-options.js';
import { useManager } from '../../session.js';
import { Badge, State, Dialog, FormShell, Select, Check, text } from '../../components/ui.js';
import { FreezeForm } from '../../components/business-forms.js';
import { formatMoney } from '../../lib/money.js';
import { displayTime } from '../../lib/time.js';
import { ru } from '../../i18n/ru.js';
type Action =
  | { kind: 'create' }
  | { kind: 'renew' | 'freeze' | 'unfreeze'; subscription: ManagerSubscriptionDto };
export default function Subscriptions({ studentId }: { studentId: string }) {
  const me = useManager();
  const [action, setAction] = useState<Action | null>(null);
  const options = useOptions(studentId);
  const query = useQuery({
    queryKey: ['manager', 'subscriptions', studentId],
    queryFn: ({ signal }) => read((o) => listManagerSubscriptions(studentId, o), signal),
  });
  return (
    <>
      <div className="section-heading">
        <h2>{ru.subscriptions}</h2>
        <button className="primary" type="button" onClick={() => setAction({ kind: 'create' })}>
          + {ru.newSubscription}
        </button>
      </div>
      <p className="hint">{ru.readyHelp}</p>
      <State query={query} empty={query.data?.length === 0}>
        {(items) => (
          <ul className="record-cards">
            {items.map((s) => (
              <li key={s.id}>
                <div className="section-heading">
                  <h3>
                    {options.data?.enrollments.find((e) => e.id === s.enrollmentId)?.label ??
                      ru.direction}
                  </h3>
                  <Badge value={s.status} />
                </div>
                <p>{options.data?.plans.find((p) => p.id === s.planId)?.label ?? ru.plan}</p>
                <dl className="details">
                  <dt>{ru.start}</dt>
                  <dd>{displayTime(s.startsAt, me.timezone)}</dd>
                  <dt>{ru.end}</dt>
                  <dd>{displayTime(s.endsAt, me.timezone)}</dd>
                  <dt>{ru.remaining}</dt>
                  <dd>
                    {s.remainingLessons} / {s.totalLessons}
                  </dd>
                  <dt>{ru.amountPreview}</dt>
                  <dd>{formatMoney(s.price, s.currency)}</dd>
                  <dt>{ru.freezeUsed}</dt>
                  <dd>{s.freezeDaysUsed} / 60</dd>
                  {s.frozenUntil && (
                    <>
                      <dt>{ru.endsOn}</dt>
                      <dd>{displayTime(s.frozenUntil, me.timezone)}</dd>
                    </>
                  )}
                </dl>
                <div className="actions">
                  {s.status === 'ACTIVE' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAction({ kind: 'renew', subscription: s })}
                      >
                        {ru.renew}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAction({ kind: 'freeze', subscription: s })}
                      >
                        {ru.freeze}
                      </button>
                    </>
                  )}
                  {s.status === 'FROZEN' && (
                    <button
                      type="button"
                      onClick={() => setAction({ kind: 'unfreeze', subscription: s })}
                    >
                      {ru.unfreeze}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </State>
      {action && (
        <SubscriptionAction
          key={action.kind + ('subscription' in action ? action.subscription.id : '')}
          studentId={studentId}
          action={action}
          close={() => setAction(null)}
        />
      )}
    </>
  );
}
function SubscriptionAction({
  studentId,
  action,
  close,
}: {
  studentId: string;
  action: Action;
  close: () => void;
}) {
  const command = useCommand();
  const options = useOptions(studentId);
  const [page, setPage] = useState(1);
  const distribution = useQuery({
    queryKey: ['manager', 'ready-distributions', studentId, page],
    queryFn: ({ signal }) =>
      read(
        (o) => listManagerDistributions(studentId, { page, pageSize: 30, status: 'CONFIRMED' }, o),
        signal,
      ),
    enabled: action.kind === 'create' || action.kind === 'renew',
  });
  const ready =
    distribution.data?.items.filter(
      (d) =>
        !d.consumed &&
        d.ledgerPublicationId &&
        (action.kind !== 'renew' || d.enrollmentId === action.subscription.enrollmentId),
    ) ?? [];
  const title =
    action.kind === 'create'
      ? ru.newSubscription
      : action.kind === 'renew'
        ? ru.renew
        : action.kind === 'freeze'
          ? ru.freeze
          : ru.unfreeze;
  return (
    <Dialog
      title={title}
      close={() => {
        if (!command.busy) close();
      }}
    >
      {action.kind === 'freeze' ? (
        <FreezeForm
          busy={command.busy}
          error={command.error}
          submit={async (payload) => {
            const r = await command.run(payload, (o) =>
              freezeManagerSubscription(action.subscription.id, payload, o),
            );
            if (r) close();
          }}
        />
      ) : (
        <FormShell
          busy={command.busy}
          error={command.error}
          button={title}
          submit={async (f) => {
            if (action.kind === 'unfreeze') {
              const r = await command.run({ subscriptionId: action.subscription.id }, (o) =>
                unfreezeManagerSubscription(action.subscription.id, {}, o),
              );
              if (r) close();
            } else if (action.kind === 'create' || action.kind === 'renew') {
              const selected = ready.find((d) => d.id === text(f, 'distributionId'));
              if (!selected) return;
              const payload = { distributionId: selected.id, planId: selected.planId };
              const r =
                action.kind === 'create'
                  ? await command.run(payload, (o) =>
                      createManagerSubscription(studentId, payload, o),
                    )
                  : await command.run(payload, (o) =>
                      renewManagerSubscription(action.subscription.id, payload, o),
                    );
              if (r) close();
            }
          }}
        >
          {action.kind === 'unfreeze' ? (
            <>
              <p>{ru.unfreeze}</p>
              <Check name="acknowledge" label={ru.acknowledge} required />
            </>
          ) : (
            <>
              <p className="hint">{ru.readyHelp}</p>
              <State query={distribution}>
                {() =>
                  ready.length ? (
                    <Select
                      name="distributionId"
                      label={ru.readyDistribution}
                      required
                      options={ready.map((d) => ({
                        id: d.id,
                        label: `${options.data?.enrollments.find((e) => e.id === d.enrollmentId)?.label ?? ru.direction} · ${options.data?.plans.find((p) => p.id === d.planId)?.label ?? ru.plan} · ${formatMoney(d.amount, d.currency)} · ${d.id.slice(0, 8)}`,
                      }))}
                    />
                  ) : (
                    <p className="state">{ru.noDistribution}</p>
                  )
                }
              </State>
              <div className="pagination">
                <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  {ru.previous}
                </button>
                <span>
                  {ru.page} {page}
                </span>
                <button
                  type="button"
                  disabled={
                    !distribution.data ||
                    page * distribution.data.pageSize >= distribution.data.total
                  }
                  onClick={() => setPage(page + 1)}
                >
                  {ru.next}
                </button>
              </div>
            </>
          )}
        </FormShell>
      )}
    </Dialog>
  );
}
