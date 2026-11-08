import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  listManagerPayments,
  listManagerDistributions,
  createManagerPayment,
  confirmManagerPayment,
  rejectManagerPayment,
  allocateManagerPayment,
  prepareManagerPaymentSubscription,
} from '@online-school/api-contracts';
import type { ManagerPaymentDto, ListManagerPaymentsParams } from '@online-school/api-contracts';
import { read } from '../../api/client.js';
import { useCommand } from '../../hooks/use-command.js';
import { useOptions } from '../../hooks/use-options.js';
import { useManager } from '../../session.js';
import {
  Badge,
  State,
  Dialog,
  FormShell,
  Input,
  Select,
  TextArea,
  Check,
  text,
  enumOptions,
  ErrorBox,
} from '../../components/ui.js';
import { MoneyInput, PaymentForm } from '../../components/business-forms.js';
import { formatMoney, validMoney } from '../../lib/money.js';
import { displayTime, localToIso } from '../../lib/time.js';
import { ru, label } from '../../i18n/ru.js';
type Action =
  | { kind: 'create' }
  | { kind: 'confirm' | 'reject' | 'allocate' | 'prepare'; payment: ManagerPaymentDto };
export default function Payments({ studentId }: { studentId: string }) {
  const me = useManager();
  const [page, setPage] = useState(1);
  const [distributionPage, setDistributionPage] = useState(1);
  const [status, setStatus] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const query = useQuery({
    queryKey: ['manager', 'payments', studentId, page, status],
    queryFn: ({ signal }) =>
      read(
        (o) =>
          listManagerPayments(
            studentId,
            {
              page,
              pageSize: 20,
              ...(status
                ? { status: status as NonNullable<ListManagerPaymentsParams['status']> }
                : {}),
            },
            o,
          ),
        signal,
      ),
  });
  const distributions = useQuery({
    queryKey: ['manager', 'distributions', studentId, distributionPage],
    queryFn: ({ signal }) =>
      read(
        (o) => listManagerDistributions(studentId, { page: distributionPage, pageSize: 20 }, o),
        signal,
      ),
  });
  return (
    <>
      <div className="section-heading">
        <h2>{ru.payments}</h2>
        <button className="primary" type="button" onClick={() => setAction({ kind: 'create' })}>
          + {ru.registerPayment}
        </button>
      </div>
      <p className="hint">{ru.allocationHelp}</p>
      <Select
        name="paymentStatus"
        label={ru.status}
        value={status}
        options={enumOptions(['PENDING', 'AWAITING_APPROVAL', 'CONFIRMED', 'REJECTED'])}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
      />
      <State query={query} empty={query.data?.items.length === 0}>
        {(d) => (
          <>
            <ul className="record-cards">
              {d.items.map((p) => (
                <li key={p.id}>
                  <div className="section-heading">
                    <strong>{formatMoney(p.amount, p.currency)}</strong>
                    <Badge value={p.status} />
                  </div>
                  <p>
                    {displayTime(p.receivedAt, me.timezone)} ·{' '}
                    {p.method ? label(p.method) : ru.dash}
                  </p>
                  <p>
                    {p.purpose ? label(p.purpose) : ru.dash} · {p.externalRef ?? ru.dash}
                  </p>
                  {p.rejectionReason && <p className="plain-text">{p.rejectionReason}</p>}
                  <div className="actions">
                    {p.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => setAction({ kind: 'confirm', payment: p })}
                      >
                        {ru.sendApproval}
                      </button>
                    )}
                    {(p.status === 'PENDING' || p.status === 'AWAITING_APPROVAL') && (
                      <button
                        type="button"
                        onClick={() => setAction({ kind: 'reject', payment: p })}
                      >
                        {ru.rejectPayment}
                      </button>
                    )}
                    {p.status === 'CONFIRMED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setAction({ kind: 'prepare', payment: p })}
                        >
                          {ru.preparePackage}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAction({ kind: 'allocate', payment: p })}
                        >
                          {ru.allocate}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="pagination">
              <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
                {ru.previous}
              </button>
              <span>
                {ru.page} {page}
              </span>
              <button
                type="button"
                disabled={page * d.pageSize >= d.total}
                onClick={() => setPage(page + 1)}
              >
                {ru.next}
              </button>
            </div>
          </>
        )}
      </State>
      <section className="panel">
        <h2>{ru.allocations}</h2>
        <State query={distributions} empty={distributions.data?.items.length === 0}>
          {(d) => (
            <>
              <ul className="record-list">
                {d.items.map((a) => (
                  <li key={a.id}>
                    <strong>{formatMoney(a.amount, a.currency)}</strong>
                    <Badge value={a.status} />
                    <span>
                      {a.consumed
                        ? ru.used
                        : a.ledgerPublicationId
                          ? ru.published
                          : ru.pendingApproval}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="pagination">
                <button
                  type="button"
                  disabled={distributionPage === 1}
                  onClick={() => setDistributionPage(distributionPage - 1)}
                >
                  {ru.previous}
                </button>
                <span>
                  {ru.page} {distributionPage}
                </span>
                <button
                  type="button"
                  disabled={distributionPage * d.pageSize >= d.total}
                  onClick={() => setDistributionPage(distributionPage + 1)}
                >
                  {ru.next}
                </button>
              </div>
            </>
          )}
        </State>
      </section>
      {action && (
        <PaymentAction
          key={action.kind + ('payment' in action ? action.payment.id : '')}
          studentId={studentId}
          action={action}
          close={() => setAction(null)}
        />
      )}
    </>
  );
}
function PaymentAction({
  studentId,
  action,
  close,
}: {
  studentId: string;
  action: Action;
  close: () => void;
}) {
  const me = useManager();
  const command = useCommand();
  const options = useOptions(studentId);
  const [validation, setValidation] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const [complete, setComplete] = useState(false);
  const title =
    action.kind === 'create'
      ? ru.registerPayment
      : action.kind === 'confirm'
        ? ru.sendApproval
        : action.kind === 'reject'
          ? ru.rejectPayment
          : action.kind === 'prepare'
            ? ru.preparePackage
            : ru.allocate;
  return (
    <Dialog
      title={title}
      close={() => {
        if (!command.busy) close();
      }}
    >
      {complete ? (
        <>
          <p role="status">
            {action.kind === 'confirm'
              ? ru.pendingApproval
              : action.kind === 'create' || action.kind === 'reject'
                ? ru.saved
                : ru.allocationPending}
          </p>
          <button type="button" onClick={close}>
            {ru.done}
          </button>
        </>
      ) : action.kind === 'create' ? (
        <PaymentForm
          timezone={me.timezone}
          busy={command.busy}
          error={command.error}
          submit={async (payload) => {
            const r = await command.run(payload, (o) =>
              createManagerPayment(studentId, payload, o),
            );
            if (r) setComplete(true);
          }}
        />
      ) : (
        <FormShell
          busy={command.busy}
          error={command.error}
          button={title}
          submit={async (f) => {
            if (action.kind === 'confirm') {
              const r = await command.run({ paymentId: action.payment.id }, (o) =>
                confirmManagerPayment(action.payment.id, {}, o),
              );
              if (r) setComplete(true);
            }
            if (action.kind === 'reject') {
              const payload = { reason: text(f, 'reason') };
              const r = await command.run(payload, (o) =>
                rejectManagerPayment(action.payment.id, payload, o),
              );
              if (r) setComplete(true);
            }
            if (action.kind === 'allocate' || action.kind === 'prepare') {
              const amount = text(f, 'amount');
              if (!validMoney(amount)) {
                setValidation(true);
                return;
              }
              setValidation(false);
              if (action.kind === 'allocate') {
                const payload = { subscriptionId: text(f, 'subscriptionId'), amount };
                const r = await command.run(payload, (o) =>
                  allocateManagerPayment(action.payment.id, payload, o),
                );
                if (r) setComplete(true);
              } else {
                const local = text(f, 'startsAt');
                const startsAt = local ? localToIso(local, me.timezone) : null;
                if (local && !startsAt) {
                  setTimeError(true);
                  return;
                }
                setTimeError(false);
                const payload = {
                  enrollmentId: text(f, 'enrollmentId'),
                  planId: text(f, 'planId'),
                  amount,
                  ...(startsAt ? { startsAt } : {}),
                };
                const r = await command.run(payload, (o) =>
                  prepareManagerPaymentSubscription(action.payment.id, payload, o),
                );
                if (r) setComplete(true);
              }
            }
          }}
        >
          {action.kind === 'confirm' && (
            <>
              <p>{ru.paymentApprovalConfirm}</p>
              <Check name="acknowledge" label={ru.acknowledge} required />
            </>
          )}
          {action.kind === 'reject' && (
            <>
              <p>{ru.rejectPaymentWarning}</p>
              <TextArea name="reason" label={ru.reason} required minLength={3} maxLength={500} />
              <Check name="acknowledge" label={ru.acknowledge} required />
            </>
          )}
          {(action.kind === 'prepare' || action.kind === 'allocate') && (
            <>
              <p className="hint">{ru.directorOnly}</p>
              <State query={options}>
                {(o) => (
                  <>
                    {action.kind === 'prepare' ? (
                      <>
                        <Select
                          name="enrollmentId"
                          label={ru.direction}
                          options={o.enrollments}
                          required
                        />
                        <Select
                          name="planId"
                          label={ru.plan}
                          options={o.plans.map((p) => ({
                            id: p.id,
                            label: `${p.label} · ${p.lessonCount} · ${formatMoney(p.price, p.currency)}`,
                          }))}
                          required
                        />
                        <Input name="startsAt" label={ru.start} type="datetime-local" />
                      </>
                    ) : (
                      <Select
                        name="subscriptionId"
                        label={ru.subscriptions}
                        options={o.financialSubscriptions.map((s) => ({
                          id: s.id,
                          label: `${s.label} · ${displayTime(s.startsAt, me.timezone)}`,
                        }))}
                        required
                      />
                    )}
                  </>
                )}
              </State>
              <MoneyInput />
              <ErrorBox
                error={
                  validation
                    ? { code: 'VALIDATION_FAILED', status: 422, message: ru.invalidMoney }
                    : timeError
                      ? { code: 'VALIDATION_FAILED', status: 422, message: ru.invalidTime }
                      : null
                }
              />
            </>
          )}
        </FormShell>
      )}
    </Dialog>
  );
}
