import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionSignal } from '@online-school/account-ui';
import {
  Button,
  StateBoundary,
  useLocale,
  describeError,
  studentLessonCount,
} from '@online-school/ui';
import {
  getStudentReport,
  getStudentReports,
  markStudentReportRead,
} from '@online-school/api-contracts';
import type { EducationalReportDto, ReportsResponseDto } from '@online-school/api-contracts';
import { read, useIntentKey, useStudentQuery, write } from '../api.js';
import { useMe } from '../Layout.js';
import { Empty, ErrorNotice, Pager, QueryState } from '../components.js';
import { formatSkillDate } from '../skill-copy.js';
import { StudentReadFreshness } from '../student-presentation.js';
import { useReportCopy } from '../report-copy.js';
import { EducationPdfExport } from '../report-export.js';

function ReportContent({
  report,
  focus = false,
}: {
  report: EducationalReportDto;
  focus?: boolean;
}) {
  const { t } = useLocale();
  const { text, locale } = useReportCopy();
  const { timeZone } = useMe();
  const heading = useRef<HTMLHeadingElement>(null);
  const lease = useRef(sessionSignal());
  const fresh = useContext(StudentReadFreshness);
  const client = useQueryClient();
  const key = useIntentKey();
  const [denied, setDenied] = useState(false);
  const lock = useRef(false);
  const uncertainRead = useRef(false);
  useEffect(() => {
    if (focus) heading.current?.focus({ preventScroll: true });
  }, [report.reportId, focus]);
  const mark = useMutation({
    mutationFn: async () => {
      if (uncertainRead.current) {
        const current = await read((o) => getStudentReport(report.reportId, o), lease.current);
        if (!current.isNew) return;
      }
      await write(
        (o) => markStudentReportRead(report.reportId, o),
        key(report.reportId),
        lease.current,
      );
    },
    onSuccess: () => {
      if (lease.current.aborted) return;
      uncertainRead.current = false;
      client.setQueryData<EducationalReportDto>(
        ['student', 'report-detail', report.reportId],
        (old) => old && { ...old, isNew: false },
      );
      client.setQueriesData<ReportsResponseDto>(
        { queryKey: ['student', 'reports'] },
        (old) =>
          old && {
            ...old,
            items: old.items.map((item) =>
              item.reportId === report.reportId ? { ...item, isNew: false } : item,
            ),
          },
      );
      void client.invalidateQueries({ queryKey: ['student'] });
    },
    onError: (error) => {
      uncertainRead.current = describeError(error, 'write').outcome === 'unknown';
      if (!lease.current.aborted && 'status' in error && error.status === 403) setDenied(true);
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  if (denied) return <StateBoundary state={{ status: 'forbidden' }} />;
  const date = (value: string, time = false) => formatSkillDate(value, timeZone, locale, time);
  return (
    <section className="panel k8k-report" data-report-id={report.reportId}>
      <h2 ref={heading} tabIndex={-1}>
        {report.subjectName}
      </h2>
      <p>
        {date(report.periodFrom)} — {date(report.periodTo)} ·{' '}
        {studentLessonCount(locale, report.lessonCount)}
      </p>
      <p>
        {t('teacher')}: {report.teacherName}
      </p>
      <h3>{t('achievements')}</h3>
      <p className="preserve-lines">{report.content.achievements}</p>
      <h3>{t('growth')}</h3>
      <p className="preserve-lines">{report.content.growthAreas}</p>
      <h3>{t('recommendations')}</h3>
      <p className="preserve-lines">{report.content.recommendations}</p>
      <p className="preserve-lines">{report.content.teacherSignature}</p>
      <time dateTime={report.createdAt}>{date(report.createdAt, true)}</time>
      <ErrorNotice error={mark.error} />
      {report.isNew ? (
        <Button
          variant="secondary"
          disabled={mark.isPending || !fresh}
          onClick={() => {
            if (!lock.current) {
              lock.current = true;
              mark.mutate();
            }
          }}
        >
          {text('read')}
        </Button>
      ) : (
        <p role="status">{text('readDone')}</p>
      )}
    </section>
  );
}
export function Reports() {
  const { t } = useLocale();
  const { text, locale } = useReportCopy();
  const { timeZone } = useMe();
  const [params, setParams] = useSearchParams();
  const ids = params.getAll('reportId');
  const selected = ids.length === 1 ? ids[0] : undefined;
  const valid =
    ids.length === 0 ||
    (ids.length === 1 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selected ?? ''));
  const raw = params.get('page') ?? '';
  const page = /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : 1;
  const query = useStudentQuery(
    ['reports', page],
    (o) => getStudentReports({ page }, o),
    ids.length === 0,
  );
  const detail = useStudentQuery(
    ['report-detail', selected ?? null],
    (o) => getStudentReport(selected!, o),
    !!selected && valid,
  );
  const listParams = new URLSearchParams(params);
  listParams.delete('reportId');
  return (
    <div className="k8k-reports-page">
      <h1>{t('reports')}</h1>
      <p>{t('reportHelp')}</p>
      <Link className="k8k-student-link" to="/student/skills">
        {t('skills')}
      </Link>
      {ids.length > 0 ? (
        <>
          <Link className="k8k-student-link" to={'/student/reports?' + listParams}>
            {text('back')}
          </Link>
          {!valid ? (
            <StateBoundary state={{ status: 'forbidden' }} />
          ) : (
            <QueryState query={detail}>
              {detail.data && (
                <>
                  <Button variant="secondary" onClick={() => void detail.refetch()}>
                    {text('refresh')}
                  </Button>
                  <ReportContent key={detail.data.reportId} report={detail.data} focus />
                </>
              )}
            </QueryState>
          )}
        </>
      ) : (
        <QueryState query={query}>
          {query.data && (
            <>
              {query.data.items.length ? (
                query.data.items.map((report) => (
                  <section className="panel k8k-report-summary" key={report.reportId}>
                    <h2>{report.subjectName}</h2>
                    <p>
                      {formatSkillDate(report.periodFrom, timeZone, locale)} —{' '}
                      {formatSkillDate(report.periodTo, timeZone, locale)}
                    </p>
                    <p>{report.teacherName}</p>
                    <Link
                      className="k8k-main-action"
                      to={
                        '/student/reports?' +
                        new URLSearchParams({
                          ...Object.fromEntries(params),
                          reportId: report.reportId,
                        })
                      }
                    >
                      {text('open')}
                    </Link>
                  </section>
                ))
              ) : (
                <Empty>{t('emptyReports')}</Empty>
              )}
              <Pager
                {...query.data}
                change={(nextPage) => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(nextPage));
                  setParams(next, { preventScrollReset: true });
                }}
              />
            </>
          )}
        </QueryState>
      )}
      <EducationPdfExport />
    </div>
  );
}
