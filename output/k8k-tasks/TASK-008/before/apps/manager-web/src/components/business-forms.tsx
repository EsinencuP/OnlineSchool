import { useState } from 'react';
import type {
  CreateManagerPaymentDto,
  FreezeManagerSubscriptionDto,
  RescheduleManagerLessonDto,
  ResolveManagerDisputeDto,
} from '@online-school/api-contracts';
import type { ApiErrorView } from '../api/error-view.js';
import { ru } from '../i18n/ru.js';
import { MONEY_REGEX, validMoney } from '../lib/money.js';
import { localToIso } from '../lib/time.js';
import { Check, FormShell, Input, Select, TextArea, text, enumOptions } from './ui.js';
type Base = { busy: boolean; error: ApiErrorView | null; reload?: () => Promise<unknown> };
const validation = (message: string): ApiErrorView => ({
  code: 'VALIDATION_FAILED',
  status: 422,
  message,
});
export function MoneyInput({
  name = 'amount',
  label = ru.money,
  required = true,
}: {
  name?: string;
  label?: string;
  required?: boolean;
}) {
  return (
    <Input
      name={name}
      label={label}
      type="text"
      inputMode="decimal"
      pattern={MONEY_REGEX.source}
      required={required}
      maxLength={17}
      hint={ru.moneyHelp}
    />
  );
}
export function PaymentForm({
  timezone,
  submit,
  ...base
}: Base & { timezone: string; submit: (payload: CreateManagerPaymentDto) => Promise<unknown> }) {
  const [error, setError] = useState<ApiErrorView | null>(null);
  async function send(data: FormData) {
    const amount = text(data, 'amount');
    const receivedAt = localToIso(text(data, 'receivedAt'), timezone);
    if (!validMoney(amount)) {
      setError(validation(ru.invalidMoney));
      return;
    }
    if (!receivedAt) {
      setError(validation(ru.invalidTime));
      return;
    }
    setError(null);
    await submit({
      amount,
      currency: 'MDL',
      method: text(data, 'method') as CreateManagerPaymentDto['method'],
      purpose: text(data, 'purpose') as CreateManagerPaymentDto['purpose'],
      receivedAt,
      ...(text(data, 'externalRef') ? { externalRef: text(data, 'externalRef') } : {}),
      ...(text(data, 'note') ? { note: text(data, 'note') } : {}),
    });
  }
  return (
    <FormShell {...base} error={error ?? base.error} submit={send} button={ru.registerPayment}>
      <p className="hint">{ru.directorOnly}</p>
      <MoneyInput />
      <Select
        name="method"
        label={ru.method}
        required
        options={enumOptions(['CASH', 'BANK_TRANSFER', 'CARD', 'ONLINE'])}
      />
      <Select
        name="purpose"
        label={ru.purpose}
        required
        options={enumOptions(['FIRST_PAYMENT', 'RENEWAL', 'OTHER'])}
      />
      <Input name="receivedAt" label={ru.receivedAt} type="datetime-local" required />
      <Input name="externalRef" label={ru.reference} maxLength={100} />
      <TextArea name="note" label={ru.comment} maxLength={500} />
    </FormShell>
  );
}
export function FreezeForm({
  submit,
  ...base
}: Base & { submit: (payload: FreezeManagerSubscriptionDto) => Promise<unknown> }) {
  return (
    <FormShell
      {...base}
      submit={async (data) =>
        submit({
          startsOn: text(data, 'startsOn'),
          endsOn: text(data, 'endsOn'),
          reason: text(data, 'reason') as FreezeManagerSubscriptionDto['reason'],
          ...(text(data, 'comment') ? { comment: text(data, 'comment') } : {}),
          cancelConflictingLessons: data.has('cancelConflictingLessons'),
        })
      }
      button={ru.freeze}
    >
      <p className="hint">{ru.freezeHelp}</p>
      <Input name="startsOn" label={ru.startsOn} type="date" required />
      <Input name="endsOn" label={ru.endsOn} type="date" required />
      <Select
        name="reason"
        label={ru.reason}
        options={enumOptions(['ILLNESS', 'TRAVEL', 'FAMILY', 'OTHER'])}
        required
      />
      <TextArea name="comment" label={ru.comment} maxLength={500} />
      <p>{ru.freezeConsequences}</p>
      <Check name="cancelConflictingLessons" label={ru.cancelConflicts} />
      <Check name="acknowledge" label={ru.acknowledge} required />
    </FormShell>
  );
}
export function RescheduleForm({
  timezone,
  teachers,
  initialTime,
  submit,
  ...base
}: Base & {
  timezone: string;
  teachers: ReadonlyArray<{ id: string; label: string }>;
  initialTime?: string;
  submit: (payload: RescheduleManagerLessonDto) => Promise<unknown>;
}) {
  const [error, setError] = useState<ApiErrorView | null>(null);
  return (
    <FormShell
      {...base}
      error={error ?? base.error}
      button={ru.reschedule}
      submit={async (data) => {
        const newStartsAt = localToIso(text(data, 'newStartsAt'), timezone);
        if (!newStartsAt) {
          setError(validation(ru.invalidTime));
          return;
        }
        setError(null);
        return submit({
          newStartsAt,
          reason: text(data, 'reason'),
          initiator: text(data, 'initiator') as NonNullable<
            RescheduleManagerLessonDto['initiator']
          >,
          overrideLateRule: data.has('overrideLateRule'),
          ...(text(data, 'newTeacherId') ? { newTeacherId: text(data, 'newTeacherId') } : {}),
        });
      }}
    >
      <p className="hint">{ru.leadHelp}</p>
      <Input
        name="newStartsAt"
        label={ru.startsAt}
        type="datetime-local"
        required
        {...(initialTime ? { defaultValue: initialTime } : {})}
      />
      <Select name="newTeacherId" label={ru.teacher} options={teachers} />
      <Select
        name="initiator"
        label={ru.initiator}
        required
        options={enumOptions(['STUDENT', 'TEACHER', 'ACADEMY'])}
        defaultValue="STUDENT"
      />
      <TextArea name="reason" label={ru.reason} minLength={3} maxLength={500} required />
      <Check name="overrideLateRule" label={ru.lateOverride} />
    </FormShell>
  );
}
export function DisputeForm({
  version,
  submit,
  ...base
}: Base & { version: number; submit: (payload: ResolveManagerDisputeDto) => Promise<unknown> }) {
  const [decision, setDecision] = useState('REJECT');
  const [error, setError] = useState<ApiErrorView | null>(null);
  return (
    <FormShell
      {...base}
      error={error ?? base.error}
      button={ru.resolve}
      submit={async (data) => {
        const amount = text(data, 'refundAmount');
        const lessons = text(data, 'refundLessons');
        if (decision === 'ACCEPT' && amount && !MONEY_REGEX.test(amount)) {
          setError(validation(ru.invalidMoney));
          return;
        }
        setError(null);
        return submit({
          decision: decision as ResolveManagerDisputeDto['decision'],
          reason: text(data, 'reason'),
          version,
          ...(decision === 'ACCEPT' && amount ? { refundAmount: amount } : {}),
          ...(decision === 'ACCEPT' && lessons ? { refundLessons: parseInt(lessons, 10) } : {}),
        });
      }}
    >
      <Select
        name="decision"
        label={ru.decision}
        options={enumOptions(['ACCEPT', 'REJECT', 'ESCALATE'])}
        placeholder={false}
        value={decision}
        onChange={(e) => setDecision(e.target.value)}
      />
      <TextArea name="reason" label={ru.reason} required minLength={3} maxLength={1000} />
      {decision === 'ACCEPT' && (
        <>
          <MoneyInput name="refundAmount" label={ru.refundAmount} required={false} />
          <Input
            name="refundLessons"
            label={ru.refundLessons}
            type="number"
            min={0}
            max={10}
            step={1}
          />
          <p>{ru.disputeConsequences}</p>
          <Check name="acknowledge" label={ru.acknowledge} required />
        </>
      )}
    </FormShell>
  );
}
