import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { subscribeSession } from '@online-school/account-ui';
import type { components } from '@online-school/api-contracts';
import { calendarDate, Dialog } from '@online-school/ui';
import { CabinetError, request } from './contract.js';
import { useStudy } from './studentStudyCopy.js';
import type { StudyMessage } from './studentStudyCopy.js';

type Schemas = components['schemas'];
type Body = Schemas['RescheduleRequestDto'] | Schemas['DisputeRequestDto'];
type Kind = 'reschedule' | 'dispute';
type Intent = { key: string; body?: Body };
const prefix = '2k.lesson-request.';
const pendingRequests = new Map<string, Intent>();
const receipts = new Map<string, string>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

subscribeSession(() => {
  pendingRequests.clear();
  receipts.clear();
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.removeItem(key);
  } catch {
    // Continue with in-memory state if browser storage is unavailable.
  }
});

function remembered(storageKey: string): Intent | null {
  const draft = pendingRequests.get(storageKey);
  if (draft) return draft;
  try {
    const value = sessionStorage.getItem(storageKey);
    return value && uuid.test(value) ? { key: value } : null;
  } catch {
    return null;
  }
}

function remember(storageKey: string, value?: Intent) {
  if (value) pendingRequests.set(storageKey, value);
  else pendingRequests.delete(storageKey);
  try {
    if (value) sessionStorage.setItem(storageKey, value.key);
    else sessionStorage.removeItem(storageKey);
  } catch {
    // The current dialog can still reconcile its in-memory request.
  }
}

export function StudentLessonRequest({
  accountId,
  lessonId,
  kind,
  allowed,
  onAccessChange,
}: {
  accountId: string;
  lessonId: string;
  kind: Kind;
  allowed: boolean;
  onAccessChange: () => void;
}) {
  const { text } = useStudy();
  const storageKey = prefix + accountId + '.' + lessonId + '.' + kind;
  const [intent, setIntent] = useState<Intent | null>(() => remembered(storageKey));
  const [receipt, setReceipt] = useState(() => receipts.get(storageKey) ?? '');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [checked, setChecked] = useState(false);
  const [notice, setNotice] = useState<StudyMessage | null>(null);
  const running = useRef<AbortController | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reason = useRef<HTMLTextAreaElement>(null);
  const hint = useId();
  const dispute = kind === 'dispute';
  const type = dispute ? 'ATTENDANCE_DISPUTE' : 'RESCHEDULE_REQUEST';
  useEffect(() => () => running.current?.abort(), []);

  function accept(crmTaskId: string) {
    receipts.set(storageKey, crmTaskId);
    setReceipt(crmTaskId);
    setIntent(null);
    setChecked(false);
    remember(storageKey);
  }

  function handle(error: unknown, reconcile: boolean) {
    if (error instanceof CabinetError && [401, 402, 403, 404].includes(error.issue.status)) {
      setNotice('actionUnavailable');
      onAccessChange();
      return;
    }
    if (
      reconcile ||
      !(error instanceof CabinetError) ||
      error.issue.status === 0 ||
      error.issue.status >= 500 ||
      error.issue.code === 'COMMAND_IN_PROGRESS'
    ) {
      setNotice('unknown');
      return;
    }
    setIntent(null);
    remember(storageKey);
    if (error.issue.code === 'ATTENDANCE_DISPUTE_ALREADY_OPEN') {
      setNotice('alreadyOpen');
      return;
    }
    setNotice(error.issue.code === 'INVALID_INPUT' ? 'invalid' : 'actionUnavailable');
  }

  async function run(next: Intent, reconcile: boolean) {
    if (running.current || (!reconcile && (!allowed || !next.body))) return;
    const controller = new AbortController();
    running.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    setBusy(true);
    setNotice(null);
    setChecked(false);
    if (!reconcile) {
      setIntent(next);
      remember(storageKey, next);
    }
    try {
      const result = reconcile
        ? await request<Schemas['LessonRequestResultDto']>('getStudentLessonRequestResult', {
            params: { lessonId, requestKey: next.key },
            query: { type },
            signal,
          })
        : await request<Schemas['RescheduleRequestResponseDto']>(
            dispute ? 'disputeStudentLessonDeduction' : 'requestStudentLessonReschedule',
            { params: { lessonId }, body: next.body, key: next.key, signal },
          );
      if (controller.signal.aborted) return;
      if (
        result.status === 'CREATED' &&
        result.crmTaskId &&
        (!reconcile || ('type' in result && result.type === type))
      ) {
        accept(result.crmTaskId);
      } else {
        setChecked(reconcile && result.status === 'UNKNOWN');
        setNotice(reconcile ? 'notConfirmed' : 'unknown');
      }
    } catch (error) {
      if (!controller.signal.aborted) handle(error, reconcile);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      running.current = null;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (intent || receipt || !allowed || running.current) return;
    const values = new FormData(event.currentTarget);
    const message = String(values.get('message') ?? '').trim();
    const date = calendarDate(String(values.get('date') ?? ''));
    if (message.length < (dispute ? 10 : 1) || (!dispute && !date)) {
      setNotice('invalid');
      reason.current?.focus();
      return;
    }
    const body = dispute ? { description: message } : { reason: message, preferredDate: date! };
    void run({ key: crypto.randomUUID(), body }, false);
  }

  if (!allowed && !intent && !receipt && !open) return null;
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="cab-button cab-secondary"
        onClick={() => setOpen(true)}
      >
        {text(receipt ? 'reference' : intent ? 'check' : kind)}
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        pending={busy}
        initialFocusRef={reason}
        returnFocusRef={trigger}
        title={text(kind)}
        description={text(dispute ? 'disputeHint' : 'rescheduleHint')}
        contentProps={{ className: 'cab-dialog' }}
      >
        {receipt ? (
          <div className="cab-lesson-request">
            <p role="status">{text(dispute ? 'disputeSent' : 'rescheduleSent')}</p>
            <p className="cab-lesson-ref">
              {text('reference')} · <strong>{receipt}</strong>
            </p>
          </div>
        ) : intent ? (
          <div className="cab-lesson-request">
            <p role="status">{text(busy ? 'pending' : (notice ?? 'unknown'))}</p>
            <div className="cab-form-actions">
              <button
                type="button"
                className="cab-button cab-secondary"
                onClick={() => void run(intent, true)}
                disabled={busy}
              >
                {text('check')}
              </button>
              {checked && allowed && intent.body && (
                <button
                  type="button"
                  className="cab-button cab-primary"
                  onClick={() => void run(intent, false)}
                  disabled={busy}
                >
                  {text('retryRequest')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <form className="cab-lesson-request" onSubmit={submit}>
            <label className="cab-form-label">
              <span>{text(dispute ? 'description' : 'reason')}</span>
              <textarea
                aria-describedby={hint}
                name="message"
                required
                minLength={dispute ? 10 : 1}
                maxLength={dispute ? 1000 : 500}
                rows={4}
                ref={reason}
                value={draftText}
                onChange={(event) => {
                  setDraftText(event.target.value);
                  setNotice(null);
                }}
              />
            </label>
            {!dispute && (
              <label className="cab-form-label">
                <span>{text('preferredDate')}</span>
                <input
                  type="date"
                  name="date"
                  required
                  value={preferredDate}
                  onChange={(event) => setPreferredDate(event.target.value)}
                />
              </label>
            )}
            <div id={hint}>
              {notice && (
                <p role="alert" className="cab-form-error">
                  {text(notice)}
                </p>
              )}
            </div>
            <div className="cab-form-actions">
              <button
                className="cab-button cab-primary"
                type="submit"
                disabled={!allowed || busy || notice === 'alreadyOpen'}
              >
                {text('submit')}
              </button>
            </div>
          </form>
        )}
        <button
          className="cab-button cab-secondary"
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          {text('done')}
        </button>
      </Dialog>
    </>
  );
}
