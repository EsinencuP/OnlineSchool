import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { components } from '@online-school/api-contracts';
import { DenseTable, formatDateTime, formatMoneyAmount, Icon } from '@online-school/ui';
import type { TablePageIntent } from '@online-school/ui';
import { request, record } from './contract.js';
import { CabinLink } from './Home.js';
import { useEndpoint } from './hooks.js';
import { LoadState } from './Operations.js';
import { PaymentAction, savedPaymentIntent } from './PaymentAction.js';
import type { PaymentTask } from './PaymentAction.js';
import { usePayments } from './paymentCopy.js';
import { managerPaymentsLink } from './recordRoutes.js';

type Schemas = components['schemas'];
type Receipt = Schemas['ManagerPaymentDto'];
type Eligibility = Schemas['StaffActionEligibilityDto'];
type PaymentView = { zone: string; navigate: (url: string) => void };
const pageSize = 20;
const statuses = ['PENDING', 'AWAITING_APPROVAL', 'CONFIRMED', 'REJECTED'] as const;

function money(value: unknown, currency: unknown, locale: 'ru' | 'ro') {
  return typeof value === 'string' && typeof currency === 'string'
    ? (formatMoneyAmount(value, currency, locale) ?? '—')
    : '—';
}

function statusTone(status: string) {
  if (status === 'CONFIRMED') return 'mint';
  if (status === 'REJECTED') return 'rose';
  if (status === 'AWAITING_APPROVAL' || status === 'MANUAL_REVIEW') return 'peach';
  return 'violet';
}

function MoneyStatus({ status }: { status: Receipt['status'] | 'MANUAL_REVIEW' }) {
  const { text } = usePayments();
  return <span className={'cab-status cab-tone-' + statusTone(status)}>{text(status)}</span>;
}

function Back({
  to,
  navigate,
  text,
}: {
  to: string;
  navigate: (url: string) => void;
  text: string;
}) {
  return (
    <CabinLink className="cab-inline-link cab-payment-back" to={to} navigate={navigate}>
      {text}
    </CabinLink>
  );
}

function selectPage(change: (page: number) => void, page: number, intent: TablePageIntent) {
  change(intent === 'first' ? 1 : intent === 'previous' ? Math.max(1, page - 1) : page + 1);
}

export function ManagerPaymentDirectory({ navigate }: { navigate: (url: string) => void }) {
  const { text } = usePayments();
  const [search, setSearch] = useState('');
  const [cursors, setCursors] = useState<string[]>([]);
  const id = useId();
  const cursor = cursors.at(-1);
  const result = useEndpoint<Schemas['StudentListPageDto']>(
    'listManagerStudents',
    {},
    {
      limit: 25,
      sort: 'name',
      ...(search ? { search } : {}),
      ...(cursor ? { cursor } : {}),
    },
  );

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('search') ?? '').trim();
    if (value.length === 1) return;
    setSearch(value);
    setCursors([]);
  }

  return (
    <section className="cab-card cab-panel cab-payment-table">
      <div className="cab-panel-title">
        <h2>{text('chooseStudent')}</h2>
      </div>
      <form className="cab-payment-filter" onSubmit={filter}>
        <div className="cab-form-label">
          <label htmlFor={id}>{text('search')}</label>
          <input id={id} type="search" name="search" minLength={2} maxLength={100} />
        </div>
        <button type="submit" className="cab-button cab-secondary">
          {text('find')}
        </button>
      </form>
      {!result.data ? (
        <LoadState error={result.error} refreshing={result.pending} retry={result.refresh} />
      ) : (
        <DenseTable
          caption={text('students')}
          rows={result.data.items}
          rowKey={(row) => row.studentId}
          state={{ status: result.data.items.length ? 'ready' : 'empty' }}
          columns={[
            {
              id: 'student',
              header: text('student'),
              cell: (row) => (
                <CabinLink
                  className="cab-inline-link"
                  to={managerPaymentsLink(row.studentId)}
                  navigate={navigate}
                >
                  {row.fullName} <Icon name="arrow" size={15} />
                </CabinLink>
              ),
            },
            { id: 'phone', header: text('phone'), cell: (row) => row.maskedPhone ?? '—' },
          ]}
          pageInfo={{ total: null, hasMore: !!result.data.nextCursor, canPrevious: !!cursor }}
          onPageChange={(intent) => {
            const next = result.data?.nextCursor;
            if (intent === 'next' && next) setCursors((values) => [...values, next]);
            else if (intent === 'previous') setCursors((values) => values.slice(0, -1));
            else if (intent === 'first') setCursors([]);
          }}
        />
      )}
    </section>
  );
}

export function ManagerStudentPayments({
  studentId,
  zone,
  navigate,
}: PaymentView & { studentId: string }) {
  const { text, locale } = usePayments();
  const [page, setPage] = useState(1);
  const [distributionPage, setDistributionPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState<Receipt['status'] | ''>('');
  const [modal, setModal] = useState<PaymentTask | null>(null);
  const filterId = useId();
  const student = useEndpoint<Schemas['StudentCardDto']>('getManagerStudentCard', { studentId });
  const owned = student.data?.studentId === studentId;
  const payments = useEndpoint<Schemas['ManagerPaymentPageDto']>(
    owned ? 'listManagerPayments' : null,
    { studentId },
    { page, pageSize, ...(filter ? { status: filter } : {}) },
    revision,
  );
  const distributions = useEndpoint<Schemas['ManagerDistributionPageDto']>(
    owned ? 'listManagerDistributions' : null,
    { studentId },
    { page: distributionPage, pageSize },
    revision,
  );
  const create: PaymentTask = { operation: 'createManagerPayment', id: studentId };

  return (
    <div className="cab-lesson-layout">
      <Back to="/manager/payments" navigate={navigate} text={text('back')} />
      {!owned ? (
        <LoadState error={student.error} refreshing={student.pending} retry={student.refresh} />
      ) : (
        <>
          <div className="cab-page-title">
            <div>
              <h1>{student.data?.fullName}</h1>
              <p>{text('studentPayments')}</p>
            </div>
            <button
              type="button"
              className="cab-button cab-primary"
              onClick={() => setModal(create)}
            >
              {text(savedPaymentIntent(create) ? 'verify' : 'create')}
            </button>
          </div>
          <section className="cab-card cab-panel cab-payment-table">
            <div className="cab-panel-title">
              <h2>{text('payments')}</h2>
            </div>
            <div className="cab-form-label cab-payment-filter">
              <label htmlFor={filterId}>{text('status')}</label>
              <select
                id={filterId}
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as Receipt['status'] | '');
                  setPage(1);
                }}
              >
                <option value="">{text('all')}</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {text(status)}
                  </option>
                ))}
              </select>
            </div>
            {!payments.data ? (
              <LoadState
                error={payments.error}
                refreshing={payments.pending}
                retry={payments.refresh}
              />
            ) : (
              <DenseTable
                caption={text('payments')}
                rows={payments.data.items}
                rowKey={(row) => row.id}
                state={{ status: payments.data.items.length ? 'ready' : 'empty' }}
                columns={[
                  {
                    id: 'amount',
                    header: text('amount'),
                    cell: (row) => (
                      <CabinLink
                        className="cab-inline-link"
                        to={'/manager/payments/' + encodeURIComponent(row.id)}
                        navigate={navigate}
                      >
                        {money(row.amount, row.currency, locale)} <Icon name="arrow" size={15} />
                      </CabinLink>
                    ),
                  },
                  {
                    id: 'status',
                    header: text('status'),
                    cell: (row) => <MoneyStatus status={row.status} />,
                  },
                  {
                    id: 'received',
                    header: text('date'),
                    cell: (row) => formatDateTime(row.receivedAt, locale, zone) ?? '—',
                  },
                  {
                    id: 'method',
                    header: text('method'),
                    cell: (row) => (row.method ? text(row.method) : '—'),
                  },
                ]}
                pageInfo={{
                  total: payments.data.total,
                  hasMore: page * pageSize < payments.data.total,
                  canPrevious: page > 1,
                }}
                onPageChange={(intent) => selectPage(setPage, page, intent)}
              />
            )}
          </section>
          <section className="cab-card cab-panel cab-payment-table">
            <div className="cab-panel-title">
              <h2>{text('allocations')}</h2>
            </div>
            {!distributions.data ? (
              <LoadState
                error={distributions.error}
                refreshing={distributions.pending}
                retry={distributions.refresh}
              />
            ) : (
              <DenseTable
                caption={text('allocations')}
                rows={distributions.data.items}
                rowKey={(row) => row.id}
                state={{ status: distributions.data.items.length ? 'ready' : 'empty' }}
                columns={[
                  {
                    id: 'amount',
                    header: text('amount'),
                    cell: (row) => money(row.amount, row.currency, locale),
                  },
                  {
                    id: 'status',
                    header: text('status'),
                    cell: (row) => <MoneyStatus status={row.status} />,
                  },
                  {
                    id: 'ledger',
                    header: text('ledger'),
                    cell: (row) =>
                      row.consumed
                        ? text('used')
                        : row.ledgerPublicationId
                          ? text('published')
                          : row.status === 'REJECTED'
                            ? '—'
                            : text('unpublished'),
                  },
                  {
                    id: 'correction',
                    header: text('correction'),
                    cell: (row) => {
                      const task: PaymentTask = {
                        operation: 'proposeAllocationCorrection',
                        id: row.id,
                        studentId,
                        currency: row.currency,
                      };
                      return (row.status === 'CONFIRMED' && row.ledgerPublicationId) ||
                        savedPaymentIntent(task) ? (
                        <button
                          type="button"
                          className="cab-text-button"
                          onClick={() => setModal(task)}
                        >
                          {text(savedPaymentIntent(task) ? 'verify' : 'correct')}
                        </button>
                      ) : (
                        '—'
                      );
                    },
                  },
                ]}
                pageInfo={{
                  total: distributions.data.total,
                  hasMore: distributionPage * pageSize < distributions.data.total,
                  canPrevious: distributionPage > 1,
                }}
                onPageChange={(intent) => selectPage(setDistributionPage, distributionPage, intent)}
              />
            )}
          </section>
        </>
      )}
      {modal && (
        <PaymentAction
          key={modal.operation + modal.id}
          task={modal}
          zone={zone}
          subject={student.data?.fullName ?? text('student')}
          navigate={navigate}
          close={() => setModal(null)}
          onDone={() => setRevision((value) => value + 1)}
          verify={async (signal) => {
            await request(
              modal.operation === 'createManagerPayment'
                ? 'listManagerPayments'
                : 'listManagerDistributions',
              { params: { studentId }, query: { page: 1, pageSize }, signal },
            );
            setRevision((value) => value + 1);
            return { current: true };
          }}
        />
      )}
    </div>
  );
}

function ReceiptFacts({ values }: { values: [string, string | null | undefined][] }) {
  return (
    <dl className="cab-payment-facts">
      {values
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function ManagerReceipt({ id, zone, navigate }: PaymentView & { id: string }) {
  const { text, locale } = usePayments();
  const [task, setTask] = useState<PaymentTask | null>(null);
  const result = useEndpoint<Receipt>('getManagerPayment', { paymentId: id });
  const row = result.data?.id === id ? result.data : null;
  const student = useEndpoint<Schemas['StudentCardDto']>(row ? 'getManagerStudentCard' : null, {
    studentId: row?.studentId ?? '',
  });
  const eligibility = useEndpoint<Eligibility>(
    row?.status === 'PENDING' ? 'getManagerPaymentApprovalEligibility' : null,
    { paymentId: id },
  );
  const inScope =
    eligibility.data?.objectId === id && eligibility.data.action === 'payment.request-approval';
  const canSubmit = row?.status === 'PENDING' && inScope && eligibility.data?.allowed === true;
  const confirmed = row?.status === 'CONFIRMED';
  const available = [
    [canSubmit, 'confirmManagerPayment', 'submit'],
    [row?.status === 'PENDING' && inScope, 'rejectManagerPayment', 'reject'],
    [confirmed, 'prepareManagerPaymentSubscription', 'prepare'],
    [confirmed, 'allocateManagerPayment', 'allocate'],
  ] as const;
  const label = [
    money(row?.amount, row?.currency, locale),
    student.data?.fullName ?? text('contact'),
  ].join(' · ');

  function refresh() {
    result.refresh();
    eligibility.refresh();
  }

  return (
    <div className="cab-lesson-layout">
      <Back
        to={row ? managerPaymentsLink(row.studentId) : '/manager/payments'}
        navigate={navigate}
        text={text('back')}
      />
      {!row ? (
        <LoadState error={result.error} refreshing={result.pending} retry={result.refresh} />
      ) : (
        <section className="cab-card cab-panel cab-payment-detail">
          <div className="cab-panel-title">
            <h2>{text('receipt')}</h2>
            <MoneyStatus status={row.status} />
          </div>
          <p className="cab-payment-amount">{money(row.amount, row.currency, locale)}</p>
          <ReceiptFacts
            values={[
              [text('contact'), student.data?.fullName],
              [text('date'), formatDateTime(row.receivedAt, locale, zone)],
              [text('method'), row.method ? text(row.method) : null],
              [text('purpose'), row.purpose ? text(row.purpose) : null],
              [text('ref'), row.externalRef],
              [text('reason'), row.rejectionReason],
            ]}
          />
          {row.status === 'PENDING' && !canSubmit && (
            <div className="cab-empty" role="status">
              {text(eligibility.pending ? 'loading' : 'blocked')}
              {!eligibility.pending && (
                <button type="button" className="cab-text-button" onClick={refresh}>
                  {text('verify')}
                </button>
              )}
            </div>
          )}
          <div className="cab-form-actions">
            {available.map(([allowed, operation, name]) => {
              const next: PaymentTask = {
                id,
                operation,
                studentId: row.studentId,
                currency: row.currency,
              };
              const unknown = savedPaymentIntent(next);
              return allowed || unknown ? (
                <button
                  type="button"
                  key={operation}
                  className={
                    'cab-button ' +
                    (operation === 'confirmManagerPayment' && !unknown
                      ? 'cab-primary'
                      : 'cab-secondary')
                  }
                  onClick={() => setTask(next)}
                >
                  {text(unknown ? 'verify' : name)}
                </button>
              ) : null;
            })}
          </div>
        </section>
      )}
      {task && (
        <PaymentAction
          key={task.operation}
          task={task}
          zone={zone}
          navigate={navigate}
          subject={label}
          close={() => setTask(null)}
          onDone={refresh}
          verify={async (signal, recipient) => {
            const current = await request<Receipt>('getManagerPayment', {
              params: { paymentId: id },
              signal,
            });
            if (current.id !== id) return { current: false };
            if (
              (task.operation === 'confirmManagerPayment' &&
                current.status === 'AWAITING_APPROVAL') ||
              (task.operation === 'rejectManagerPayment' && current.status === 'REJECTED')
            )
              return { current: true, result: record(current) };
            const allocation =
              task.operation === 'allocateManagerPayment' ||
              task.operation === 'prepareManagerPaymentSubscription';
            const target = recipient ?? task.studentId;
            if (allocation && target) {
              await request('listManagerDistributions', {
                params: { studentId: target },
                signal,
              });
              return { current: current.status === 'CONFIRMED' };
            }
            return { current: current.status === 'PENDING' };
          }}
        />
      )}
    </div>
  );
}

export function DirectorPayment({ id, zone, navigate }: PaymentView & { id: string }) {
  const { text, locale } = usePayments();
  const [task, setTask] = useState<PaymentTask | null>(null);
  const [completion, setCompletion] = useState<'CONFIRMED' | 'REJECTED' | null>(null);
  const decision = useEndpoint<Schemas['DecisionDetailDto']>(
    completion ? null : 'getDirectorDecision',
    { kind: 'PAYMENT', id },
  );
  const eligibility = useEndpoint<Eligibility>(
    completion ? null : 'getDirectorPaymentConfirmationEligibility',
    { id },
  );
  const row = decision.data?.id === id && decision.data.kind === 'PAYMENT' ? decision.data : null;
  const facts = record(row?.facts);
  const scoped = eligibility.data?.objectId === id && eligibility.data.action === 'payment.confirm';
  const approval = row?.commands.some((entry) =>
    ['confirmPayment', 'directorConfirmPayment'].includes(entry.operationId),
  );
  const allowed =
    !!row && row.ready === true && approval && scoped && eligibility.data?.allowed === true;
  const confirm: PaymentTask = { operation: 'directorConfirmPayment', id };
  const reject: PaymentTask = { operation: 'directorRejectPayment', id };
  const status =
    scoped && eligibility.data?.reason === 'PAYMENT_ALREADY_CONFIRMED'
      ? 'CONFIRMED'
      : scoped && eligibility.data?.reason === 'PAYMENT_NOT_PENDING'
        ? 'REJECTED'
        : null;
  const shown = completion ?? status;
  const label = [money(row?.amount, row?.currency, locale), row?.studentName]
    .filter(Boolean)
    .join(' · ');
  const detail = (key: string) => (typeof facts[key] === 'string' ? String(facts[key]) : null);
  const receivedAt = detail('receivedAt');

  return (
    <div className="cab-lesson-layout">
      <Back to="/director/decisions" navigate={navigate} text={text('directorQueue')} />
      {shown ? (
        <section className="cab-card cab-panel">
          <div className="cab-panel-title">
            <h2>{text('receipt')}</h2>
            <MoneyStatus status={shown} />
          </div>
        </section>
      ) : row ? (
        <section className="cab-card cab-panel cab-payment-detail">
          <div className="cab-panel-title">
            <h2>{text('receipt')}</h2>
            <MoneyStatus status="AWAITING_APPROVAL" />
          </div>
          <p className="cab-payment-amount">{money(row.amount, row.currency, locale)}</p>
          <ReceiptFacts
            values={[
              [text('contact'), row.studentName],
              [text('requestedBy'), row.requestedBy],
              [text('requestedAt'), formatDateTime(row.requestedAt, locale, zone)],
              [text('date'), receivedAt ? formatDateTime(receivedAt, locale, zone) : null],
              [text('ref'), detail('externalReference')],
              [text('note'), detail('managerNote')],
            ]}
          />
          {!allowed && (
            <div className="cab-empty" role="status">
              {text(
                eligibility.pending
                  ? 'loading'
                  : eligibility.data?.reason === 'CLOSED_PERIOD'
                    ? 'noPeriod'
                    : 'blocked',
              )}
              {!eligibility.pending && (
                <button
                  type="button"
                  className="cab-text-button"
                  onClick={() => {
                    decision.refresh();
                    eligibility.refresh();
                  }}
                >
                  {text('verify')}
                </button>
              )}
            </div>
          )}
          <div className="cab-form-actions">
            {allowed || savedPaymentIntent(confirm) ? (
              <button
                type="button"
                className="cab-button cab-primary"
                onClick={() => setTask(confirm)}
              >
                {text(savedPaymentIntent(confirm) ? 'verify' : 'approve')}
              </button>
            ) : null}
            {scoped || savedPaymentIntent(reject) ? (
              <button
                type="button"
                className="cab-button cab-secondary"
                onClick={() => setTask(reject)}
              >
                {text(savedPaymentIntent(reject) ? 'verify' : 'reject')}
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <LoadState
          error={decision.error ?? eligibility.error}
          refreshing={decision.pending || eligibility.pending}
          retry={() => {
            decision.refresh();
            eligibility.refresh();
          }}
        />
      )}
      {task && (
        <PaymentAction
          key={task.operation}
          task={task}
          zone={zone}
          navigate={navigate}
          subject={label}
          close={() => setTask(null)}
          onDone={(result) => {
            if (result.outcome === 'CONFIRMED' || result.outcome === 'REJECTED')
              setCompletion(result.outcome);
          }}
          verify={async (signal) => {
            const current = await request<Eligibility>(
              'getDirectorPaymentConfirmationEligibility',
              { params: { id }, signal },
            );
            if (current.objectId !== id || current.action !== 'payment.confirm')
              return { current: false };
            if (
              task.operation === 'directorConfirmPayment' &&
              current.reason === 'PAYMENT_ALREADY_CONFIRMED'
            )
              return { current: true, result: { id, outcome: 'CONFIRMED' } };
            if (
              task.operation === 'directorRejectPayment' &&
              current.reason === 'PAYMENT_NOT_PENDING'
            )
              return { current: true, result: { id, outcome: 'REJECTED' } };
            return {
              current:
                task.operation === 'directorConfirmPayment'
                  ? current.allowed === true
                  : current.reason !== 'PAYMENT_ALREADY_CONFIRMED' &&
                    current.reason !== 'PAYMENT_NOT_PENDING',
            };
          }}
        />
      )}
    </div>
  );
}

export function ManagerCorrection({ id, zone, navigate }: PaymentView & { id: string }) {
  const { text, locale } = usePayments();
  const result = useEndpoint<Schemas['AllocationCorrectionDto']>('getAllocationCorrection', { id });
  const row = result.data?.id === id ? result.data : null;
  return (
    <div className="cab-lesson-layout">
      <Back to="/manager/payments" navigate={navigate} text={text('back')} />
      {!row ? (
        <LoadState error={result.error} refreshing={result.pending} retry={result.refresh} />
      ) : (
        <section className="cab-card cab-panel cab-payment-detail">
          <div className="cab-panel-title">
            <h2>{text('correction')}</h2>
            <MoneyStatus status={row.status} />
          </div>
          <ReceiptFacts
            values={[
              [text('amount'), row.amount],
              [text('reason'), row.reason],
              [text('requestedAt'), formatDateTime(row.proposedAt, locale, zone)],
            ]}
          />
        </section>
      )}
    </div>
  );
}

export type PaymentRoute =
  { kind: 'directory' } | { kind: 'student' | 'receipt' | 'decision' | 'correction'; id: string };

export default function PaymentRoutePanel({
  route,
  zone,
  navigate,
}: PaymentView & { route: PaymentRoute }) {
  switch (route.kind) {
    case 'directory':
      return <ManagerPaymentDirectory navigate={navigate} />;
    case 'student':
      return <ManagerStudentPayments studentId={route.id} zone={zone} navigate={navigate} />;
    case 'receipt':
      return <ManagerReceipt id={route.id} zone={zone} navigate={navigate} />;
    case 'decision':
      return <DirectorPayment id={route.id} zone={zone} navigate={navigate} />;
    case 'correction':
      return <ManagerCorrection id={route.id} zone={zone} navigate={navigate} />;
  }
}
