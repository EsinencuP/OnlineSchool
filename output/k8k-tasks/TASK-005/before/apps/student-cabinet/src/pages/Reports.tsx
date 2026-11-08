import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, useLocale } from '@online-school/ui';
import { getStudentReports, markStudentReportRead } from '@online-school/api-contracts';
import { useCommand, useStudentQuery, write } from '../api.js';
import { date, Empty, ErrorNotice, Pager, Panel, QueryState } from '../components.js';

// Only published, server-authorized eight-lesson reports. A skill snapshot is not a report.
export function Reports() {
  const { t, locale, intlLocale } = useLocale();
  const reportDate = (value: string) =>
    new Intl.DateTimeFormat(intlLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(value));
  const [page, setPage] = useState(1);
  const [params] = useSearchParams();
  const selected = params.get('reportId');
  const query = useStudentQuery(['reports', page], (o) => getStudentReports({ page }, o));
  const mark = useCommand((id: string) => write((o) => markStudentReportRead(id, o)));
  return (
    <>
      <h1>{t('reports')}</h1>
      <p>{t('reportHelp')}</p>
      <Link to="/student/skills">{t('skills')}</Link>
      <ErrorNotice error={mark.error} />
      <QueryState query={query}>
        {query.data?.items.length ? (
          query.data.items.map((report) => (
            <Panel key={report.reportId} title={report.subjectName}>
              <details open={selected === report.reportId ? true : undefined}>
                <summary>
                  {reportDate(report.periodFrom)} — {reportDate(report.periodTo)} ·{' '}
                  {report.lessonCount} {locale === 'ro' ? 'lecții' : 'уроков'}
                </summary>
                <p>
                  {t('teacher')}: {report.teacherName}
                </p>
                <h3>{t('achievements')}</h3>
                <p className="preserve-lines">{report.content.achievements}</p>
                <h3>{t('growth')}</h3>
                <p className="preserve-lines">{report.content.growthAreas}</p>
                <h3>{t('recommendations')}</h3>
                <p className="preserve-lines">{report.content.recommendations}</p>
                <p>{report.content.teacherSignature}</p>
                <time dateTime={report.createdAt}>{date(report.createdAt, true)}</time>
                {report.isNew && (
                  <Button
                    type="button"
                    disabled={mark.isPending}
                    onClick={() => mark.mutate(report.reportId)}
                  >
                    {t('read')}
                  </Button>
                )}
              </details>
            </Panel>
          ))
        ) : (
          <Empty>{t('emptyReports')}</Empty>
        )}
      </QueryState>
      {query.data && <Pager {...query.data} change={setPage} />}
    </>
  );
}
