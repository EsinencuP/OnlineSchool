import { useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon, k8kEnabled, StateBoundary } from '@online-school/ui';
import { getStudentSubjects } from '@online-school/api-contracts';
import type { StudentSubjectDto } from '@online-school/api-contracts';
import { useStudentQuery } from '../api.js';
import { useMe } from '../Layout.js';
import { QueryState, Status } from '../components.js';
import { useStudentCopy } from '../student-copy.js';
import { StudentManagerCard, SubjectSubscriptionRows } from '../student-widgets.js';
import { StudentReadFreshness } from '../student-presentation.js';

export const subjectHub = '/student/subjects';

export function subjectHref(path: string, subjectId: string, parameter = 'subjectId') {
  return `${path}?${new URLSearchParams({ [parameter]: subjectId })}`;
}

export function useStudentSubjects(enabled = true) {
  return useStudentQuery(['subjects'], getStudentSubjects, enabled);
}

function accessDenied(error: Error | null) {
  return error && 'status' in error && (error.status === 401 || error.status === 403);
}

export function useSubjectSelection() {
  const [params, setParams] = useSearchParams();
  const query = useStudentSubjects(k8kEnabled);
  const ids = params.getAll('subjectId');
  const requested = k8kEnabled && ids.length > 0;
  const denied = accessDenied(query.error);
  const selected =
    requested && !denied && ids.length === 1
      ? query.data?.items.find(({ subjectId }) => subjectId.toLowerCase() === ids[0]?.toLowerCase())
      : undefined;
  return {
    query,
    requested,
    selected,
    setSubject(subjectId: string) {
      const next = new URLSearchParams(params);
      next.delete('subjectId');
      next.delete('page');
      if (subjectId) next.set('subjectId', subjectId);
      setParams(next, { preventScrollReset: true });
    },
  };
}

export function SubjectUnavailable() {
  const { copy } = useStudentCopy();
  return (
    <>
      <StateBoundary state={{ status: 'forbidden' }} />
      <Link className="k8k-student-link" to={subjectHub}>
        {copy.allSubjects}
      </Link>
    </>
  );
}

export function useSubjectReturn() {
  const [params] = useSearchParams();
  const ids = params.getAll('fromSubjectId');
  const id = ids.length === 1 ? ids[0] : undefined;
  const query = useStudentSubjects(k8kEnabled && !!id);
  if (!k8kEnabled || !id || accessDenied(query.error)) return;
  return query.data?.items.find((item) => item.subjectId === id)?.subjectId;
}

export function SubjectBack({ id }: { id?: string | undefined }) {
  const { copy } = useStudentCopy();
  return id ? (
    <Link className="k8k-student-link" to={subjectHref(subjectHub, id)}>
      {copy.backSubject}
    </Link>
  ) : null;
}

function SubjectCard({
  item,
  detail = false,
  showSubscriptions = false,
  compact = false,
}: {
  item: StudentSubjectDto;
  detail?: boolean;
  showSubscriptions?: boolean;
  compact?: boolean;
}) {
  const { copy, reasons } = useStudentCopy();
  const { timeZone } = useMe();
  const fresh = useContext(StudentReadFreshness);
  const { subjectId, capabilities } = item;
  type Action = { href: string; label: string; note?: string };
  const materials: Action | undefined =
    fresh && capabilities.canViewMaterials
      ? { href: subjectHref('/student/materials', subjectId), label: copy.materials }
      : undefined;
  const homework: Action | undefined =
    fresh && capabilities.canViewHomework
      ? {
          href: subjectHref('/student/homework', subjectId, 'fromSubjectId'),
          label: copy.allHomework,
          note: copy.homeworkScope,
        }
      : undefined;
  const lessons: Action | undefined =
    fresh && capabilities.canOpenLessons
      ? {
          href: subjectHref('/student/lessons', subjectId, 'fromSubjectId'),
          label: copy.openSchedule,
          note: copy.lessonsScope,
        }
      : undefined;
  const skills: Action | undefined = fresh
    ? { href: subjectHref('/student/skills', subjectId), label: copy.skills }
    : undefined;
  const help: Action = { href: '/student/help', label: copy.subjectHelp };
  const next = (item.liveAccess ? lessons : undefined) ?? homework ?? materials ?? help;
  const other = [materials, homework, lessons, skills, help].filter(
    (link) => link && link !== next,
  );
  if (compact)
    return (
      <article className="k8k-student-card k8k-subject-summary" data-status={item.displayStatus}>
        <Icon name="materials" size={32} />
        <div>
          <h3>
            <Link to={subjectHref(subjectHub, subjectId)}>{item.subjectName}</Link>
          </h3>
          <Status value={item.displayStatus} />
        </div>
        <Link
          className="k8k-student-link"
          to={next.href}
          aria-label={`${next.label}: ${item.subjectName}`}
        >
          <Icon name="arrow" />
        </Link>
      </article>
    );
  return (
    <article className="k8k-student-card k8k-subject-card">
      <div className="k8k-card-heading">
        <h2>{item.subjectName}</h2>
        <Status value={item.displayStatus} />
      </div>
      <p>{reasons[item.reasonCode]}</p>
      <div>
        <p className="k8k-student-caption">{copy.nextAction}</p>
        <Link className="k8k-student-link k8k-subject-next" to={next.href}>
          {next.label} <Icon name="arrow" />
        </Link>
        {next.note && <p className="k8k-student-caption">{next.note}</p>}
      </div>
      {detail ? (
        <>
          <ul className="k8k-subject-links">
            {other.map(
              (link) =>
                link && (
                  <li key={link.href}>
                    <Link className="k8k-student-link" to={link.href}>
                      {link.label} <Icon name="arrow" />
                    </Link>
                    {link.note && <p className="k8k-student-caption">{link.note}</p>}
                  </li>
                ),
            )}
          </ul>
        </>
      ) : (
        <Link className="k8k-student-link" to={subjectHref(subjectHub, subjectId)}>
          {copy.openSubject} <Icon name="arrow" />
        </Link>
      )}
      {showSubscriptions && (
        <SubjectSubscriptionRows
          item={item}
          timeZone={timeZone}
          compact={!detail}
          showStatus={detail}
        />
      )}
    </article>
  );
}

export function SubjectCards({
  items,
  showSubscriptions = false,
  compact = false,
}: {
  items: readonly StudentSubjectDto[];
  showSubscriptions?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="k8k-subject-grid">
      {items.map((item) => (
        <SubjectCard
          key={item.subjectId}
          item={item}
          showSubscriptions={showSubscriptions}
          compact={compact}
        />
      ))}
    </div>
  );
}

export function StudentSubjects() {
  const { copy } = useStudentCopy();
  const { query, requested, selected } = useSubjectSelection();
  return (
    <div className="k8k-student-home k8k-subject-page">
      <h1>{copy.subjects}</h1>
      {selected && (
        <Link className="k8k-student-link" to={subjectHub}>
          {copy.allSubjects}
        </Link>
      )}
      <QueryState
        operational
        query={query}
        sourceTimestamp={query.data?.generatedAt}
        empty={!requested && query.data?.items.length === 0}
        emptyMessage={copy.emptySubjects}
      >
        {query.data &&
          (requested ? (
            selected ? (
              <SubjectCard key={selected.subjectId} item={selected} detail showSubscriptions />
            ) : (
              <SubjectUnavailable />
            )
          ) : (
            <SubjectCards items={query.data.items} showSubscriptions />
          ))}
      </QueryState>
    </div>
  );
}

export function StudentHelp() {
  const { copy } = useStudentCopy();
  const me = useMe();
  return (
    <div className="k8k-student-home k8k-subject-page">
      <h1>{copy.help}</h1>
      <StudentManagerCard
        contacts={me.managerContacts}
        unavailable={me.managerContactsUnavailable}
      />
      <section className="k8k-student-card">
        <h2>{copy.lessonHelp}</h2>
        <p>{copy.lessonHelpInfo}</p>
        <Link className="k8k-student-link" to="/student/lessons">
          {copy.openSchedule} <Icon name="arrow" />
        </Link>
      </section>
    </div>
  );
}
