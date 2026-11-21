import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { components } from '@online-school/api-contracts';
import { Icon, formatDateTime, useLocale } from '@online-school/ui';
import { CabinetError, request } from './contract.js';
import { CabinLink } from './Home.js';
import { useEndpoint } from './hooks.js';
import { weekSearch } from './TeacherSchedule.js';
import { teacherCopy } from './teacherCopy.js';
import { issueHomeworkUrl, teacherHomeworkNavigation } from './recordRoutes.js';

type Schemas = components['schemas'];
type Lesson = Schemas['TeacherLessonCardDto'];
type Report = Schemas['LessonOutcomeReportRequest'];
type Copy = (typeof teacherCopy)[keyof typeof teacherCopy];
type Command =
  | { action: 'start'; key: string }
  | { action: 'report'; key: string; body: Report; baseline: number };
type Feedback = Exclude<keyof Copy, 'reportTypes' | 'lessonStates'>;
type Message = { key: Feedback; tone: 'error' | 'status' };

function reasonKey(reason: string | null | undefined): Feedback {
  switch (reason) {
    case 'LESSON_NOT_IN_START_WINDOW':
      return 'startWindow';
    case 'PAID_ACCESS_OR_DIRECTOR_PERMISSION_REQUIRED':
      return 'noAccess';
    case 'ENROLLMENT_INACTIVE':
      return 'inactive';
    default:
      return 'startUnavailable';
  }
}

function wasRecorded(command: Command, lesson: Lesson) {
  if (command.action === 'start') return !!lesson.actualStartedAt;
  const body = command.body;
  return lesson.reports.some(
    (report) =>
      report.current &&
      report.version > command.baseline &&
      report.result === body.result &&
      report.note === body.note &&
      report.durationMin === (body.durationMin ?? null) &&
      report.studentNoShow === (body.studentNoShow === true) &&
      ((report.actualStartedAt === null && body.actualStartedAt === undefined) ||
        Date.parse(report.actualStartedAt ?? '') === Date.parse(body.actualStartedAt ?? '')),
  );
}

function ReportForm({
  lesson,
  t,
  disabled,
  busy,
  time,
  submit,
}: {
  lesson: Lesson;
  t: Copy;
  disabled: boolean;
  busy: boolean;
  time: (value: string) => string;
  submit: (body: Report) => void;
}) {
  const resultId = useId();
  const [result, setResult] = useState<Report['result'] | ''>('');
  const [issue, setIssue] = useState(false);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result || disabled) return;
    const data = new FormData(event.currentTarget);
    const note = String(data.get('note') ?? '').trim();
    const body: Report = { result, note };
    if (note.length < 5 || note.length > 2000) {
      setIssue(true);
      return;
    }
    if (result === 'CONDUCTED') {
      const entered = String(data.get('actualStartedAt') ?? '');
      const start = Date.parse(lesson.actualStartedAt ?? entered);
      const duration = Number(data.get('durationMin'));
      if (
        !Number.isFinite(start) ||
        !Number.isInteger(duration) ||
        duration < 1 ||
        duration > 480
      ) {
        setIssue(true);
        return;
      }
      body.actualStartedAt = lesson.actualStartedAt ?? new Date(start).toISOString();
      body.durationMin = duration;
    } else if (result === 'NOT_CONDUCTED' && data.has('studentNoShow')) {
      body.studentNoShow = true;
    }
    setIssue(false);
    submit(body);
  }

  return (
    <form onSubmit={send}>
      <fieldset className="cab-fields cab-lesson-fields" disabled={disabled}>
        <div className="cab-form-label">
          <label htmlFor={resultId}>{t.result}</label>
          <select
            id={resultId}
            value={result}
            required
            onChange={(event) => setResult(event.target.value as Report['result'] | '')}
          >
            <option value="">{t.choose}</option>
            <option value="CONDUCTED">{t.reportTypes.CONDUCTED}</option>
            <option value="NOT_CONDUCTED">{t.reportTypes.NOT_CONDUCTED}</option>
            {lesson.kind === 'REGULAR' && (
              <option value="DISPUTED">{t.reportTypes.DISPUTED}</option>
            )}
          </select>
        </div>
        {result === 'CONDUCTED' && (
          <>
            {lesson.actualStartedAt ? (
              <p className="cab-lesson-fixed-time">
                {t.started} · {time(lesson.actualStartedAt)}
              </p>
            ) : (
              <label className="cab-form-label">
                <span>{t.actualTime}</span>
                <input required type="datetime-local" name="actualStartedAt" />
              </label>
            )}
            <label className="cab-form-label">
              <span>{t.duration}</span>
              <input required type="number" min={1} max={480} step={1} name="durationMin" />
            </label>
          </>
        )}
        {result === 'NOT_CONDUCTED' && (
          <label className="cab-lesson-checkbox">
            <input type="checkbox" name="studentNoShow" /> {t.noShow}
          </label>
        )}
        <label className="cab-form-label cab-lesson-note">
          <span>{t.note}</span>
          <textarea required name="note" minLength={5} maxLength={2000} rows={4} />
        </label>
        {issue && (
          <p role="alert" className="cab-form-error">
            {t.invalid}
          </p>
        )}
        <div className="cab-form-actions">
          <button type="submit" className="cab-button cab-primary">
            {busy ? t.sending : t.send}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function TeacherLessonCard({
  id,
  zone,
  navigate,
}: {
  id: string;
  zone: string;
  navigate: (url: string) => void;
}) {
  const { locale } = useLocale();
  const t = teacherCopy[locale];
  const homeworkText = teacherHomeworkNavigation[locale];
  const detail = useEndpoint<Lesson>('getTeacherLesson', { id });
  const lesson = detail.data?.lessonId === id ? detail.data : null;
  const eligible = useEndpoint<Schemas['StaffActionEligibilityDto']>(
    lesson && !lesson.actualStartedAt && lesson.state === 'AWAITING_REPORT' && !lesson.canReport
      ? 'getTeacherLessonStartEligibility'
      : null,
    { id },
  );
  const [pending, setPending] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [checked, setChecked] = useState(false);
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);

  const time = (value: string) => formatDateTime(value, locale, zone) ?? '—';
  const canStart = Boolean(
    lesson &&
    !lesson.actualStartedAt &&
    eligible.data?.action === 'lesson.start' &&
    eligible.data.allowed === true &&
    eligible.data.objectId === id,
  );
  const reportAllowed = lesson?.canReport === true && !lesson.confirmedOutcome;

  function reload() {
    detail.refresh();
    eligible.refresh();
  }

  function succeeded(command: Command) {
    setPending(null);
    setChecked(false);
    setMessage({
      key: command.action === 'start' ? 'startApproved' : 'reportAccepted',
      tone: 'status',
    });
    reload();
  }

  async function send(command: Command) {
    if (running.current || (command.action === 'start' ? !canStart : !reportAllowed)) return;
    const controller = new AbortController();
    running.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    setBusy(true);
    setChecked(false);
    setMessage(null);
    try {
      if (command.action === 'start') {
        await request<Schemas['LessonResponse']>('startLesson', {
          params: { id },
          body: {},
          key: command.key,
          signal,
        });
      } else {
        await request<Schemas['LessonOutcomeReportResponse']>('reportLessonOutcome', {
          params: { id },
          body: command.body,
          key: command.key,
          signal,
        });
      }
      if (!controller.signal.aborted) succeeded(command);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (
        !(error instanceof CabinetError) ||
        error.issue.status === 0 ||
        error.issue.status >= 500 ||
        error.issue.code === 'COMMAND_IN_PROGRESS'
      ) {
        setPending(command);
        setMessage({ key: 'unknown', tone: 'status' });
      } else {
        setPending(null);
        const canEdit =
          command.action === 'report' &&
          [
            'INVALID_INPUT',
            'INVALID_ACTUAL_INTERVAL',
            'INVALID_OUTCOME_RESULT',
            'INVALID_NO_SHOW_RESULT',
          ].includes(error.issue.code);
        const key: Feedback =
          command.action === 'start'
            ? reasonKey(error.issue.code)
            : canEdit
              ? 'invalid'
              : 'cannotUpdate';
        setMessage({ key, tone: 'error' });
        if (!canEdit) reload();
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      running.current = null;
    }
  }

  async function recover(command: Command) {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setBusy(true);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
    try {
      const current = await request<Lesson>('getTeacherLesson', { params: { id }, signal });
      if (controller.signal.aborted) return;
      if (current.lessonId === id && wasRecorded(command, current)) {
        succeeded(command);
      } else {
        setChecked(
          current.lessonId === id &&
            (command.action === 'start'
              ? !current.actualStartedAt && current.state === 'AWAITING_REPORT'
              : current.canReport),
        );
        setMessage({ key: 'pendingUnknown', tone: 'status' });
        reload();
      }
    } catch {
      if (controller.signal.aborted) return;
      setChecked(false);
      setMessage({ key: 'cannotUpdate', tone: 'error' });
      reload();
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      running.current = null;
    }
  }

  return (
    <div className="cab-lesson-layout">
      <div className="cab-page-title">
        <h1>{t.lesson}</h1>
      </div>
      <CabinLink
        to={'/teacher/lessons' + weekSearch()}
        className="cab-inline-link"
        navigate={navigate}
      >
        {t.back}
      </CabinLink>
      {message && (
        <p
          className={message.tone === 'error' ? 'cab-form-error' : 'cab-empty'}
          role={message.tone === 'error' ? 'alert' : 'status'}
        >
          {t[message.key]}
        </p>
      )}
      {detail.pending ? (
        <div className="cab-card cab-empty" role="status">
          {t.loading}
        </div>
      ) : !lesson ? (
        <div className="cab-card cab-empty cab-empty-error" role="alert">
          {t.lessonUnavailable}{' '}
          <button type="button" className="cab-text-button" onClick={reload}>
            {t.retry}
          </button>
        </div>
      ) : (
        <div className="cab-lesson-grid">
          <div className="cab-lesson-stack">
            <section className="cab-card cab-panel cab-detail cab-lesson-summary">
              <div className="cab-panel-title">
                <h2>{lesson.subjectName}</h2>
                <span className="cab-status cab-tone-violet">
                  {lesson.state === 'AWAITING_REPORT' && Date.parse(lesson.endsAt) > Date.now()
                    ? t.scheduled
                    : t.lessonStates[lesson.state]}
                </span>
              </div>
              <p className="cab-detail-subtitle">
                {lesson.studentName} · {lesson.kind === 'TRIAL' ? t.trial : t.regular}
              </p>
              <p>
                <time dateTime={lesson.startsAt}>{time(lesson.startsAt)}</time> –{' '}
                <time dateTime={lesson.endsAt}>{time(lesson.endsAt)}</time>
              </p>
              {lesson.actualStartedAt && (
                <p>
                  {t.started} ·{' '}
                  <time dateTime={lesson.actualStartedAt}>{time(lesson.actualStartedAt)}</time>
                </p>
              )}
              <div className="cab-form-actions">
                <CabinLink
                  to={issueHomeworkUrl(id)}
                  className="cab-button cab-secondary"
                  navigate={navigate}
                >
                  <Icon name="tasks" size={16} /> {homeworkText.issue}
                </CabinLink>
                {canStart && !pending && (
                  <button
                    type="button"
                    className="cab-button cab-primary"
                    disabled={busy}
                    onClick={() => void send({ action: 'start', key: crypto.randomUUID() })}
                  >
                    <Icon name="clock" size={17} /> {busy ? t.sending : t.start}
                  </button>
                )}
                {!pending && (
                  <button
                    type="button"
                    className="cab-button cab-secondary"
                    disabled={busy}
                    onClick={reload}
                  >
                    {t.refresh}
                  </button>
                )}
              </div>
              {eligible.pending && (
                <p role="status" className="cab-detail-subtitle">
                  {t.loading}
                </p>
              )}
              {!canStart && !pending && !eligible.pending && (eligible.error || eligible.data) && (
                <p className="cab-detail-subtitle">{t[reasonKey(eligible.data?.reason)]}</p>
              )}
            </section>
            {pending && (
              <div className="cab-form-actions">
                <button
                  type="button"
                  className="cab-button cab-secondary"
                  onClick={() => void recover(pending)}
                  disabled={busy}
                >
                  {t.recheck}
                </button>
                {checked && (pending.action === 'start' ? canStart : reportAllowed) && (
                  <button
                    type="button"
                    className="cab-button cab-primary"
                    onClick={() => void send(pending)}
                    disabled={busy}
                  >
                    {t.resend}
                  </button>
                )}
              </div>
            )}
            {(reportAllowed ||
              (lesson.state === 'AWAITING_REPORT' && !lesson.confirmedOutcome)) && (
              <section className="cab-card cab-panel">
                <div className="cab-panel-title">
                  <h2>{t.report}</h2>
                </div>
                <p className="cab-detail-subtitle">
                  {t.deadline} ·{' '}
                  <time dateTime={lesson.reportDeadlineAt}>{time(lesson.reportDeadlineAt)}</time>
                </p>
                {lesson.overdue && <p className="cab-form-error">{t.overdue}</p>}
                {reportAllowed ? (
                  <ReportForm
                    lesson={lesson}
                    t={t}
                    disabled={busy || !!pending}
                    busy={busy}
                    time={time}
                    submit={(body) =>
                      void send({
                        action: 'report',
                        key: crypto.randomUUID(),
                        body,
                        baseline: Math.max(0, ...lesson.reports.map((item) => item.version)),
                      })
                    }
                  />
                ) : (
                  <p className="cab-empty">{t.awaitingEnd}</p>
                )}
              </section>
            )}
          </div>
          <aside className="cab-lesson-stack">
            <section className="cab-card cab-panel">
              <div className="cab-panel-title">
                <h2>{t.history}</h2>
              </div>
              {lesson.reports.length ? (
                <ul className="cab-lesson-reports">
                  {lesson.reports.map((report) => (
                    <li key={report.reportId}>
                      <strong>{t.reportTypes[report.result]}</strong>
                      <p className="cab-detail-subtitle">
                        {t.version} {report.version} ·{' '}
                        <time dateTime={report.reportedAt}>{time(report.reportedAt)}</time>
                        {report.current ? ' · ' + t.current : ''}
                      </p>
                      {report.studentNoShow && <p>{t.noShow}</p>}
                      <p className="cab-long-copy">{report.note}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cab-empty">{t.reportsAbsent}</p>
              )}
            </section>
            {lesson.confirmedOutcome && (
              <section className="cab-card cab-panel cab-detail">
                <div className="cab-panel-title">
                  <h2>{t.confirmed}</h2>
                </div>
                <p>
                  {t.started} · {time(lesson.confirmedOutcome.actualStartedAt)}
                </p>
                <p>
                  {t.duration} · {lesson.confirmedOutcome.durationMin}
                </p>
                <time dateTime={lesson.confirmedOutcome.confirmedAt}>
                  {time(lesson.confirmedOutcome.confirmedAt)}
                </time>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
