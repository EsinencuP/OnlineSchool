import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { subscribeSession } from '@online-school/account-ui';
import type { components } from '@online-school/api-contracts';
import { Dialog, localDateTimeToIso } from '@online-school/ui';
import { CabinetError, record, request } from './contract.js';
import type { Details } from './contract.js';
import { CabinLink } from './Home.js';
import { useEndpoint } from './hooks.js';
import { usePayments } from './paymentCopy.js';
import type { PaymentMessage } from './paymentCopy.js';

type Schemas = components['schemas'];
export type PaymentOperation =
  | 'createManagerPayment'
  | 'confirmManagerPayment'
  | 'rejectManagerPayment'
  | 'prepareManagerPaymentSubscription'
  | 'allocateManagerPayment'
  | 'proposeAllocationCorrection'
  | 'directorConfirmPayment'
  | 'directorRejectPayment';

export type PaymentTask = {
  operation: PaymentOperation;
  id: string;
  studentId?: string;
  currency?: string;
};

const labels: Record<PaymentOperation, readonly [PaymentMessage, PaymentMessage, PaymentMessage]> =
  {
    createManagerPayment: ['create', 'createHint', 'created'],
    confirmManagerPayment: ['submit', 'submitHint', 'submitted'],
    rejectManagerPayment: ['reject', 'rejectHint', 'rejected'],
    prepareManagerPaymentSubscription: ['prepare', 'prepareHint', 'proposed'],
    allocateManagerPayment: ['allocate', 'allocateHint', 'proposed'],
    proposeAllocationCorrection: ['correct', 'correctHint', 'corrected'],
    directorConfirmPayment: ['approve', 'approveHint', 'confirmed'],
    directorRejectPayment: ['reject', 'rejectHint', 'rejected'],
  };

type Intent = { key: string; body: Record<string, string>; recipient?: string };
const pending = new Map<string, Intent>();
subscribeSession(() => pending.clear());

const methods = ['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE'] as const;
const purposes = ['FIRST_PAYMENT', 'RENEWAL', 'OTHER'] as const;
const amountFormat = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,4})?$/;

function payload(task: PaymentTask, values: FormData, zone: string): Record<string, string> | null {
  const value = (name: string) => String(values.get(name) ?? '').trim();
  const { operation } = task;
  if (operation === 'confirmManagerPayment' || operation === 'directorConfirmPayment') return {};
  if (operation === 'rejectManagerPayment' || operation === 'directorRejectPayment') {
    const reason = value('reason');
    return reason.length >= 3 && reason.length <= 500 ? { reason } : null;
  }
  const amount = value('amount').replace(',', '.');
  if (!amountFormat.test(amount) || !/[1-9]/.test(amount)) return null;
  if (operation === 'createManagerPayment') {
    const receivedAt = localDateTimeToIso(value('receivedAt'), zone);
    const method = value('method');
    const purpose = value('purpose');
    if (
      !receivedAt ||
      !methods.some((entry) => entry === method) ||
      !purposes.some((entry) => entry === purpose)
    )
      return null;
    const ref = value('externalRef');
    const note = value('note');
    return {
      amount,
      currency: 'MDL',
      method,
      purpose,
      receivedAt,
      ...(ref ? { externalRef: ref } : {}),
      ...(note ? { note } : {}),
    };
  }
  if (operation === 'allocateManagerPayment') {
    const subscriptionId = value('subscriptionId');
    return subscriptionId ? { amount, subscriptionId } : null;
  }
  if (operation === 'proposeAllocationCorrection') {
    const reason = value('reason');
    const subscriptionId = value('subscriptionId');
    return reason.length >= 5 && reason.length <= 500
      ? { amount, reason, ...(subscriptionId ? { targetSubscriptionId: subscriptionId } : {}) }
      : null;
  }
  const enrollmentId = value('enrollmentId');
  const planId = value('planId');
  const local = value('startsAt');
  const startsAt = local ? localDateTimeToIso(local, zone) : null;
  return enrollmentId && planId && (!local || startsAt)
    ? { amount, enrollmentId, planId, ...(startsAt ? { startsAt } : {}) }
    : null;
}

function verified(task: PaymentTask, result: Details) {
  const { operation, id } = task;
  if (operation === 'createManagerPayment')
    return typeof result.id === 'string' && result.studentId === id && result.status === 'PENDING';
  if (operation === 'directorConfirmPayment' || operation === 'directorRejectPayment')
    return (
      result.id === id &&
      result.kind === 'PAYMENT' &&
      result.outcome === (operation === 'directorConfirmPayment' ? 'CONFIRMED' : 'REJECTED')
    );
  if (operation === 'confirmManagerPayment' || operation === 'rejectManagerPayment')
    return (
      result.id === id &&
      result.status === (operation === 'confirmManagerPayment' ? 'AWAITING_APPROVAL' : 'REJECTED')
    );
  if (operation === 'proposeAllocationCorrection')
    return (
      typeof result.id === 'string' &&
      result.sourceDistributionId === id &&
      result.status === 'PENDING'
    );
  return (
    typeof result.id === 'string' &&
    result.paymentId === id &&
    result.status === 'AWAITING_APPROVAL'
  );
}

function MoneyField({ currency }: { currency: string }) {
  const { text } = usePayments();
  return (
    <label className="cab-form-label">
      <span>
        {text('amount')} · {currency}
      </span>
      <input name="amount" type="text" inputMode="decimal" required maxLength={17} />
    </label>
  );
}

function PaymentFields({ task, zone }: { task: PaymentTask; zone: string }) {
  const { text } = usePayments();
  const { operation } = task;
  const allocating =
    operation === 'prepareManagerPaymentSubscription' || operation === 'allocateManagerPayment';
  const correct = operation === 'proposeAllocationCorrection';
  const [recipient, setRecipient] = useState(task.studentId ?? '');
  const directory = useEndpoint<Schemas['ManagerOptionsDto']>(
    allocating ? 'getManagerOptions' : null,
  );
  const options = useEndpoint<Schemas['ManagerOptionsDto']>(
    (allocating || correct) && recipient ? 'getManagerOptions' : null,
    {},
    { studentId: recipient },
  );
  const currency = task.currency ?? 'MDL';
  if (operation === 'confirmManagerPayment' || operation === 'directorConfirmPayment') return null;
  if (operation === 'rejectManagerPayment' || operation === 'directorRejectPayment')
    return (
      <label className="cab-form-label">
        <span>{text('reason')}</span>
        <textarea name="reason" required minLength={3} maxLength={500} rows={4} />
      </label>
    );
  if (operation === 'createManagerPayment') {
    return (
      <>
        <MoneyField currency={currency} />
        <label className="cab-form-label">
          <span>{text('method')}</span>
          <select name="method" required>
            <option value="">{text('select')}</option>
            {methods.map((method) => (
              <option key={method} value={method}>
                {text(method)}
              </option>
            ))}
          </select>
        </label>
        <label className="cab-form-label">
          <span>{text('purpose')}</span>
          <select name="purpose" required>
            <option value="">{text('select')}</option>
            {purposes.map((purpose) => (
              <option key={purpose} value={purpose}>
                {text(purpose)}
              </option>
            ))}
          </select>
        </label>
        <label className="cab-form-label">
          <span>{text('date')}</span>
          <input type="datetime-local" name="receivedAt" required />
          <small>
            {text('zonedTime')} · {zone}
          </small>
        </label>
        <label className="cab-form-label">
          <span>{text('ref')}</span>
          <input name="externalRef" maxLength={100} />
        </label>
        <label className="cab-form-label">
          <span>{text('note')}</span>
          <textarea name="note" rows={3} maxLength={500} />
        </label>
      </>
    );
  }
  const subscriptions =
    options.data?.financialSubscriptions.filter((row) => row.currency === currency) ?? [];
  const plans = options.data?.plans.filter((plan) => plan.currency === currency) ?? [];
  const enrollments = options.data?.enrollments ?? [];
  const prepare = operation === 'prepareManagerPaymentSubscription';
  const names = directory.data?.students ?? [];
  const choices = names.some(({ id }) => id === recipient)
    ? names
    : recipient
      ? [{ id: recipient, label: text('contact') }, ...names]
      : names;
  return (
    <>
      <MoneyField currency={currency} />
      {allocating && (
        <label className="cab-form-label">
          <span>{text('recipient')}</span>
          <select
            name="recipient"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            required
          >
            <option value="">{text('select')}</option>
            {choices.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {prepare ? (
        <>
          <label className="cab-form-label">
            <span>{text('enrollment')}</span>
            <select key={recipient + ':enrollments'} name="enrollmentId" required>
              <option value="">
                {text(options.pending ? 'loading' : enrollments.length ? 'select' : 'noOptions')}
              </option>
              {enrollments.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="cab-form-label">
            <span>{text('plan')}</span>
            <select key={recipient + ':plans'} name="planId" required>
              <option value="">
                {text(options.pending ? 'loading' : plans.length ? 'select' : 'noOptions')}
              </option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label} · {plan.price} {plan.currency}
                </option>
              ))}
            </select>
          </label>
          <label className="cab-form-label">
            <span>{text('startsAt')}</span>
            <input type="datetime-local" name="startsAt" />
            <small>
              {text('zonedTime')} · {zone}
            </small>
          </label>
        </>
      ) : (
        <label className="cab-form-label">
          <span>{text(correct ? 'target' : 'subscription')}</span>
          <select key={recipient} name="subscriptionId" required={!correct}>
            <option value="">
              {text(
                correct
                  ? 'returnToReceipt'
                  : options.pending
                    ? 'loading'
                    : subscriptions.length
                      ? 'select'
                      : 'noOptions',
              )}
            </option>
            {subscriptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {correct && (
        <label className="cab-form-label">
          <span>{text('reason')}</span>
          <textarea name="reason" required minLength={5} maxLength={500} rows={3} />
        </label>
      )}
      {options.error != null && (
        <button type="button" className="cab-text-button" onClick={options.refresh}>
          {text('verify')}
        </button>
      )}
    </>
  );
}

function failure(error: unknown): PaymentMessage {
  if (error instanceof CabinetError) {
    const { code } = error.issue;
    if (code === 'CLOSED_PERIOD') return 'noPeriod';
    if (['INVALID_INPUT', 'INVALID_MONEY', 'INVALID_RECEIVED_AT'].includes(code)) return 'invalid';
  }
  return 'blocked';
}

export function savedPaymentIntent(task: PaymentTask) {
  return pending.has(task.operation + ':' + task.id);
}

export function PaymentAction({
  task,
  zone,
  subject,
  close,
  onDone,
  navigate,
  verify,
}: {
  task: PaymentTask;
  zone: string;
  subject: string;
  close: () => void;
  onDone: (result: Details) => void;
  navigate: (url: string) => void;
  verify: (
    signal: AbortSignal,
    recipient?: string,
  ) => Promise<{ current: boolean; result?: Details }>;
}) {
  const { text } = usePayments();
  const [title, hint, resultMessage] = labels[task.operation];
  const scope = task.operation + ':' + task.id;
  const [context] = useState(subject);
  const [intent, setIntent] = useState(() => pending.get(scope) ?? null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [feedback, setFeedback] = useState<PaymentMessage | null>(null);
  const [result, setResult] = useState<Details | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  function done(value: Details) {
    pending.delete(scope);
    setIntent(null);
    setResult(value);
    onDone(value);
  }

  async function run(command: Intent, checking: boolean) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    setBusy(true);
    setFeedback(null);
    setChecked(false);
    if (!checking) pending.set(scope, command);
    try {
      if (checking) {
        const check = await verify(signal, command.recipient);
        if (controller.signal.aborted) return;
        if (check.result) done(check.result);
        else {
          setChecked(check.current);
          setFeedback(check.current ? 'verified' : 'blocked');
        }
      } else {
        const param =
          task.operation === 'createManagerPayment'
            ? 'studentId'
            : task.operation.startsWith('director') ||
                task.operation === 'proposeAllocationCorrection'
              ? 'id'
              : 'paymentId';
        const response = record(
          await request(task.operation, {
            params: { [param]: task.id },
            body: command.body,
            key: command.key,
            signal,
          }),
        );
        if (controller.signal.aborted) return;
        if (verified(task, response)) done(response);
        else setIntent(command);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (
        !checking &&
        (!(error instanceof CabinetError) ||
          error.issue.status === 0 ||
          error.issue.status >= 500 ||
          error.issue.code === 'COMMAND_IN_PROGRESS')
      ) {
        setIntent(command);
      } else {
        if (!checking) {
          pending.delete(scope);
          setIntent(null);
        }
        setFeedback(failure(error));
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      active.current = null;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || intent || result) return;
    const form = new FormData(event.currentTarget);
    const body = payload(task, form, zone);
    if (!body) {
      setFeedback('invalid');
      return;
    }
    const recipient = String(form.get('recipient') ?? '');
    void run({ key: crypto.randomUUID(), body, ...(recipient ? { recipient } : {}) }, false);
  }

  const destination =
    result &&
    typeof result.id === 'string' &&
    (task.operation === 'createManagerPayment'
      ? '/manager/payments/' + encodeURIComponent(result.id)
      : task.operation === 'proposeAllocationCorrection'
        ? '/manager/payments/corrections/' + encodeURIComponent(result.id)
        : null);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      pending={busy}
      title={text(title)}
      description={text(hint)}
      contentProps={{ className: 'cab-dialog' }}
    >
      <p className="cab-detail-subtitle">{context}</p>
      {result ? (
        <div className="cab-lesson-request">
          <p role="status">{text(resultMessage)}</p>
          {destination && (
            <CabinLink to={destination} navigate={navigate} className="cab-inline-link">
              {text(task.operation === 'createManagerPayment' ? 'openReceipt' : 'correction')}
            </CabinLink>
          )}
        </div>
      ) : intent ? (
        <div className="cab-lesson-request">
          <p role="status">{text(feedback ?? 'unknown')}</p>
          <div className="cab-form-actions">
            <button
              type="button"
              className="cab-button cab-secondary"
              disabled={busy}
              onClick={() => void run(intent, true)}
            >
              {text('verify')}
            </button>
            {checked && (
              <button
                type="button"
                className="cab-button cab-primary"
                disabled={busy}
                onClick={() => void run(intent, false)}
              >
                {text('resend')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="cab-fields cab-lesson-fields">
            <PaymentFields task={task} zone={zone} />
            {feedback && (
              <p role="alert" className="cab-form-error">
                {text(feedback)}
              </p>
            )}
            <div className="cab-form-actions">
              <button type="submit" className="cab-button cab-primary">
                {text(busy ? 'loading' : title)}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <button type="button" className="cab-button cab-secondary" disabled={busy} onClick={close}>
        {text('done')}
      </button>
    </Dialog>
  );
}
