import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Select, StatusChip } from '@online-school/ui';
import {
  getStudentSkillAudit,
  getStudentSkillMaps,
  getStudentSkillSnapshots,
} from '@online-school/api-contracts';
import { useStudentQuery } from '../api.js';
import { useMe } from '../Layout.js';
import { Empty, Pager, Panel, QueryState } from '../components.js';
import { SkillStatus, StagesTrack } from '../skill-widgets.js';
import { useSkillCopy, formatSkillDate } from '../skill-copy.js';
import { SubjectBack, SubjectUnavailable } from './Subjects.js';

function SkillHistory({ id }: { id: string }) {
  const { text, locale } = useSkillCopy();
  const { timeZone } = useMe();
  const [page, setPage] = useState(1);
  const query = useStudentQuery(['skill-history', id, page], (o) =>
    getStudentSkillAudit({ skillId: id, page }, o),
  );
  return (
    <QueryState query={query}>
      {query.data && (
        <>
          {query.data.items.length ? (
            <ol className="versions">
              {query.data.items.map((entry) => (
                <li key={entry.auditId}>
                  <strong>{entry.skillName}</strong>
                  <p>
                    <time dateTime={entry.changedAt}>
                      {formatSkillDate(entry.changedAt, timeZone, locale, true)}
                    </time>
                    {entry.teacherName && <> · {entry.teacherName}</>}
                  </p>
                  <p className="k8k-skill-transition">
                    <SkillStatus status={entry.fromStatus} /> <span aria-hidden="true">→</span>{' '}
                    <SkillStatus status={entry.toStatus} />
                  </p>
                  <p className="preserve-lines">{entry.comment ?? text('noComment')}</p>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>{text('emptyAudit')}</Empty>
          )}
          <Pager {...query.data} change={setPage} />
        </>
      )}
    </QueryState>
  );
}

function positivePage(value: string | null) {
  return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
    ? Number(value)
    : 1;
}
export function SkillMap() {
  const { text, locale } = useSkillCopy();
  const { timeZone } = useMe();
  const [params, setParams] = useSearchParams();
  const ids = params.getAll('subjectId');
  const subjectId = ids.length === 1 ? ids[0] : undefined;
  const valid =
    ids.length === 0 ||
    (ids.length === 1 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectId ?? ''));
  const [expanded, setExpanded] = useState<{ subjectId: string; skillId: string } | null>(null);
  const controlsId = useId();
  const page = positivePage(params.get('snapshotPage'));
  const options = useStudentQuery(['skills'], (o) => getStudentSkillMaps(undefined, o));
  const maps = useStudentQuery(
    subjectId ? ['skills', subjectId] : ['skills'],
    (o) => getStudentSkillMaps(subjectId ? { subjectId } : undefined, o),
    valid,
  );
  const snapshots = useStudentQuery(
    ['snapshots', subjectId ?? null, page],
    (o) => getStudentSkillSnapshots({ page, ...(subjectId ? { subjectId } : {}) }, o),
    valid,
  );
  const date = (value: string, time = false) => formatSkillDate(value, timeZone, locale, time);
  const change = (id: string) => {
    const next = new URLSearchParams(params);
    next.delete('subjectId');
    next.delete('snapshotPage');
    if (id) next.set('subjectId', id);
    setExpanded(null);
    setParams(next, { preventScrollReset: true });
  };
  return (
    <div className="k8k-skills-page">
      <h1>{text('title')}</h1>
      <p className="lead">{text('lead')}</p>
      <StagesTrack />
      <QueryState query={options}>
        <Select
          label={text('subject')}
          value={subjectId ?? ''}
          onChange={(event) => change(event.target.value)}
        >
          <option value="">{text('all')}</option>
          {subjectId && !options.data?.some((map) => map.subjectId === subjectId) && (
            <option value={subjectId}>{text('subject')}</option>
          )}
          {options.data?.map((map) => (
            <option value={map.subjectId} key={map.subjectId}>
              {map.subjectName}
            </option>
          ))}
        </Select>
      </QueryState>
      {!valid ? (
        <SubjectUnavailable />
      ) : (
        <QueryState query={maps}>
          {maps.data && (
            <>
              <div className="k8k-skill-actions">
                <SubjectBack id={subjectId} />
                <Button
                  variant="secondary"
                  onClick={() => {
                    void maps.refetch();
                    void snapshots.refetch();
                  }}
                >
                  {text('refresh')}
                </Button>
              </div>
              {maps.data.length ? (
                maps.data.map((map) => (
                  <Panel key={map.subjectId} title={map.subjectName}>
                    <p className="k8k-student-caption">
                      {text('count')}: {map.totalSkills}
                    </p>
                    <ul className="skill-list k8k-skill-list">
                      {map.skills.map((skill) => {
                        const open =
                          expanded?.subjectId === map.subjectId &&
                          expanded.skillId === skill.skillId;
                        const historyId = controlsId + '-' + skill.skillId;
                        return (
                          <li key={skill.skillId}>
                            <div className="k8k-skill-heading">
                              <div>
                                <h3>{skill.name}</h3>
                                {skill.category && <p>{skill.category}</p>}
                              </div>
                              <SkillStatus status={skill.status} />
                            </div>
                            {skill.lastUpdatedByTeacherName ? (
                              <p>
                                {text('assessed')}: {date(skill.lastUpdatedAt, true)} ·{' '}
                                {skill.lastUpdatedByTeacherName}
                              </p>
                            ) : (
                              <>
                                <p>{text('noAssessment')}</p>
                                <p className="k8k-student-caption">
                                  {text('catalogDate')}: {date(skill.lastUpdatedAt)}
                                </p>
                              </>
                            )}
                            <Button
                              variant="secondary"
                              aria-expanded={open}
                              aria-controls={historyId}
                              onClick={() =>
                                setExpanded(
                                  open
                                    ? null
                                    : { subjectId: map.subjectId, skillId: skill.skillId },
                                )
                              }
                            >
                              {text('history')}
                            </Button>
                            <div id={historyId} hidden={!open}>
                              {open && <SkillHistory key={skill.skillId} id={skill.skillId} />}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {!map.skills.length && <Empty>{text('noSkills')}</Empty>}
                    <h3>{text('goals')}</h3>
                    {map.learningGoals.length ? (
                      <ul className="k8k-skill-goals">
                        {map.learningGoals.map((goal) => (
                          <li key={goal.goalId}>
                            <p className="preserve-lines">{goal.text}</p>
                            <StatusChip tone={goal.isAchieved ? 'success' : 'neutral'}>
                              {text(goal.isAchieved ? 'achieved' : 'activeGoal')}
                            </StatusChip>
                            <p>
                              {goal.targetDate
                                ? text('due') + ': ' + date(goal.targetDate)
                                : text('noDate')}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Empty>{text('noGoals')}</Empty>
                    )}
                    <p>
                      {map.lastSnapshotAt
                        ? text('lastSnapshot') + ': ' + date(map.lastSnapshotAt)
                        : text('noLastSnapshot')}
                    </p>
                    <p>
                      {map.nextSnapshotIn === null
                        ? text('unknownNext')
                        : text('next') + ': ' + map.nextSnapshotIn}
                    </p>
                  </Panel>
                ))
              ) : (
                <Empty>{text('noSubjects')}</Empty>
              )}
              <Panel title={text('snapshotTitle')}>
                <p>{text('cadence')}</p>
                <p>{text('historyHelp')}</p>
                <Link className="k8k-student-link" to="/student/reports">
                  {text('reports')}
                </Link>
                <QueryState query={snapshots}>
                  {snapshots.data && (
                    <>
                      {snapshots.data.items.length ? (
                        snapshots.data.items.map((snapshot) => (
                          <details className="k8k-skill-snapshot" key={snapshot.snapshotId}>
                            <summary>
                              {snapshot.subjectName} · {date(snapshot.createdAt)} ·{' '}
                              {text('afterLesson')} {snapshot.lessonNumber}
                            </summary>
                            <p className="preserve-lines">
                              {snapshot.teacherSummary ?? text('noSummary')}
                            </p>
                            <ul className="k8k-frozen-skills">
                              {snapshot.skills.map((skill, index) => (
                                <li key={index}>
                                  <h3>{skill.skillName}</h3>
                                  <SkillStatus status={skill.status} />
                                  {skill.teacherComment && (
                                    <p className="preserve-lines">{skill.teacherComment}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ))
                      ) : (
                        <Empty>{text('noSnapshots')}</Empty>
                      )}
                      <Pager
                        {...snapshots.data}
                        change={(nextPage) => {
                          const next = new URLSearchParams(params);
                          next.set('snapshotPage', String(nextPage));
                          setParams(next, { preventScrollReset: true });
                        }}
                      />
                    </>
                  )}
                </QueryState>
              </Panel>
            </>
          )}
        </QueryState>
      )}
    </div>
  );
}
