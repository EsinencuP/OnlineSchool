import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { sessionSignal } from '@online-school/account-ui';
import { Button, Field, Select, StateBoundary, StatusChip, describeError } from '@online-school/ui';
import {
  getStudentEducationPdfRequestResult,
  getStudentEducationPdfStatus,
  requestStudentEducationPdf,
} from '@online-school/api-contracts';
import type { ExportPdfRequestDto, PdfJobStatusDto } from '@online-school/api-contracts';
import { read, write } from './api.js';
import { ErrorNotice, QueryState } from './components.js';
import { useMe } from './Layout.js';
import { useStudentSubjects } from './pages/Subjects.js';
import { formatSkillDate } from './skill-copy.js';
import { useReportCopy } from './report-copy.js';

type Intent = {
  key: string;
  body?: ExportPdfRequestDto;
  status: 'pending' | 'unknown' | 'accepted' | 'rejected';
  jobId?: string;
  estimatedReadyAt?: string;
};
const uuid = (value: string | null | undefined) =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function privateUrl(value: string | null) {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function EducationPdfExport() {
  const { text, locale } = useReportCopy();
  const { userId, timeZone } = useMe();
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const lease = useRef(sessionSignal());
  const mounted = useRef(true);
  const intentKey = ['student', 'pdf-intent', userId] as const;
  const stored = useQuery<Intent | null>({
    queryKey: intentKey,
    enabled: false,
    gcTime: Infinity,
    initialData: null,
  });
  const requestId = params.get('pdfRequestId');
  const urlJob = params.get('pdfJobId');
  const invalidAddress =
    (params.has('pdfJobId') && (!uuid(urlJob) || params.getAll('pdfJobId').length !== 1)) ||
    (params.has('pdfRequestId') &&
      (!uuid(requestId) || params.getAll('pdfRequestId').length !== 1));
  const intent = params.has('pdfRequestId')
    ? uuid(requestId)
      ? stored.data?.key === requestId
        ? stored.data
        : { key: requestId!, status: 'unknown' as const }
      : null
    : stored.data;
  const jobId = params.has('pdfJobId')
    ? uuid(urlJob) && !invalidAddress
      ? urlJob
      : undefined
    : params.has('pdfRequestId')
      ? undefined
      : stored.data?.jobId;
  const subjects = useStudentSubjects();
  const [subject, setSubject] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [error, setError] = useState<unknown>(null),
    [invalid, setInvalid] = useState(false),
    [busy, setBusy] = useState(false),
    [denied, setDenied] = useState(false);
  const [result, setResult] = useState<PdfJobStatusDto | null>(null),
    [paused, setPaused] = useState(false),
    [run, setRun] = useState(0),
    [clock, setClock] = useState(Date.now());
  const lock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function save(value: Intent | null) {
    if (!lease.current.aborted) client.setQueryData(intentKey, value);
  }
  function address(nextJob: string | null, nextRequest: string | null) {
    const next = new URLSearchParams(params);
    next.delete('pdfJobId');
    next.delete('pdfRequestId');
    if (nextJob) next.set('pdfJobId', nextJob);
    if (nextRequest) next.set('pdfRequestId', nextRequest);
    setParams(next, { replace: true, preventScrollReset: true });
  }
  const failed = useCallback((value: unknown) => {
    if (lease.current.aborted || !mounted.current) return;
    setError(value);
    if (value && typeof value === 'object' && 'status' in value && value.status === 403) {
      setDenied(true);
      setResult(null);
    }
  }, []);
  async function enqueue(retry = false) {
    if (lock.current || lease.current.aborted) return;
    if (!retry && from && to && from > to) {
      setInvalid(true);
      return;
    }
    if (retry && (!intent || intent.body === undefined)) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setInvalid(false);
    setDenied(false);
    setResult(null);
    const current: Intent = retry
      ? intent!
      : {
          key: crypto.randomUUID(),
          body: {
            ...(subject ? { subjectId: subject } : {}),
            ...(from ? { periodFrom: from } : {}),
            ...(to ? { periodTo: to } : {}),
          },
          status: 'pending',
        };
    save({ ...current, status: 'pending' });
    address(null, current.key);
    try {
      if (retry) {
        const receipt = await read(
          (o) => getStudentEducationPdfRequestResult(current.key, o),
          lease.current,
        );
        if (lease.current.aborted || !mounted.current) return;
        if (receipt.status === 'ACCEPTED' && receipt.jobId) {
          save({ ...current, status: 'accepted', jobId: receipt.jobId });
          address(receipt.jobId, null);
          return;
        }
      }
      const accepted = await write(
        (o) => requestStudentEducationPdf(current.body ?? {}, o),
        current.key,
        lease.current,
      );
      if (lease.current.aborted || !mounted.current) return;
      save({
        ...current,
        status: 'accepted',
        jobId: accepted.jobId,
        estimatedReadyAt: accepted.estimatedReadyAt,
      });
      address(accepted.jobId, null);
    } catch (value) {
      if (!lease.current.aborted && mounted.current) {
        save({
          ...current,
          status: describeError(value, 'write').outcome === 'unknown' ? 'unknown' : 'rejected',
        });
        failed(value);
      }
    } finally {
      lock.current = false;
      if (mounted.current && !lease.current.aborted) setBusy(false);
    }
  }
  async function reconcile() {
    if (!intent || lock.current || lease.current.aborted) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const receipt = await read(
        (o) => getStudentEducationPdfRequestResult(intent.key, o),
        lease.current,
      );
      if (lease.current.aborted || !mounted.current) return;
      if (receipt.status === 'ACCEPTED' && receipt.jobId) {
        save({ ...intent, status: 'accepted', jobId: receipt.jobId });
        address(receipt.jobId, null);
      } else save({ ...intent, status: 'unknown' });
    } catch (value) {
      failed(value);
    } finally {
      lock.current = false;
      if (mounted.current && !lease.current.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    setResult(null);
    setClock(Date.now());
    setError(null);
    setPaused(false);
    if (!jobId || lease.current.aborted) return;
    const controller = new AbortController();
    const started = Date.now();
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const signal = AbortSignal.any([controller.signal, lease.current]);
    const deadline = setTimeout(() => {
      controller.abort();
      if (mounted.current && !lease.current.aborted) setPaused(true);
    }, 60_000);
    async function poll() {
      if (signal.aborted) return;
      if (attempts >= 30 || Date.now() - started >= 60_000) {
        setPaused(true);
        clearTimeout(deadline);
        return;
      }
      attempts++;
      try {
        const value = await read((o) => getStudentEducationPdfStatus(jobId!, o), signal);
        if (signal.aborted || !mounted.current) return;
        setResult(value);
        setClock(Date.now());
        setDenied(false);
        if (value.status === 'QUEUED' || value.status === 'PROCESSING')
          timer = setTimeout(() => void poll(), 2000);
        else clearTimeout(deadline);
      } catch (value) {
        if (!signal.aborted) {
          failed(value);
          clearTimeout(deadline);
          setPaused(true);
        }
      }
    }
    void poll();
    const visibility = () => {
      setResult((current) => (current ? { ...current, downloadUrl: null } : null));
      if (document.hidden) {
        controller.abort();
        setPaused(true);
      } else setRun((value) => value + 1);
    };
    const focus = () => {
      setResult((current) => (current ? { ...current, downloadUrl: null } : null));
      setRun((value) => value + 1);
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', focus);
    return () => {
      controller.abort();
      clearTimeout(deadline);
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', focus);
    };
    // This loop owns one bounded read window; commands and URL state are kept outside it.
  }, [jobId, run, failed]);
  useEffect(() => {
    if (!result?.expiresAt) return;
    const expires = Date.parse(result.expiresAt);
    if (!Number.isFinite(expires)) return;
    const timer = setTimeout(
      () => {
        setClock(Date.now());
        setResult((current) => (current ? { ...current, downloadUrl: null } : null));
      },
      Math.max(0, expires - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [result?.expiresAt]);
  const current = result?.jobId === jobId ? result : null;
  const expires = current?.expiresAt ? Date.parse(current.expiresAt) : NaN;
  const expired = Number.isFinite(expires) && expires <= clock;
  const ready =
    current?.status === 'READY' &&
    !!privateUrl(current.downloadUrl) &&
    Number.isFinite(expires) &&
    !expired &&
    !paused &&
    !denied;
  async function download() {
    if (lock.current || !jobId || !ready) return;
    lock.current = true;
    setBusy(true);
    setResult((current) => (current ? { ...current, downloadUrl: null } : null));
    try {
      const fresh = await read((o) => getStudentEducationPdfStatus(jobId, o), lease.current);
      if (lease.current.aborted || !mounted.current) return;
      setResult(fresh);
      setClock(Date.now());
      const url = privateUrl(fresh.downloadUrl);
      if (
        fresh.status === 'READY' &&
        url &&
        fresh.expiresAt &&
        Date.parse(fresh.expiresAt) > Date.now()
      )
        window.location.assign(url);
    } catch (value) {
      failed(value);
    } finally {
      lock.current = false;
      if (mounted.current && !lease.current.aborted) setBusy(false);
    }
  }
  const unknown = intent?.status === 'unknown' || intent?.status === 'pending';
  return (
    <section className="panel k8k-pdf-export">
      <h2>{text('exportTitle')}</h2>
      <p>{text('exportHelp')}</p>
      {denied || invalidAddress ? (
        <StateBoundary state={{ status: 'forbidden' }} />
      ) : (
        <>
          {!jobId && !unknown && (
            <QueryState query={subjects}>
              {subjects.data && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void enqueue();
                  }}
                >
                  <fieldset disabled={busy || subjects.isFetching || !!subjects.error}>
                    <Select
                      label={text('subject')}
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                    >
                      <option value="">{text('all')}</option>
                      {subjects.data.items.map((item) => (
                        <option value={item.subjectId} key={item.subjectId}>
                          {item.subjectName}
                        </option>
                      ))}
                    </Select>
                    <Field
                      label={text('from')}
                      type="date"
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                    <Field
                      label={text('to')}
                      type="date"
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                    />
                    {invalid && <p role="alert">{text('range')}</p>}
                    <Button type="submit" className="k8k-pdf-primary">
                      {busy ? text('pending') : text('create')}
                    </Button>
                  </fieldset>
                </form>
              )}
            </QueryState>
          )}
          {unknown && (
            <div>
              <p role="status">
                {text(busy && intent?.status === 'pending' ? 'pending' : 'unknown')}
              </p>
              <p>{text('unknownStill')}</p>
              <Button variant="secondary" disabled={busy} onClick={() => void reconcile()}>
                {text('check')}
              </Button>
              {intent?.body !== undefined && (
                <Button variant="secondary" disabled={busy} onClick={() => void enqueue(true)}>
                  {text('retry')}
                </Button>
              )}
            </div>
          )}
          {jobId && (
            <div className="k8k-pdf-job">
              <p>
                {text('job')}: <span>{jobId}</span>
              </p>
              {current && (current.status !== 'READY' || ready) && (
                <p role="status">
                  <StatusChip
                    tone={
                      current.status === 'READY'
                        ? 'success'
                        : current.status === 'FAILED'
                          ? 'warning'
                          : 'info'
                    }
                  >
                    {text(current.status)}
                  </StatusChip>
                </p>
              )}
              {(!current || current.status === 'QUEUED' || current.status === 'PROCESSING') && (
                <>
                  <p>{text('estimate')}</p>
                  {intent?.estimatedReadyAt && (
                    <p>
                      {text('estimateAt')}:{' '}
                      {formatSkillDate(intent.estimatedReadyAt, timeZone, locale, true)}
                    </p>
                  )}
                </>
              )}
              {paused && <p role="status">{text('paused')}</p>}
              {expired || current?.failureReason === 'PDF_EXPORT_EXPIRED' ? (
                <p role="status">{text('expired')}</p>
              ) : current?.status === 'FAILED' ? (
                <p role="status">{text('failed')}</p>
              ) : null}
              {current?.status === 'READY' && !ready && !expired && !busy && (
                <p>{text('invalidReady')}</p>
              )}
              {ready && (
                <>
                  <p>
                    {text('expires')}:{' '}
                    {formatSkillDate(current!.expiresAt!, timeZone, locale, true)}
                  </p>
                  <Button
                    className="k8k-pdf-primary"
                    disabled={busy}
                    onClick={() => void download()}
                  >
                    {busy ? text('checking') : text('download')}
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setRun((value) => value + 1)}
              >
                {text('resume')}
              </Button>
            </div>
          )}
        </>
      )}
      {error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'PDF_EXPORT_LIMIT_REACHED' ? (
        <p role="alert">{text('limit')}</p>
      ) : (
        <ErrorNotice error={error} />
      )}
      {intent?.status !== 'pending' && intent?.status !== 'unknown' && (jobId || denied) && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            save(null);
            address(null, null);
            setResult(null);
            setDenied(false);
            setError(null);
          }}
        >
          {text('newExport')}
        </Button>
      )}
    </section>
  );
}
