import { Link } from 'react-router-dom';
import { Icon as UIIcon, useLocale, FreshnessDisplay } from '@online-school/ui';
import {
  getStudentDashboard,
  getStudentHomework,
  getStudentUpcomingLessons,
  getStudentSkillMaps,
  getStudentSkillSnapshots,
} from '@online-school/api-contracts';
import { useStudentQuery } from '../api.js';
import { useMe } from '../Layout.js';
import { NextLessonHero } from '../lesson-hero.js';
import { StudentNotificationPreview } from '../StudentNotificationMenu.js';
import { QueryState, Status } from '../components.js';
import { formatStudentDate } from '../student-presentation.js';
import { StudentManagerCard, SubjectSubscriptions } from '../student-widgets.js';
import { useSubscriptionCopy } from '../subscription-copy.js';
import { useStudentCopy } from '../student-copy.js';
import { SubjectCards, subjectHub, subjectHref, useStudentSubjects } from './Subjects.js';
import { StagesTrack } from '../skill-widgets.js';
import { useSkillCopy, formatSkillDate } from '../skill-copy.js';

export function StudentHome() {
  const me = useMe();
  const { t } = useLocale();
  const { copy, locale } = useStudentCopy();
  const subjects = useStudentSubjects();
  const { copy: subscriptionsCopy } = useSubscriptionCopy();
  const date = (value: string | null, time = false) =>
    formatStudentDate(value, me.timeZone, time, locale);
  const dashboard = useStudentQuery(['dashboard'], getStudentDashboard, true, 60_000);
  const lessons = useStudentQuery(['upcoming'], getStudentUpcomingLessons, true, 30_000);
  const homework = useStudentQuery(['recent-homework'], (options) =>
    getStudentHomework({ pageSize: 3 }, options),
  );
  const skills = useStudentQuery(['skills'], (options) => getStudentSkillMaps(undefined, options));
  const snapshots = useStudentQuery(['snapshots', 'latest'], (options) =>
    getStudentSkillSnapshots({ pageSize: 1 }, options),
  );
  const nextLesson = dashboard.data?.nextLesson;
  const { text: skillText } = useSkillCopy();
  const snapshot = snapshots.data?.items[0];
  return (
    <FreshnessDisplay.Provider value="compact">
      <div className="k8k-student-home k8k-student-homepage">
        <div className="k8k-student-focus">
          <QueryState
            operational
            query={dashboard}
            sourceTimestamp={nextLesson?.meetAsOf ?? dashboard.data?.generatedAt}
            meet={{ lessons: nextLesson ? [nextLesson] : [], countdown: true }}
          >
            {dashboard.data && <NextLessonHero lesson={nextLesson ?? null} />}
          </QueryState>
          <nav className="k8k-student-shortcuts" aria-label={copy.shortcuts}>
            <Link to="/student/homework">
              <UIIcon name="tasks" />
              <span>{copy.homework}</span>
              <UIIcon name="arrow" />
            </Link>
            <Link to="/student/lessons">
              <UIIcon name="calendar" />
              <span>{t('schedule')}</span>
              <UIIcon name="arrow" />
            </Link>
            <Link to={subjectHub}>
              <UIIcon name="materials" />
              <span>{copy.subjects}</span>
              <UIIcon name="arrow" />
            </Link>
          </nav>
        </div>
        <div className="k8k-home-columns">
          <div className="k8k-student-home">
            <section data-module="DASH-STU-SUBJECTS">
              <div className="k8k-card-heading">
                <h2>{copy.subjects}</h2>
                <Link className="k8k-student-link" to={subjectHub}>
                  {copy.allSubjects} <UIIcon name="arrow" />
                </Link>
              </div>
              <QueryState
                query={subjects}
                operational
                sourceTimestamp={subjects.data?.generatedAt}
                empty={subjects.data?.items.length === 0}
                emptyMessage={copy.emptySubjects}
              >
                {subjects.data && <SubjectCards items={subjects.data.items} compact />}
              </QueryState>
            </section>
            <div className="k8k-student-panels">
              <section className="k8k-student-card" data-module="DASH-STU-03">
                <div className="k8k-card-heading">
                  <h2>{copy.upcoming}</h2>
                  <Link className="k8k-student-link" to="/student/lessons">
                    {copy.allSchedule} <UIIcon name="arrow" />
                  </Link>
                </div>
                <QueryState
                  operational
                  query={lessons}
                  empty={lessons.data?.items.length === 0}
                  emptyMessage={copy.emptyUpcoming}
                >
                  {lessons.data?.items.length ? (
                    <ul className="k8k-student-list">
                      {lessons.data.items.slice(0, 3).map((lesson) => (
                        <li key={lesson.lessonId}>
                          <div>
                            <h3>
                              <Link to={`/student/lessons/${lesson.lessonId}`}>
                                {lesson.subjectName}
                              </Link>
                            </h3>
                            <time dateTime={lesson.scheduledAt}>
                              {date(lesson.scheduledAt, true)}
                            </time>
                            <p title={lesson.teacherName}>{lesson.teacherName}</p>
                          </div>
                          <Status value={lesson.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{copy.emptyUpcoming}</p>
                  )}
                </QueryState>
              </section>
              <section className="k8k-student-card" data-module="DASH-STU-02">
                <div className="k8k-card-heading">
                  <h2>{copy.homework}</h2>
                  <Link className="k8k-student-link" to="/student/homework">
                    {copy.allHomework} <UIIcon name="arrow" />
                  </Link>
                </div>
                <QueryState
                  query={homework}
                  empty={homework.data?.items.length === 0}
                  emptyMessage={copy.emptyHomework}
                >
                  {homework.data?.items.length ? (
                    <>
                      <p className="k8k-student-caption">{copy.recent}</p>
                      <ul className="k8k-student-list">
                        {homework.data.items.map((item) => (
                          <li key={item.homeworkId}>
                            <div>
                              <p className="k8k-student-caption">{item.subjectName}</p>
                              <h3>
                                <Link to={`/student/homework/${item.homeworkId}`}>
                                  {item.title}
                                </Link>
                              </h3>
                              {item.dueAt && (
                                <p>
                                  {copy.due}:{' '}
                                  <time dateTime={item.dueAt}>{date(item.dueAt, true)}</time>
                                </p>
                              )}
                              {item.isLate && <p>{copy.late}</p>}
                            </div>
                            <Status value={item.status} />
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p>{copy.emptyHomework}</p>
                  )}
                </QueryState>
              </section>
            </div>
            <section className="k8k-student-card k8k-knowledge" data-module="DASH-STU-04">
              <div className="k8k-card-heading">
                <h2>{copy.skills}</h2>
                <Link className="k8k-student-link" to="/student/skills">
                  {copy.openMap} <UIIcon name="arrow" />
                </Link>
              </div>
              <p className="k8k-student-caption">{copy.knowledgeIntro}</p>
              <StagesTrack />
              <QueryState query={skills}>
                {skills.data?.length ? (
                  <ul className="k8k-student-list">
                    {skills.data.map((map) => {
                      const goal = map.learningGoals.find((item) => !item.isAchieved);
                      return (
                        <li key={map.subjectId}>
                          <div>
                            <h3>
                              <Link
                                className="k8k-student-link"
                                to={subjectHref('/student/skills', map.subjectId)}
                              >
                                {map.subjectName}
                              </Link>
                            </h3>
                            <p className="preserve-lines">
                              {goal ? skillText('goal') + ': ' + goal.text : skillText('noGoals')}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>{copy.emptySkills}</p>
                )}
              </QueryState>
              <QueryState query={snapshots}>
                {snapshot ? (
                  <p className="k8k-student-caption">
                    {skillText('lastSnapshot')}: {snapshot.subjectName} ·{' '}
                    {formatSkillDate(snapshot.createdAt, me.timeZone, locale)} ·{' '}
                    {skillText('afterLesson')} {snapshot.lessonNumber}
                  </p>
                ) : (
                  <p className="k8k-student-caption">{copy.noSnapshots}</p>
                )}
              </QueryState>
              <p className="k8k-student-caption">{skillText('cadence')}</p>
            </section>
            <Link className="k8k-student-link" to="/student/reports">
              {copy.reports}
            </Link>
          </div>
          <aside className="k8k-home-secondary">
            <StudentNotificationPreview />
            <StudentManagerCard
              contacts={me.managerContacts}
              unavailable={me.managerContactsUnavailable}
            />
            <section className="k8k-student-card" data-module="DASH-STU-05">
              <h2>{subscriptionsCopy.bySubject}</h2>
              <QueryState
                query={subjects}
                operational
                sourceTimestamp={subjects.data?.generatedAt}
                empty={subjects.data?.items.length === 0}
                emptyMessage={subscriptionsCopy.noSubjects}
              >
                {subjects.data && (
                  <SubjectSubscriptions items={subjects.data.items} timeZone={me.timeZone} />
                )}
              </QueryState>
            </section>
          </aside>
        </div>
      </div>
    </FreshnessDisplay.Provider>
  );
}
