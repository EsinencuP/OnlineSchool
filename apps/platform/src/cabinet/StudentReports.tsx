import { useEffect, useRef, useState } from 'react';
import type { components } from '@online-school/api-contracts';
import { sessionSignal } from '@online-school/account-ui';
import { formatDateOnly, formatDateTime, Icon, studentLessonCount } from '@online-school/ui';
import { SubjectIcon } from './Brand.js';
import { CabinetError, request } from './contract.js';
import { CabinLink } from './Home.js';
import { StudyPager } from './StudentLesson.js';
import { StudentReportExport } from './StudentReportExport.js';
import { useEndpoint } from './hooks.js';
import { useReportCopy } from './reportCopy.js';
import { isRouteUuid, subjectSelection, subjectSkills } from './studentSubjectRoutes.js';

type Schemas = components['schemas'];
type Report = Schemas['EducationalReportDto'];
type Navigate = (url: string, replace?: boolean, preserveScroll?: boolean) => void;
const reportsPath = '/student/reports';

function reportPath(id: string | null, params: URLSearchParams) {
  const selection = new URLSearchParams(params);
  selection.delete('reportId');
  const path = id ? reportsPath + '/' + encodeURIComponent(id) : reportsPath;
  return selection.size ? path + '?' + selection : path;
}

function denied(error: unknown) {
  return error instanceof CabinetError && [401, 402, 403, 404].includes(error.issue.status);
}

function ReadState({ error, retry }: { error: unknown; retry: () => void }) {
  const { text } = useReportCopy();
  if (!error)
    return (
      <p className="cab-empty" role="status">
        <span className="cab-spinner" />
        {text('loading')}
      </p>
    );
  const forbidden = denied(error);
  return (
    <div className="cab-empty cab-empty-error" role="alert">
      {text(forbidden ? 'unavailable' : 'failed')}
      {!forbidden && (
        <button type="button" className="cab-text-button" onClick={retry}>
          {text('retry')}
        </button>
      )}
    </div>
  );
}

function ReportPeriod({ report }: { report: Report }) {
  const { locale } = useReportCopy();
  const date = (value: string) =>
    formatDateOnly(value, locale, { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—';
  return (
    <p className="cab-report-meta">
      <time dateTime={report.periodFrom}>{date(report.periodFrom)}</time>
      {' – '}
      <time dateTime={report.periodTo}>{date(report.periodTo)}</time>
      {' · ' + studentLessonCount(locale, report.lessonCount)}
    </p>
  );
}

function ReportDetail({ id, zone }: { id: string; zone: string }) {
  const { text, locale } = useReportCopy();
  const query = useEndpoint<Report>('getStudentReport', { reportId: id });
  const heading = useRef<HTMLHeadingElement>(null);
  const [marked, setMarked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const report = query.data?.reportId === id ? query.data : null;
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (report) heading.current?.focus({ preventScroll: true });
  }, [report]);

  async function markRead() {
    if (active.current || !report?.isNew || marked) return;
    const controller = new AbortController();
    active.current = controller;
    const lease = AbortSignal.any([controller.signal, sessionSignal()]);
    setBusy(true);
    setFailed(false);
    try {
      const params = { reportId: id };
      if (key.current) {
        const current = await request<Report>('getStudentReport', {
          params,
          signal: AbortSignal.any([lease, AbortSignal.timeout(12_000)]),
        });
        if (lease.aborted) return;
        if (current.reportId !== id) {
          setFailed(true);
          return;
        }
        if (!current.isNew) {
          setMarked(true);
          return;
        }
      }
      key.current ??= crypto.randomUUID();
      await request<void>('markStudentReportRead', {
        params,
        key: key.current,
        signal: AbortSignal.any([lease, AbortSignal.timeout(12_000)]),
      });
      if (!lease.aborted) setMarked(true);
    } catch (error) {
      if (!lease.aborted) {
        setForbidden(denied(error));
        setFailed(true);
      }
    } finally {
      active.current = null;
      if (!lease.aborted) setBusy(false);
    }
  }

  if (forbidden)
    return (
      <p className="cab-empty cab-empty-error" role="alert">
        {text('unavailable')}
      </p>
    );
  if (!report)
    return (
      <ReadState
        error={query.error ?? (query.pending ? null : new Error('INVALID_RESPONSE'))}
        retry={query.refresh}
      />
    );
  const published = formatDateTime(report.createdAt, locale, zone);
  const sections = ['achievements', 'growthAreas', 'recommendations', 'teacherSignature'] as const;
  return (
    <article className="cab-card cab-panel cab-lesson-stack cab-report-detail">
      <div className="cab-subject-intro">
        <SubjectIcon subject={report.subjectName} />
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {report.subjectName}
          </h2>
          <ReportPeriod report={report} />
          <p className="cab-report-meta">
            {report.teacherName}
            {published && (
              <>
                {' '}
                · <time dateTime={report.createdAt}>{published}</time>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="cab-report-content">
        {sections.map((field, index) => (
          <section className={'cab-tone-' + ['violet', 'peach', 'mint', 'blue'][index]} key={field}>
            <h3>{text(field)}</h3>
            <p className="cab-long-copy">{report.content[field]}</p>
          </section>
        ))}
      </div>
      {failed && (
        <p className="cab-empty cab-empty-error" role="alert">
          {text('readFailed')}
        </p>
      )}
      {report.isNew && !marked ? (
        <button
          type="button"
          className="cab-button cab-secondary"
          disabled={busy}
          onClick={() => void markRead()}
        >
          <Icon name="check" size={17} /> {text(busy ? 'checking' : 'read')}
        </button>
      ) : (
        <p className="cab-report-meta" role="status">
          {text('readDone')}
        </p>
      )}
    </article>
  );
}

function ReportDirectory({ params, navigate }: { params: URLSearchParams; navigate: Navigate }) {
  const { text } = useReportCopy();
  const rawPage = params.get('page');
  const page =
    rawPage && /^[1-9]\d*$/.test(rawPage) && Number(rawPage) <= 2_147_483_647 ? Number(rawPage) : 1;
  const list = useEndpoint<Schemas['ReportsResponseDto']>(
    'getStudentReports',
    {},
    { page, pageSize: 10 },
  );
  if (!list.data) return <ReadState error={list.error} retry={list.refresh} />;
  return (
    <>
      {list.data.items.length ? (
        <ul className="cab-report-list">
          {list.data.items.map((report) => (
            <li key={report.reportId} className="cab-card cab-panel cab-lesson-stack">
              <div className="cab-subject-intro">
                <SubjectIcon subject={report.subjectName} />
                <div>
                  <h2>{report.subjectName}</h2>
                  <ReportPeriod report={report} />
                  <p className="cab-report-meta">{report.teacherName}</p>
                </div>
                {report.isNew && <span className="cab-status cab-tone-violet">{text('new')}</span>}
              </div>
              <CabinLink
                to={reportPath(report.reportId, params)}
                navigate={navigate}
                className="cab-inline-link"
              >
                {text('open')} <Icon name="arrow" size={16} />
              </CabinLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cab-empty cab-empty-stack">
          <span>{text('empty')}</span>
          <small>{text('emptyHint')}</small>
        </p>
      )}
      <StudyPager
        {...list.data}
        change={(nextPage) => {
          const next = new URLSearchParams(params);
          next.set('page', String(nextPage));
          navigate(reportPath(null, next));
        }}
      />
    </>
  );
}

export default function StudentReports({
  path,
  search,
  zone,
  accountId,
  detail,
  navigate,
}: {
  path: string;
  search: string;
  detail?: string;
  zone: string;
  accountId: string;
  navigate: Navigate;
}) {
  const { text } = useReportCopy();
  const params = new URLSearchParams(search);
  const fromQuery = subjectSelection(search, 'reportId');
  const reportId =
    detail === undefined
      ? fromQuery
      : isRouteUuid(detail) && fromQuery === null
        ? detail.toLowerCase()
        : '';
  return (
    <div className="cab-lesson-grid cab-reports-page">
      <div className="cab-lesson-stack">
        <div className="cab-subject-toolbar">
          {reportId !== null && (
            <CabinLink
              to={reportPath(null, params)}
              navigate={navigate}
              className="cab-inline-link"
            >
              {text('back')}
            </CabinLink>
          )}
          <CabinLink to={subjectSkills} navigate={navigate} className="cab-inline-link">
            {text('skills')}
          </CabinLink>
        </div>
        {reportId === null ? (
          <ReportDirectory params={params} navigate={navigate} />
        ) : reportId ? (
          <ReportDetail id={reportId} key={reportId} zone={zone} />
        ) : (
          <p className="cab-empty cab-empty-error" role="alert">
            {text('unavailable')}
          </p>
        )}
      </div>
      <StudentReportExport
        path={path}
        search={search}
        zone={zone}
        accountId={accountId}
        navigate={navigate}
      />
    </div>
  );
}
