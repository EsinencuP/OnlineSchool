import { useId, useState, useSyncExternalStore } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { sessionSignal, subscribeSession } from '@online-school/account-ui';
import type { components } from '@online-school/api-contracts';
import { ConfirmDialog, formatDateTime, Icon, useLocale } from '@online-school/ui';
import { CabinLink } from './Home.js';
import { CabinetError } from './contract.js';
import { useCabinetCommand, useEndpoint } from './hooks.js';
import { teacherStudentsPath } from './recordRoutes.js';
import { isRouteUuid } from './studentSubjectRoutes.js';
import { checkpointCopy } from './teacherCheckpointCopy.js';

type Schemas = components['schemas'];
type Checkpoint = Schemas['TeacherCheckpointCardDto'];
type Report = Schemas['TeacherReportDto'];
type ReportContent = Schemas['SaveReportDto'];
type Text = (key: keyof typeof checkpointCopy) => string;
type DateLabel = (value: string) => string;
type Notice =
  | 'reviewCompleted'
  | 'savedDraft'
  | 'reportPublished'
  | 'reloadAfterExpiry'
  | 'conflict'
  | 'reportAuthorMismatch'
  | 'unavailable';
type Reconcile = (notice: Notice, recovered?: ReportContent) => void;

const reportFields = [
  ['achievements', 5000],
  ['growthAreas', 5000],
  ['recommendations', 5000],
  ['teacherSignature', 200],
] as const satisfies readonly (readonly [keyof ReportContent, number])[];
const emptyReport: ReportContent = {
  achievements: '',
  growthAreas: '',
  recommendations: '',
  teacherSignature: '',
};

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function hasPeriod(start: string | null, end: string | null): start is string {
  return isInstant(start) && isInstant(end) && Date.parse(start) <= Date.parse(end);
}

function matchesCheckpoint(data: Checkpoint | null, id: string): data is Checkpoint {
  if (
    !data ||
    !isRouteUuid(data.checkpointId) ||
    data.checkpointId.toLowerCase() !== id ||
    !isRouteUuid(data.enrollmentId) ||
    !isRouteUuid(data.studentId) ||
    typeof data.studentName !== 'string' ||
    typeof data.subjectName !== 'string' ||
    !Number.isSafeInteger(data.confirmedLessonCount) ||
    data.confirmedLessonCount < 0 ||
    !isInstant(data.triggeredAt) ||
    (data.completedAt !== null && !isInstant(data.completedAt)) ||
    (data.state !== 'PENDING' && data.state !== 'COMPLETED')
  )
    return false;

  if (data.type === 'LESSON_4') {
    return (
      data.report === null &&
      (data.state === 'COMPLETED') === (data.completedAt !== null) &&
      (data.teacherSummary === null || typeof data.teacherSummary === 'string') &&
      (data.snapshotId === null || isRouteUuid(data.snapshotId))
    );
  }
  if (data.type !== 'LESSON_8') return false;

  const report = data.report;
  if (report === null) return data.state === 'PENDING';
  if (
    !isRouteUuid(report?.reportId) ||
    !hasPeriod(report.periodStart, report.periodEnd) ||
    !reportFields.every(([field]) => typeof report[field] === 'string')
  )
    return false;
  return data.state === 'PENDING'
    ? report.status === 'DRAFT' && report.publishedAt === null
    : report.status === 'PUBLISHED' && isInstant(report.publishedAt);
}

function handleRejection(code: string, reconcile: Reconcile, recovered?: ReportContent) {
  switch (code) {
    case 'CHECKPOINT_ALREADY_COMPLETED':
    case 'CHECKPOINT_USES_REPORT':
    case 'CHECKPOINT_HAS_NO_REPORT':
    case 'REPORT_ALREADY_PUBLISHED':
    case 'REPORT_DRAFT_REQUIRED':
      reconcile('conflict', recovered);
      break;
    case 'REPORT_AUTHOR_MISMATCH':
      reconcile('reportAuthorMismatch', recovered);
      break;
    case 'NOT_FOUND':
      reconcile('unavailable');
      break;
    case 'REPORT_NEEDS_EIGHT_LESSONS':
      return 'needsEight';
  }
  return undefined;
}

type CommandState = Pick<
  ReturnType<typeof useCabinetCommand<unknown, unknown, 'needsEight'>>,
  'busy' | 'unresolved' | 'error' | 'retry'
>;

function CommandFeedback({
  command,
  t,
  reconcile,
}: {
  command: CommandState;
  t: Text;
  reconcile: Reconcile;
}) {
  const expired = command.error === 'retryExpired';
  return (
    <>
      {command.error && (
        <p className="cab-form-error" role="alert">
          {t(command.error)}
        </p>
      )}
      {command.unresolved && (
        <div className="cab-empty">
          {!expired && <span role="status">{t('unknown')}</span>}
          <button
            type="button"
            className="cab-button cab-secondary"
            disabled={command.busy}
            onClick={expired ? () => reconcile('reloadAfterExpiry') : command.retry}
          >
            {t(command.busy ? 'busy' : expired ? 'refresh' : 'retryCommand')}
          </button>
        </div>
      )}
    </>
  );
}

type EditorProps = { checkpointId: string; t: Text; reconcile: Reconcile };

function ReviewForm({ checkpointId, t, reconcile }: EditorProps) {
  const hintId = useId();
  const [invalid, setInvalid] = useState(false);
  const command = useCabinetCommand<
    Schemas['CompleteCheckpointDto'],
    Schemas['CompleteCheckpointResponseDto'],
    'needsEight'
  >(
    'completeTeacherCheckpoint',
    (response) => {
      if (
        !isRouteUuid(response?.id) ||
        response.id.toLowerCase() !== checkpointId ||
        !isInstant(response.completedAt) ||
        (response.snapshotId !== null && !isRouteUuid(response.snapshotId))
      )
        return false;
      reconcile('reviewCompleted');
      return true;
    },
    (code) => handleRejection(code, reconcile),
    { checkpointId },
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (command.busy || command.unresolved) return;
    const teacherSummary = String(
      new FormData(event.currentTarget).get('teacherSummary') ?? '',
    ).trim();
    const length = [...teacherSummary].length;
    if (length < 5 || length > 2000) return setInvalid(true);
    setInvalid(false);
    command.submit({ teacherSummary });
  }

  return (
    <form className="cab-lesson-stack" aria-label={t('review')} noValidate onSubmit={submit}>
      <fieldset
        className="cab-fields cab-lesson-fields"
        disabled={command.busy || command.unresolved}
      >
        <div className="cab-form-label cab-lesson-note">
          <label htmlFor={hintId + '-summary'}>{t('teacherSummary')}</label>
          <textarea
            id={hintId + '-summary'}
            name="teacherSummary"
            rows={5}
            required
            aria-invalid={invalid}
            aria-describedby={hintId}
            onChange={() => setInvalid(false)}
          />
          <small id={hintId} role={invalid ? 'alert' : undefined}>
            {t('summaryHint')}
          </small>
        </div>
        <p className="cab-skill-meta cab-lesson-note">{t('completeHint')}</p>
        <div className="cab-form-actions">
          <button type="submit" className="cab-button cab-primary">
            {t(command.busy ? 'busy' : 'complete')}
          </button>
        </div>
      </fieldset>
      <CommandFeedback command={command} t={t} reconcile={reconcile} />
    </form>
  );
}

function lengthInvalid(value: string, max: number) {
  const length = [...value.trim()].length;
  return length === 0 || length > max;
}

function ReportForm({
  checkpointId,
  draft,
  recovered,
  readOnly,
  t,
  reconcile,
}: EditorProps & { draft: Report | null; recovered: ReportContent | null; readOnly: boolean }) {
  const validationId = useId();
  const [values, setValues] = useState<ReportContent>(recovered ?? draft ?? emptyReport);
  const [validate, setValidate] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lastAction, setLastAction] = useState<'save' | 'publish'>('save');
  const dirty = reportFields.some(([field]) => values[field] !== (draft ?? emptyReport)[field]);
  const save = useCabinetCommand<ReportContent, Schemas['SaveReportResponseDto'], 'needsEight'>(
    'saveTeacherReportDraft',
    (response) => {
      if (
        !isRouteUuid(response?.id) ||
        response.status !== 'DRAFT' ||
        (draft && response.id.toLowerCase() !== draft.reportId.toLowerCase())
      )
        return false;
      reconcile('savedDraft');
      return true;
    },
    (code) => handleRejection(code, reconcile, dirty ? values : undefined),
    { checkpointId },
  );
  const publish = useCabinetCommand<undefined, Schemas['PublishReportResponseDto'], 'needsEight'>(
    'publishTeacherReport',
    (response) => {
      if (
        !draft ||
        !isRouteUuid(response?.id) ||
        response.id.toLowerCase() !== draft.reportId.toLowerCase() ||
        response.status !== 'PUBLISHED' ||
        !isInstant(response.publishedAt)
      )
        return false;
      reconcile('reportPublished');
      return true;
    },
    (code) => handleRejection(code, reconcile),
    { checkpointId },
  );
  const locked = readOnly || save.busy || save.unresolved || publish.busy || publish.unresolved;
  const invalid = reportFields.some(([field, max]) => lengthInvalid(values[field], max));
  const canPublish = draft !== null && !locked && !dirty && !invalid;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || confirming) return;
    setValidate(true);
    if (invalid) return;
    setLastAction('save');
    save.submit({
      achievements: values.achievements.trim(),
      growthAreas: values.growthAreas.trim(),
      recommendations: values.recommendations.trim(),
      teacherSignature: values.teacherSignature.trim(),
    });
  }

  return (
    <form className="cab-lesson-stack" aria-label={t('draft')} noValidate onSubmit={submit}>
      <fieldset className="cab-fields cab-lesson-fields" disabled={locked && !readOnly}>
        {reportFields.map(([field, max]) => {
          const fieldInvalid = validate && lengthInvalid(values[field], max);
          const props = {
            name: field,
            required: !readOnly,
            readOnly,
            value: values[field],
            'aria-invalid': fieldInvalid,
            'aria-describedby': fieldInvalid ? validationId : undefined,
            onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
              const value = event.currentTarget.value;
              setValues((current) => ({ ...current, [field]: value }));
            },
          };
          return (
            <label className="cab-form-label cab-lesson-note" key={field}>
              <span>{t(field)}</span>
              {field === 'teacherSignature' ? (
                <input {...props} />
              ) : (
                <textarea rows={4} {...props} />
              )}
            </label>
          );
        })}
        {validate && invalid && (
          <p id={validationId} className="cab-form-error" role="alert">
            {t('reportInvalid')}
          </p>
        )}
        {!readOnly && draft && dirty && (
          <p className="cab-skill-meta cab-lesson-note">{t('saveBeforePublish')}</p>
        )}
        <div className="cab-form-actions">
          <button type="submit" className="cab-button cab-primary" disabled={locked}>
            {t(save.busy ? 'busy' : 'save')}
          </button>
          <ConfirmDialog
            trigger={
              <button type="button" className="cab-button cab-secondary" disabled={!canPublish}>
                {t(publish.busy ? 'busy' : 'publish')}
              </button>
            }
            open={confirming}
            onOpenChange={setConfirming}
            title={t('confirmTitle')}
            description={t('confirmHint')}
            confirmLabel={t('confirmPublish')}
            cancelLabel={t('cancel')}
            onConfirm={() => {
              setConfirming(false);
              if (!canPublish) return;
              setLastAction('publish');
              publish.submit(undefined);
            }}
            contentProps={{ className: 'cab-dialog' }}
          />
        </div>
      </fieldset>
      <CommandFeedback
        command={lastAction === 'save' ? save : publish}
        t={t}
        reconcile={reconcile}
      />
    </form>
  );
}

function Timestamp({ value, date }: { value: string; date: DateLabel }) {
  return <time dateTime={value}>{date(value)}</time>;
}

function ReportText({ content, t }: { content: ReportContent; t: Text }) {
  return (
    <ul className="cab-lesson-reports">
      {reportFields.map(([field]) => (
        <li key={field}>
          <h4>{t(field)}</h4>
          <p className="cab-long-copy">{content[field] || '—'}</p>
        </li>
      ))}
    </ul>
  );
}

function ReportSection({
  card,
  date,
  t,
  notice,
  recovered,
  reconcile,
}: {
  card: Checkpoint;
  date: DateLabel;
  t: Text;
  notice: Notice | null;
  recovered: ReportContent | null;
  reconcile: Reconcile;
}) {
  const report = card.report;
  const start = report?.periodStart ?? card.suggestedPeriodStart;
  const end = report?.periodEnd ?? card.suggestedPeriodEnd;
  const periodAvailable = isInstant(end) && hasPeriod(start, end);
  return (
    <section className="cab-card cab-panel cab-lesson-stack">
      <h3>{t(report?.status === 'PUBLISHED' ? 'report' : 'draft')}</h3>
      <dl className="cab-lesson-balance">
        <div>
          <dt>{t('period')}</dt>
          <dd>
            {periodAvailable ? (
              <>
                <Timestamp value={start} date={date} /> {'–'} <Timestamp value={end} date={date} />
              </>
            ) : (
              t('periodUnavailable')
            )}
          </dd>
        </div>
        {report?.publishedAt && (
          <div>
            <dt>{t('publishedAt')}</dt>
            <dd>
              <Timestamp value={report.publishedAt} date={date} />
            </dd>
          </div>
        )}
      </dl>
      {report?.status === 'PUBLISHED' ? (
        <>
          <ReportText content={report} t={t} />
          {recovered && (
            <section className="cab-lesson-stack">
              <h3>{t('recoveredDraft')}</h3>
              <ReportText content={recovered} t={t} />
            </section>
          )}
        </>
      ) : (
        <ReportForm
          checkpointId={card.checkpointId.toLowerCase()}
          draft={report}
          recovered={recovered}
          readOnly={notice === 'reportAuthorMismatch'}
          t={t}
          reconcile={reconcile}
        />
      )}
    </section>
  );
}

type Props = { id: string; zone: string; navigate: (url: string) => void };

function CheckpointDetail({ id, zone, navigate }: Props) {
  const { locale } = useLocale();
  const t: Text = (key) => checkpointCopy[key][locale === 'ro' ? 1 : 0];
  const date: DateLabel = (value) => formatDateTime(value, locale, zone) ?? '—';
  const session = useSyncExternalStore(subscribeSession, sessionSignal, sessionSignal);
  const [lease] = useState(() => session);
  const active = session === lease && !lease.aborted;
  const result = useEndpoint<Checkpoint>(active ? 'getTeacherCheckpoint' : null, {
    checkpointId: id,
  });
  const [feedback, setFeedback] = useState<{
    notice: Notice;
    recovered: ReportContent | null;
  } | null>(null);
  const notice = feedback?.notice ?? null;

  function reconcile(outcome: Notice, recovered?: ReportContent) {
    setFeedback({ notice: outcome, recovered: recovered ?? null });
    result.refresh();
  }

  if (result.pending)
    return (
      <p className="cab-empty" role="status">
        <span className="cab-spinner" aria-hidden="true" />
        {t('loading')}
      </p>
    );
  const card = result.data;
  if (!matchesCheckpoint(card, id)) {
    const unavailable =
      !active ||
      (result.error instanceof CabinetError && [401, 403, 404].includes(result.error.issue.status));
    return (
      <div className="cab-empty cab-empty-error" role="alert">
        {t(unavailable ? 'unavailable' : 'readFailed')}
        {!unavailable && (
          <button type="button" className="cab-text-button" onClick={result.refresh}>
            {t('refresh')}
          </button>
        )}
      </div>
    );
  }

  const isReview = card.type === 'LESSON_4';
  const state =
    isReview && card.state === 'COMPLETED'
      ? 'reviewCompleted'
      : card.report?.status === 'PUBLISHED'
        ? 'reportPublished'
        : card.report?.status === 'DRAFT'
          ? 'savedDraft'
          : 'pending';
  const isConflict =
    notice === 'conflict' || notice === 'reportAuthorMismatch' || notice === 'unavailable';
  return (
    <div className="cab-lesson-layout">
      <section className="cab-card cab-panel cab-lesson-stack">
        <div className="cab-skill-heading">
          <div>
            <h2>{card.studentName}</h2>
            <p className="cab-skill-meta">
              {card.subjectName} · {t(isReview ? 'review' : 'report')}
            </p>
          </div>
          <p className="cab-skill-meta" role={notice === state ? 'status' : undefined}>
            {t(state)}
          </p>
        </div>
        <dl className="cab-lesson-balance">
          <div>
            <dt>{t('lessonCount')}</dt>
            <dd>{card.confirmedLessonCount}</dd>
          </div>
          <div>
            <dt>{t('triggeredAt')}</dt>
            <dd>
              <Timestamp value={card.triggeredAt} date={date} />
            </dd>
          </div>
        </dl>
        <div>
          <CabinLink
            to={`${teacherStudentsPath}/${encodeURIComponent(card.enrollmentId.toLowerCase())}?tab=skills`}
            navigate={navigate}
            className="cab-inline-link"
          >
            {t('skills')} <Icon name="arrow" size={16} />
          </CabinLink>
        </div>
      </section>
      {notice && notice !== state && (
        <p
          className={isConflict ? 'cab-form-error' : 'cab-empty'}
          role={isConflict ? 'alert' : 'status'}
        >
          {t(notice)}
        </p>
      )}
      {isReview ? (
        <section className="cab-card cab-panel cab-lesson-stack">
          <h3>{t(card.state === 'COMPLETED' ? 'snapshot' : 'review')}</h3>
          {card.state === 'COMPLETED' ? (
            <>
              {card.completedAt && (
                <p className="cab-skill-meta">
                  {t('completedAt')} · <Timestamp value={card.completedAt} date={date} />
                </p>
              )}
              {!card.snapshotId && <p className="cab-skill-meta">{t('snapshotUnavailable')}</p>}
              <h4>{t('teacherSummary')}</h4>
              <p className="cab-long-copy cab-lesson-ref">
                {card.teacherSummary || t('summaryUnavailable')}
              </p>
            </>
          ) : (
            <ReviewForm checkpointId={id} t={t} reconcile={reconcile} />
          )}
        </section>
      ) : (
        <ReportSection
          card={card}
          date={date}
          t={t}
          notice={notice}
          recovered={feedback?.recovered ?? null}
          reconcile={reconcile}
        />
      )}
    </div>
  );
}

export function TeacherCheckpointCard({ id, zone, navigate }: Props) {
  const checkpointId = id.toLowerCase();
  return <CheckpointDetail key={checkpointId} id={checkpointId} zone={zone} navigate={navigate} />;
}
