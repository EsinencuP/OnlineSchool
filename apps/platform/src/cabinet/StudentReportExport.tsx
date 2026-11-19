import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { components } from '@online-school/api-contracts';
import { sessionSignal, subscribeSession } from '@online-school/account-ui';
import { calendarDate, formatDateTime, Icon } from '@online-school/ui';
import { CabinetError, request } from './contract.js';
import { useEndpoint } from './hooks.js';
import { useReportCopy } from './reportCopy.js';
import type { ReportMessage } from './reportCopy.js';
import { isRouteUuid, subjectSelection } from './studentSubjectRoutes.js';

type Schemas = components['schemas'];
type Body = Schemas['ExportPdfRequestDto'];
type JobStatus = Schemas['PdfJobStatusDto'];
type Intent = { requestId: string; body?: Body; jobId?: string; estimate?: string };
type Navigate = (url: string, replace?: boolean, preserveScroll?: boolean) => void;
type Preview = Omit<JobStatus, 'downloadUrl'> & { canDownload: boolean };

const history = new Map<string, Intent>();
subscribeSession(() => history.clear());

const jobMessages = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'exportFailed',
} as const satisfies Record<JobStatus['status'], ReportMessage>;

function inaccessible(error: unknown) {
  return (
    error instanceof CabinetError &&
    ([401, 402, 403, 404].includes(error.issue.status) ||
      error.issue.code === 'MUST_CHANGE_PASSWORD')
  );
}

function uncertain(error: unknown) {
  return (
    !(error instanceof CabinetError) ||
    error.issue.status === 0 ||
    error.issue.status >= 500 ||
    (error.issue.status >= 200 && error.issue.status < 300) ||
    error.issue.code === 'COMMAND_IN_PROGRESS'
  );
}

function signedDownload(value: JobStatus) {
  if (
    value.status !== 'READY' ||
    !value.downloadUrl ||
    !value.expiresAt ||
    !(Date.parse(value.expiresAt) > Date.now())
  )
    return null;
  try {
    const url = new URL(value.downloadUrl);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

async function jobStatus(jobId: string, signal: AbortSignal): Promise<JobStatus> {
  const response = await request<JobStatus>('getStudentEducationPdfStatus', {
    params: { jobId },
    signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
  });
  if (response.jobId !== jobId) return Promise.reject(new Error('INVALID_RESPONSE'));
  return response;
}

function preview(value: JobStatus): Preview {
  return {
    jobId: value.jobId,
    status: value.status,
    expiresAt: value.expiresAt,
    failureReason: value.failureReason,
    canDownload: Boolean(signedDownload(value)),
  };
}

function PdfJob({
  jobId,
  estimate,
  zone,
  reset,
}: {
  jobId: string;
  estimate: string | undefined;
  zone: string;
  reset: () => void;
}) {
  const { locale, text } = useReportCopy();
  const [snapshot, setSnapshot] = useState<Preview | null>(null);
  const [issue, setIssue] = useState<ReportMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(0);
  const [visible, setVisible] = useState(() => !document.hidden);
  const downloadRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    function visibility() {
      if (document.hidden) {
        downloadRequest.current?.abort();
        setSnapshot(null);
        setIssue(null);
        setPaused(true);
      }
      setVisible(!document.hidden);
    }
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      downloadRequest.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const activity = new AbortController();
    const signal = AbortSignal.any([activity.signal, sessionSignal()]);
    let attempts = 0;
    let next: number | undefined;
    const deadline = window.setTimeout(() => {
      if (!signal.aborted) setPaused(true);
      activity.abort();
    }, 60_000);
    async function poll() {
      if (signal.aborted) return;
      attempts++;
      try {
        const result = await jobStatus(jobId, signal);
        if (signal.aborted) return;
        setSnapshot(preview(result));
        setPaused(false);
        if (result.status === 'QUEUED' || result.status === 'PROCESSING') {
          if (attempts < 30) {
            next = window.setTimeout(() => void poll(), 2000);
            return;
          }
          setPaused(true);
        }
      } catch (error) {
        if (!signal.aborted) {
          setSnapshot(null);
          setIssue(inaccessible(error) ? 'unavailable' : 'failed');
          setPaused(true);
        }
      }
      window.clearTimeout(deadline);
    }
    void poll();
    return () => {
      activity.abort();
      window.clearTimeout(deadline);
      window.clearTimeout(next);
    };
  }, [jobId, round, visible]);

  useEffect(() => {
    if (snapshot?.status !== 'READY' || !snapshot.expiresAt) return;
    const expiry = Date.parse(snapshot.expiresAt);
    if (!Number.isFinite(expiry)) return;
    const deadline = window.setTimeout(
      () => {
        setSnapshot((current) =>
          current === snapshot
            ? {
                ...snapshot,
                status: 'FAILED',
                failureReason: 'PDF_EXPORT_EXPIRED',
                canDownload: false,
              }
            : current,
        );
      },
      Math.max(0, expiry - Date.now()),
    );
    return () => window.clearTimeout(deadline);
  }, [snapshot]);

  async function download() {
    if (downloadRequest.current || !snapshot?.canDownload || document.hidden) return;
    const controller = new AbortController();
    downloadRequest.current = controller;
    const lease = AbortSignal.any([controller.signal, sessionSignal()]);
    setBusy(true);
    setIssue(null);
    try {
      const latest = await jobStatus(jobId, lease);
      if (lease.aborted || document.hidden) return;
      setSnapshot(preview(latest));
      const url = signedDownload(latest);
      if (url) window.location.assign(url);
      else if (latest.status === 'READY') setIssue('fileUnavailable');
    } catch (error) {
      if (!lease.aborted) {
        setSnapshot(null);
        setIssue(inaccessible(error) ? 'unavailable' : 'failed');
      }
    } finally {
      downloadRequest.current = null;
      if (!lease.aborted || document.hidden) setBusy(false);
    }
  }

  const stage = snapshot?.status;
  const ready =
    visible &&
    snapshot?.status === 'READY' &&
    snapshot.canDownload &&
    Boolean(snapshot.expiresAt && Date.parse(snapshot.expiresAt) > Date.now());
  const expired = snapshot?.failureReason === 'PDF_EXPORT_EXPIRED';
  const estimateLabel = estimate && formatDateTime(estimate, locale, zone);
  const expiresLabel = snapshot?.expiresAt && formatDateTime(snapshot.expiresAt, locale, zone);
  return (
    <>
      <p className="cab-report-meta">
        {text('job')} · <code>{jobId}</code>
      </p>
      {issue ? (
        <p className="cab-empty cab-empty-error" role="alert">
          {text(issue)}
        </p>
      ) : (
        <p role="status" className={'cab-status cab-tone-' + (ready ? 'mint' : 'violet')}>
          {text(
            expired
              ? 'expired'
              : stage === 'READY' && !ready
                ? 'fileUnavailable'
                : stage
                  ? jobMessages[stage]
                  : 'checking',
          )}
        </p>
      )}
      {paused && issue !== 'unavailable' && <p className="cab-report-meta">{text('paused')}</p>}
      {estimateLabel && (stage === 'QUEUED' || stage === 'PROCESSING') && (
        <p className="cab-report-meta">
          {text('estimate')} · <time dateTime={estimate}>{estimateLabel}</time>
        </p>
      )}
      {ready && expiresLabel && (
        <p className="cab-report-meta">
          {text('until')} · <time dateTime={snapshot.expiresAt!}>{expiresLabel}</time>
        </p>
      )}
      <div className="cab-report-actions">
        {ready && (
          <button
            type="button"
            className="cab-button cab-primary"
            disabled={busy}
            onClick={() => void download()}
          >
            {text(busy ? 'checking' : 'download')}
          </button>
        )}
        {issue !== 'unavailable' &&
          !expired &&
          (paused || issue || (stage === 'READY' && !ready)) && (
            <button
              type="button"
              className="cab-button cab-secondary"
              disabled={busy}
              onClick={() => {
                setIssue(null);
                setPaused(false);
                setSnapshot(null);
                setRound((value) => value + 1);
              }}
            >
              {text('resume')}
            </button>
          )}
        <button type="button" className="cab-text-button" onClick={reset} disabled={busy}>
          {text('newExport')}
        </button>
      </div>
    </>
  );
}

export function StudentReportExport({
  path,
  search,
  zone,
  accountId,
  navigate,
}: {
  path: string;
  search: string;
  zone: string;
  accountId: string;
  navigate: Navigate;
}) {
  const { text } = useReportCopy();
  const fields = useId();
  const [saved, setSaved] = useState<Intent | null>(() => history.get(accountId) ?? null);
  const [checkedId, setCheckedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<ReportMessage | null>(null);
  const controller = useRef<AbortController | null>(null);
  const address = useRef({ path, search, navigate });
  address.current = { path, search, navigate };
  useEffect(() => () => controller.current?.abort(), []);

  const requested = subjectSelection(search, 'pdfRequestId');
  const selectedJob = subjectSelection(search, 'pdfJobId');
  const invalid =
    requested === '' || selectedJob === '' || (requested !== null && selectedJob !== null);
  const jobId = invalid
    ? null
    : (selectedJob ?? (requested === null ? (saved?.jobId ?? null) : null));
  const pending: Intent | null =
    invalid || jobId
      ? null
      : requested
        ? saved?.requestId === requested
          ? saved
          : { requestId: requested }
        : saved;
  const subjects = useEndpoint<Schemas['StudentSubjectsResponseDto']>(
    !invalid && !pending && !jobId ? 'getStudentSubjects' : null,
  );

  function save(intent: Intent | null) {
    if (intent) history.set(accountId, intent);
    else history.delete(accountId);
    setSaved(intent);
  }

  function setAddress(intent: Intent | null) {
    const location = address.current;
    const params = new URLSearchParams(location.search);
    params.delete('pdfRequestId');
    params.delete('pdfJobId');
    if (intent?.jobId) params.set('pdfJobId', intent.jobId);
    else if (intent) params.set('pdfRequestId', intent.requestId);
    location.navigate(location.path + (params.size ? '?' + params.toString() : ''), true, true);
  }

  function acceptRequest(intent: Intent) {
    save(intent);
    const current = new URLSearchParams(address.current.search);
    const requestId = current.get('pdfRequestId');
    if (!current.has('pdfJobId') && (!requestId || requestId === intent.requestId))
      setAddress(intent);
  }

  function reset() {
    save(null);
    setAddress(null);
    setIssue(null);
    setCheckedId(null);
  }

  async function run(intent: Intent, action: 'create' | 'check' | 'retry') {
    if (controller.current) return;
    const activity = new AbortController();
    controller.current = activity;
    const session = AbortSignal.any([activity.signal, sessionSignal()]);
    const signal = () => AbortSignal.any([session, AbortSignal.timeout(14_000)]);
    setBusy(true);
    setIssue(null);
    setCheckedId(null);
    if (action === 'create') {
      save(intent);
      setAddress(intent);
    }
    let posting = false;
    try {
      if (action !== 'create') {
        const result = await request<Schemas['PdfExportRequestResultDto']>(
          'getStudentEducationPdfRequestResult',
          { params: { requestId: intent.requestId }, signal: signal() },
        );
        if (session.aborted) return;
        if (result.status === 'ACCEPTED' && isRouteUuid(result.jobId)) {
          const next = { ...intent, jobId: result.jobId };
          acceptRequest(next);
          return;
        }
        if (result.status !== 'UNKNOWN') {
          setIssue('failed');
          return;
        }
        if (action === 'check' || !intent.body) {
          setCheckedId(intent.requestId);
          return;
        }
      }
      posting = true;
      const result = await request<Schemas['ExportPdfResponseDto']>('requestStudentEducationPdf', {
        body: intent.body ?? {},
        key: intent.requestId,
        signal: signal(),
      });
      if (session.aborted) return;
      if (result.status !== 'QUEUED' || !isRouteUuid(result.jobId)) {
        setIssue('unknown');
        return;
      }
      const next = { ...intent, jobId: result.jobId, estimate: result.estimatedReadyAt };
      acceptRequest(next);
    } catch (error) {
      if (session.aborted) return;
      if (posting && !uncertain(error)) {
        save(null);
        setAddress(null);
      }
      setIssue(
        inaccessible(error)
          ? 'unavailable'
          : error instanceof CabinetError && error.issue.code === 'PDF_EXPORT_LIMIT_REACHED'
            ? 'limit'
            : posting && uncertain(error)
              ? 'unknown'
              : 'failed',
      );
    } finally {
      controller.current = null;
      if (!session.aborted) setBusy(false);
    }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || jobId || invalid || !subjects.data) return;
    const form = new FormData(event.currentTarget);
    const subject = String(form.get('subject') ?? '');
    const from = String(form.get('from') ?? '');
    const to = String(form.get('to') ?? '');
    if ((from && !calendarDate(from)) || (to && !calendarDate(to)) || (from && to && from > to)) {
      setIssue('invalidDates');
      return;
    }
    if (subject && !subjects.data.items.some(({ subjectId }) => subjectId === subject)) return;
    const body = {
      ...(subject ? { subjectId: subject } : {}),
      ...(from ? { periodFrom: from } : {}),
      ...(to ? { periodTo: to } : {}),
    };
    void run({ requestId: crypto.randomUUID(), body }, 'create');
  }

  return (
    <aside className="cab-card cab-panel cab-lesson-stack cab-report-export">
      <div className="cab-subject-intro">
        <span className="cab-icon-disc cab-tone-violet">
          <Icon name="materials" size={22} />
        </span>
        <div>
          <h2>{text('exportTitle')}</h2>
          <p className="cab-report-meta">{text('exportHelp')}</p>
        </div>
      </div>
      {invalid ? (
        <>
          <p className="cab-empty cab-empty-error" role="alert">
            {text('unavailable')}
          </p>
          <button type="button" className="cab-text-button" onClick={reset}>
            {text('newExport')}
          </button>
        </>
      ) : jobId ? (
        <PdfJob
          key={jobId}
          jobId={jobId}
          estimate={saved?.jobId === jobId ? saved.estimate : undefined}
          zone={zone}
          reset={reset}
        />
      ) : pending ? (
        <>
          <p className="cab-report-meta">
            {text('request')} · <code>{pending.requestId}</code>
          </p>
          <p role="status">{text(busy ? 'checking' : 'unknown')}</p>
          <div className="cab-report-actions">
            <button
              type="button"
              className="cab-button cab-secondary"
              disabled={busy || issue === 'unavailable'}
              onClick={() => void run(pending, 'check')}
            >
              {text('check')}
            </button>
            {checkedId === pending.requestId && pending.body && (
              <button
                type="button"
                className="cab-button cab-secondary"
                disabled={busy}
                onClick={() => void run(pending, 'retry')}
              >
                {text('retryRequest')}
              </button>
            )}
            {issue === 'unavailable' && (
              <button type="button" className="cab-text-button" onClick={reset}>
                {text('newExport')}
              </button>
            )}
          </div>
        </>
      ) : subjects.pending ? (
        <p className="cab-empty" role="status">
          {text('loading')}
        </p>
      ) : !subjects.data ? (
        <div className="cab-empty cab-empty-error" role="alert">
          {text(inaccessible(subjects.error) ? 'unavailable' : 'failed')}
          {!inaccessible(subjects.error) && (
            <button type="button" className="cab-text-button" onClick={subjects.refresh}>
              {text('retry')}
            </button>
          )}
        </div>
      ) : (
        <form className="cab-lesson-stack" onSubmit={create}>
          <div className="cab-form-label">
            <label htmlFor={fields + '-subject'}>{text('subject')}</label>
            <select id={fields + '-subject'} name="subject">
              <option value="">{text('all')}</option>
              {subjects.data.items.map((item) => (
                <option key={item.subjectId} value={item.subjectId}>
                  {item.subjectName}
                </option>
              ))}
            </select>
          </div>
          <div className="cab-report-dates">
            <label className="cab-form-label">
              <span>{text('from')}</span>
              <input type="date" name="from" />
            </label>
            <label className="cab-form-label">
              <span>{text('to')}</span>
              <input type="date" name="to" />
            </label>
          </div>
          <button type="submit" className="cab-button cab-primary" disabled={busy}>
            {text('create')}
          </button>
        </form>
      )}
      {issue && issue !== 'unknown' && (
        <p className="cab-empty cab-empty-error" role="alert">
          {text(issue)}
        </p>
      )}
    </aside>
  );
}
