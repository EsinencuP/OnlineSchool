import { formatDateTime, useLocale } from '@online-school/ui';
import type { PlatformWorkspaceDto } from '@online-school/api-contracts';
import { StaffCoverageNote } from '../StaffCoverageNote.js';
import { filters } from './navigation.js';
import type { StaffNavigation, StaffObjectSection } from './navigation.js';
import { useStaffCopy } from './copy.js';

export function StaffWorkspace({
  data,
  navigation,
}: {
  data: PlatformWorkspaceDto;
  navigation: StaffNavigation;
}) {
  const { locale, t, intlLocale } = useLocale();
  const copy = useStaffCopy();
  const { section, filter } = navigation.route;
  const overview = section === 'overview';
  const director = data.role === 'DIRECTOR';
  const zone = data.actorContext?.timezone;
  const asOf = Date.parse(data.actorContext?.asOf ?? '');
  const date = (value: string) => (zone ? (formatDateTime(value, locale, zone) ?? '—') : '—');
  const objectLink = (kind: StaffObjectSection, id: string) =>
    navigation.link(navigation.href(kind, id, kind === section ? filter : ''), kind === section);
  const lessons =
    filter && section === 'lessons'
      ? data.lessons.filter((row) => row.status === filter)
      : data.lessons;
  const homework =
    filter && section === 'homework'
      ? data.homework.filter((row) => !!row.dueAt === (filter === 'dated'))
      : data.homework;
  const tasks =
    filter && section === 'tasks' ? data.tasks.filter((row) => row.status === filter) : data.tasks;
  const empty = <p className="empty">{filter ? copy('sampleEmpty') : t('empty')}</p>;

  return (
    <>
      {filters[section].length > 0 && (
        <label className="staff-filter">
          {copy('filter')}
          <select
            value={filter}
            onChange={(event) =>
              navigation.navigate(
                navigation.href(section, undefined, event.target.value),
                false,
                false,
              )
            }
          >
            <option value="">{copy('all')}</option>
            {filters[section].map((value) => (
              <option key={value} value={value}>
                {copy(value === 'dated' ? 'due' : value === 'undated' ? 'noDue' : value)}
              </option>
            ))}
          </select>
        </label>
      )}
      {overview && (
        <>
          <div id="staff-summary-coverage">
            <StaffCoverageNote
              coverage={Object.values(data.coverage ?? {}).find(
                (coverage) => coverage.pageInfo.hasMore,
              )}
            />
          </div>
          <div className="stats" role="group" aria-describedby="staff-summary-coverage">
            <section>
              <span>{copy('upcomingCount')}</span>
              <strong>
                {Number.isFinite(asOf)
                  ? data.lessons.filter(
                      (row) => row.status === 'SCHEDULED' && Date.parse(row.startsAt) > asOf,
                    ).length
                  : '—'}
              </strong>
            </section>
            <section>
              <span>{director ? copy('studentCount') : t('nav.teacherStudents')}</span>
              <strong>{new Set(data.students.map((row) => row.id)).size}</strong>
            </section>
            <section>
              <span>{director ? copy('taskCount') : t('nav.homework')}</span>
              <strong>{director ? data.tasks.length : data.homework.length}</strong>
            </section>
          </div>
        </>
      )}
      {(overview || section === 'lessons') && (
        <section className="panel">
          <div className="section-heading">
            <h2>{copy(overview ? 'upcoming' : 'schedule')}</h2>
            <span>{zone ?? '—'}</span>
          </div>
          <StaffCoverageNote coverage={data.coverage?.lessons} />
          {lessons.length ? (
            <div className="lesson-list">
              {lessons.slice(0, overview ? 4 : 100).map((row) => (
                <article className="lesson" key={row.id}>
                  <div className="lesson-date">
                    <strong>
                      {zone
                        ? new Date(row.startsAt).toLocaleDateString(intlLocale, {
                            timeZone: zone,
                            day: 'numeric',
                          })
                        : '—'}
                    </strong>
                    <span>
                      {zone
                        ? new Date(row.startsAt).toLocaleDateString(intlLocale, {
                            timeZone: zone,
                            month: 'short',
                          })
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <h3>
                      <a {...objectLink('lessons', row.id)}>{row.subject}</a>
                    </h3>
                    <p>
                      {row.student}
                      {director ? ` · ${row.teacher}` : ''}
                    </p>
                    <time dateTime={row.startsAt}>
                      {date(row.startsAt)} ·{' '}
                      {Math.round((Date.parse(row.endsAt) - Date.parse(row.startsAt)) / 60000)}{' '}
                      {copy('minutes')}
                    </time>
                  </div>
                  <span className="badge">
                    {copy(row.status === 'IN_PROGRESS' ? 'lessonInProgress' : row.status)}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            empty
          )}
          {overview && data.lessons.length > 4 && (
            <a className="text-button" {...navigation.link(navigation.href('lessons'))}>
              {copy('fullSchedule')} →
            </a>
          )}
        </section>
      )}
      {section === 'students' && (
        <section className="panel">
          <h2>{director ? copy('enrolled') : t('nav.teacherStudents')}</h2>
          <StaffCoverageNote coverage={data.coverage?.students} />
          {data.students.length ? (
            data.students.map((row, index) => (
              <article className="simple-row" key={`${row.id}:${index}`}>
                <span className="pupil-avatar" aria-hidden="true">
                  {row.name.replace('[ДЕМО] ', '').slice(0, 1)}
                </span>
                <div>
                  <h3>
                    <a {...objectLink('students', row.id)}>{row.name}</a>
                  </h3>
                  <p>{row.subject}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="empty">{copy('studentsEmpty')}</p>
          )}
        </section>
      )}
      {(section === 'tasks' || (director && overview)) && (
        <section className="panel">
          <h2>{t('nav.managerTasks')}</h2>
          <StaffCoverageNote coverage={data.coverage?.tasks} />
          {tasks.length
            ? tasks.map((row) => {
                const overdue = Date.parse(row.dueAt) < asOf;
                return (
                  <article className="simple-row" key={row.id}>
                    <span
                      className={overdue ? 'task-dot overdue' : 'task-dot'}
                      aria-hidden="true"
                    />
                    <div>
                      <h3>
                        <a {...objectLink('tasks', row.id)}>{row.title}</a>
                      </h3>
                      <p>
                        {row.manager === 'Не назначен' ? copy('managerMissing') : row.manager} ·{' '}
                        {date(row.dueAt)}
                      </p>
                    </div>
                    <span className="badge">
                      {copy(row.status === 'OPEN' && overdue ? 'overdue' : row.status)}
                    </span>
                  </article>
                );
              })
            : empty}
        </section>
      )}
      {(section === 'homework' || (!director && overview)) && (
        <section className="panel">
          <h2>{t('nav.homework')}</h2>
          <StaffCoverageNote coverage={data.coverage?.homework} />
          {homework.length
            ? homework.map((row) => (
                <article className="simple-row" key={row.id}>
                  <div>
                    <h3>
                      <a {...objectLink('homework', row.id)}>{row.title}</a>
                    </h3>
                    <p>
                      {row.subject} · {row.dueAt ? date(row.dueAt) : copy('noDue')}
                    </p>
                  </div>
                </article>
              ))
            : empty}
        </section>
      )}
    </>
  );
}
