import { useContext, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  disputeStudentLessonDeduction,
  getStudentLessonRequestResult,
  requestStudentLessonReschedule,
} from '@online-school/api-contracts';
import type { DisputeRequestDto, RescheduleRequestDto } from '@online-school/api-contracts';
import { sessionSignal, subscribeSession } from '@online-school/account-ui';
import { Button, describeError, Dialog, ErrorForm, Field, StateBoundary } from '@online-school/ui';
import { queryClient, read, useCommand, write } from './api.js';
import { dayKey, ErrorNotice } from './components.js';
import { useLessonCopy } from './lesson-copy.js';
import { StudentReadFreshness } from './student-presentation.js';
import { useMe } from './Layout.js';

const pendingPrefix = 'k8k.lesson-intent.';
subscribeSession(() => {
  for (const key of Object.keys(sessionStorage))
    if (key.startsWith(pendingPrefix)) sessionStorage.removeItem(key);
});

type Kind = 'reschedule' | 'dispute';
type Body = RescheduleRequestDto | DisputeRequestDto;
type Intent = {
  key: string;
  body?: Body;
  status: 'pending' | 'unknown' | 'error' | 'success';
  crmTaskId?: string;
};
type Lesson = {
  lessonId: string;
  subjectName: string;
  scheduledAt: string;
  meetAsOf?: string | undefined;
};

export function LessonCommands({
  lesson,
  kind,
  allowed,
}: {
  lesson: Lesson;
  kind: Kind;
  allowed: boolean;
}) {
  const { text } = useLessonCopy();
  const { userId } = useMe();
  const fresh = useContext(StudentReadFreshness);
  const [open, setOpen] = useState(false);
  const [checkError, setCheckError] = useState<unknown>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const lease = useRef(sessionSignal());
  const key = ['student', 'lesson-intent', userId, lesson.lessonId, kind] as const;
  const pendingKey = pendingPrefix + userId + '.' + lesson.lessonId + '.' + kind;
  const stored = useQuery<Intent>({
    queryKey: key,
    enabled: false,
    gcTime: Infinity,
    initialData: () => {
      const saved = sessionStorage.getItem(pendingKey);
      return saved &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)
        ? { key: saved, status: 'unknown' }
        : undefined;
    },
  });
  const intent = stored.data;
  const locked =
    intent?.status === 'pending' || intent?.status === 'unknown' || intent?.status === 'success';
  function save(value: Intent) {
    if (lease.current.aborted) return;
    if (value.status === 'pending' || value.status === 'unknown')
      sessionStorage.setItem(pendingKey, value.key);
    else sessionStorage.removeItem(pendingKey);
    queryClient.setQueryData(key, value);
  }
  function concealDenied(error: unknown) {
    if (lease.current.aborted) return;
    if (!error || typeof error !== 'object' || !('status' in error) || error.status !== 403) return;
    const keys = new Set([
      'lesson',
      'lessons',
      'lesson-history',
      'lesson-homework',
      'lesson-materials',
      'lesson-intent',
    ]);
    const filter = {
      predicate: (q: { queryKey: readonly unknown[] }) =>
        q.queryKey[0] === 'student' && keys.has(String(q.queryKey[1])),
    };
    void queryClient.cancelQueries(filter, { silent: true, revert: false });
    const denied = Object.assign(new Error('Forbidden'), error);
    for (const query of queryClient.getQueryCache().findAll(filter))
      query.setState({
        data: undefined,
        dataUpdatedAt: 0,
        error: denied,
        status: 'error',
        fetchStatus: 'idle',
      });
    setOpen(false);
  }
  const mutation = useCommand(async (next: Intent) => {
    try {
      const result = await write(
        (options) =>
          kind === 'reschedule'
            ? requestStudentLessonReschedule(
                lesson.lessonId,
                next.body as RescheduleRequestDto,
                options,
              )
            : disputeStudentLessonDeduction(
                lesson.lessonId,
                next.body as DisputeRequestDto,
                options,
              ),
        next.key,
      );
      save({ ...next, status: 'success', crmTaskId: result.crmTaskId });
      return result;
    } catch (error) {
      save({
        ...next,
        status: describeError(error, 'write').outcome === 'unknown' ? 'unknown' : 'error',
      });
      concealDenied(error);
      return Promise.reject(error);
    }
  });
  async function check() {
    if (!intent || checking || lease.current.aborted) return;
    setChecking(true);
    setCheckError(null);
    try {
      const result = await read((options) =>
        getStudentLessonRequestResult(
          lesson.lessonId,
          intent.key,
          {
            type: kind === 'dispute' ? 'ATTENDANCE_DISPUTE' : 'RESCHEDULE_REQUEST',
          },
          options,
        ),
      );
      if (lease.current.aborted) return;
      if (
        result.status === 'CREATED' &&
        result.crmTaskId &&
        result.type === (kind === 'dispute' ? 'ATTENDANCE_DISPUTE' : 'RESCHEDULE_REQUEST')
      ) {
        save({ ...intent, status: 'success', crmTaskId: result.crmTaskId });
        void queryClient.invalidateQueries({
          predicate: (q) => q.queryKey[0] === 'student' && q.queryKey[1] !== 'lesson-intent',
        });
      }
      setChecked(true);
    } catch (error) {
      if (!lease.current.aborted) setCheckError(error);
      concealDenied(error);
    } finally {
      if (!lease.current.aborted) setChecking(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const previous = queryClient.getQueryData<Intent>(key);
    if (previous && ['pending', 'unknown', 'success'].includes(previous.status)) return;
    if (!allowed || !fresh || mutation.isPending) return;
    const values = new FormData(event.currentTarget);
    const value = String(values.get(kind === 'reschedule' ? 'reason' : 'description')).trim();
    if (
      value.length < (kind === 'dispute' ? 10 : 1) ||
      value.length > (kind === 'dispute' ? 1000 : 500)
    ) {
      setInvalid(true);
      input.current?.focus();
      return;
    }
    const body: Body =
      kind === 'reschedule'
        ? { reason: value, preferredDate: String(values.get('preferredDate')) }
        : { description: value };
    const next: Intent = {
      body,
      status: 'pending',
      key:
        previous && JSON.stringify(previous.body) === JSON.stringify(body)
          ? previous.key
          : crypto.randomUUID(),
    };
    save(next);
    mutation.mutate(next);
  }
  if (!allowed && !open && (!intent || intent.status === 'error')) return null;
  const success = intent?.status === 'success';
  const unknown = intent?.status === 'unknown';
  const pending = intent?.status === 'pending';
  const conflict =
    !!mutation.error &&
    'code' in mutation.error &&
    mutation.error.code === 'ATTENDANCE_DISPUTE_ALREADY_OPEN';
  return (
    <>
      <Button
        ref={trigger}
        variant="secondary"
        disabled={!intent && !fresh}
        onClick={() => setOpen(true)}
      >
        {locked ? text(success ? 'task' : 'check') : text(kind)}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        onRequestClose={() => {
          if (!pending && !checking) setOpen(false);
        }}
        title={text(kind)}
        description={text(kind === 'reschedule' ? 'rescheduleHint' : 'disputeHint')}
        initialFocusRef={input}
        returnFocusRef={trigger}
        pending={pending || checking}
        contentProps={{ className: 'k8k-lesson-request-dialog k8k-role-student' }}
      >
        {success ? (
          <div role="status">
            <p>{text(kind === 'reschedule' ? 'rescheduleSuccess' : 'disputeSuccess')}</p>
            <p>
              {text('task')} <strong>{intent.crmTaskId}</strong>
            </p>
            <Button onClick={() => setOpen(false)}>{text('done')}</Button>
          </div>
        ) : unknown || pending ? (
          <>
            <StateBoundary
              state={{ status: 'pending', outcome: unknown ? 'unknown' : 'pending' }}
            />
            <p>{text(unknown ? 'unknown' : 'pending')}</p>
            {unknown && (
              <Button variant="secondary" pending={checking} onClick={() => void check()}>
                {text('check')}
              </Button>
            )}
            {checked && <p role="status">{text('notConfirmed')}</p>}
            <ErrorNotice error={checkError} />
          </>
        ) : (
          <ErrorForm className="k8k-lesson-request-form" error={mutation.error} onSubmit={submit}>
            <fieldset disabled={mutation.isPending}>
              <label className="k8k-lesson-text-field">
                <span>{text(kind === 'reschedule' ? 'reason' : 'description')}</span>
                <textarea
                  ref={input}
                  name={kind === 'reschedule' ? 'reason' : 'description'}
                  required
                  minLength={kind === 'dispute' ? 10 : 1}
                  maxLength={kind === 'dispute' ? 1000 : 500}
                  defaultValue={
                    intent?.body
                      ? 'reason' in intent.body
                        ? intent.body.reason
                        : intent.body.description
                      : ''
                  }
                  aria-invalid={invalid || undefined}
                  aria-describedby={kind + '-hint'}
                  onChange={() => setInvalid(false)}
                />
                <small id={kind + '-hint'}>
                  {text(kind === 'dispute' ? 'descriptionHint' : 'reasonHint')}
                </small>
                {invalid && <span role="alert">{text('invalidText')}</span>}
              </label>
              {kind === 'reschedule' && (
                <Field
                  label={text('preferredDate')}
                  name="preferredDate"
                  type="date"
                  required
                  min={dayKey(lesson.meetAsOf ?? new Date().toISOString())}
                  defaultValue={
                    intent?.body && 'preferredDate' in intent.body ? intent.body.preferredDate : ''
                  }
                />
              )}
              {conflict ? (
                <p role="alert">{text('alreadyOpen')}</p>
              ) : (
                <ErrorNotice error={mutation.error} />
              )}
              {!fresh && <p role="status">{text('refreshing')}</p>}
              <Button
                type="submit"
                disabled={!allowed || !fresh || conflict}
                className="k8k-lesson-primary"
              >
                {text('submit')}
              </Button>
              {mutation.error && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void queryClient.invalidateQueries({ queryKey: ['student', 'lesson-history'] });
                  }}
                >
                  {text('refresh')}
                </Button>
              )}
            </fieldset>
          </ErrorForm>
        )}
      </Dialog>
    </>
  );
}
