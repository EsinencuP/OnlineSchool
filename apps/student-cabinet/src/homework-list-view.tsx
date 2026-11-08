import { Link } from 'react-router-dom';
import { Icon, Button } from '@online-school/ui';
import { getStudentHomework } from '@online-school/api-contracts';
import type { HomeworkItemDto } from '@online-school/api-contracts';
import { useStudentQuery } from './api.js';
import { useHomeworkCopy, HomeworkStatus } from './homework-copy.js';
import { useIdentityCopy } from './identity-copy.js';

export function HomeworkOverview({
  lessonId,
  status,
  change,
}: {
  lessonId?: string | undefined;
  status: string;
  change: (status: string) => void;
}) {
  const { text, statusLabel } = useHomeworkCopy();
  const identity = useIdentityCopy();
  const params = { pageSize: 1, ...(lessonId ? { lessonId } : {}) };
  const fresh = useStudentQuery(['homework-count', 'NOT_SUBMITTED', lessonId ?? null], (o) =>
    getStudentHomework({ ...params, status: 'NOT_SUBMITTED' }, o),
  );
  const revision = useStudentQuery(['homework-count', 'NEEDS_REVISION', lessonId ?? null], (o) =>
    getStudentHomework({ ...params, status: 'NEEDS_REVISION' }, o),
  );
  const submitted = useStudentQuery(['homework-count', 'SUBMITTED', lessonId ?? null], (o) =>
    getStudentHomework({ ...params, status: 'SUBMITTED' }, o),
  );
  const reviewed = useStudentQuery(['homework-count', 'REVIEWED', lessonId ?? null], (o) =>
    getStudentHomework({ ...params, status: 'REVIEWED' }, o),
  );
  const counts = {
    NOT_SUBMITTED: fresh.error ? undefined : fresh.data?.total,
    NEEDS_REVISION: revision.error ? undefined : revision.data?.total,
    SUBMITTED: submitted.error ? undefined : submitted.data?.total,
    REVIEWED: reviewed.error ? undefined : reviewed.data?.total,
  };
  const total = Object.values(counts).every((value) => value !== undefined)
    ? Object.values(counts).reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : undefined;
  return (
    <>
      <div className="k8k-homework-overview">
        <section className="k8k-homework-stat k8k-homework-stat-warning">
          <Icon name="warning" size={36} />
          <div>
            <strong>{counts.NEEDS_REVISION ?? '—'}</strong>
            <span>{statusLabel('NEEDS_REVISION')}</span>
          </div>
        </section>
        <section className="k8k-homework-stat">
          <Icon name="clock" size={36} />
          <div>
            <strong>{counts.SUBMITTED ?? '—'}</strong>
            <span>{identity('inReview')}</span>
          </div>
        </section>
        <section className="k8k-homework-stat">
          <Icon name="tasks" size={36} />
          <div>
            <strong>{counts.REVIEWED ?? '—'}</strong>
            <span>{identity('reviewed')}</span>
          </div>
        </section>
      </div>
      <div className="k8k-homework-tabs" role="group" aria-label={text('status')}>
        <Button variant="ghost" aria-pressed={status === ''} onClick={() => change('')}>
          {text('all')}
          <span>{total ?? '—'}</span>
        </Button>
        {(['NOT_SUBMITTED', 'NEEDS_REVISION', 'SUBMITTED', 'REVIEWED'] as const).map((value) => (
          <Button
            key={value}
            variant="ghost"
            aria-pressed={status === value}
            onClick={() => change(value)}
          >
            {value === 'NOT_SUBMITTED'
              ? identity('needSubmit')
              : value === 'SUBMITTED'
                ? identity('inReview')
                : value === 'REVIEWED'
                  ? identity('reviewed')
                  : statusLabel(value)}
            <span>{counts[value] ?? '—'}</span>
          </Button>
        ))}
      </div>
      {[fresh, revision, submitted, reviewed].some((query) => query.error) && (
        <p role="status">
          {identity('countsUnavailable')}{' '}
          <Button
            variant="secondary"
            onClick={() => {
              for (const query of [fresh, revision, submitted, reviewed]) void query.refetch();
            }}
          >
            {text('refresh')}
          </Button>
        </p>
      )}
    </>
  );
}

export function HomeworkCard({
  item,
  href,
  date,
}: {
  item: HomeworkItemDto;
  href: string;
  date: (value: string, time?: boolean) => string;
}) {
  const { text } = useHomeworkCopy();
  const identity = useIdentityCopy();
  const version = item.latestVersion;
  const titleBreak = item.title.indexOf('. ');
  return (
    <article className="k8k-homework-card k8k-student-card">
      <div className="k8k-homework-card-top">
        <span className="k8k-subject-label">{item.subjectName}</span>
        <HomeworkStatus value={item.status} />
      </div>
      <h2>
        <Link to={href}>
          {titleBreak > 0 ? (
            <>
              {item.title.slice(0, titleBreak + 1)}{' '}
              <span className="k8k-title-subline">{item.title.slice(titleBreak + 2)}</span>
            </>
          ) : (
            item.title
          )}
        </Link>
      </h2>
      <p className="k8k-homework-byline">
        {item.teacherName} · {text('assigned')} {date(item.assignedAt)}
      </p>
      <p className="k8k-homework-deadline">
        <Icon name="calendar" />
        <strong>{text('due')}:</strong>{' '}
        {item.dueAt ? (
          <time dateTime={item.dueAt}>{date(item.dueAt, true)}</time>
        ) : (
          text('noDeadline')
        )}
      </p>
      {item.isLate && <p className="k8k-homework-late">{text('late')}</p>}
      {version?.teacherComment && (
        <section className="k8k-homework-feedback">
          <Icon name="leads" />
          <div>
            <h3>{identity('teacherFeedback')}</h3>
            <p className="preserve-lines">{version.teacherComment}</p>
            {version.attachments.length > 0 && (
              <ul>
                {version.attachments.map((file) => (
                  <li key={file.fileId}>
                    <Icon name="materials" />
                    {file.fileName}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
      <div className="k8k-homework-card-actions">
        <Link className="k8k-main-action" to={href}>
          {identity(item.status === 'NEEDS_REVISION' ? 'revise' : 'openHomework')}
          <Icon name="arrow" />
        </Link>
        <details className="k8k-submission-history">
          <summary>{identity('submissions')}</summary>
          {item.versions.length ? (
            <ol>
              {[...item.versions]
                .sort((a, b) => b.versionNumber - a.versionNumber)
                .map((entry) => (
                  <li key={entry.versionNumber}>
                    <strong>
                      {text('version')} {entry.versionNumber}
                    </strong>
                    <time dateTime={entry.submittedAt}>{date(entry.submittedAt, true)}</time>
                    <p className="preserve-lines">{entry.teacherComment ?? text('noComment')}</p>
                  </li>
                ))}
            </ol>
          ) : (
            <p>{text('noVersions')}</p>
          )}
        </details>
      </div>
    </article>
  );
}
