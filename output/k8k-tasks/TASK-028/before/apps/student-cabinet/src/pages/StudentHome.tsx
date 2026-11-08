import { useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon as UIIcon } from '@online-school/ui';
import {
  getStudentDashboard,
  getStudentHomework,
  getStudentUpcomingLessons,
  getStudentSkillMaps,
  getStudentSkillSnapshots,
} from '@online-school/api-contracts';
import type { NextLessonDto } from '@online-school/api-contracts';
import { StudentDeadlineRead, useStudentQuery } from '../api.js';
import { useMe } from '../Layout.js';
import { JoinButton, QueryState, Status } from '../components.js';
import { formatStudentDate, lessonCountdown, serverSampleTime } from '../student-presentation.js';
import { StudentManagerCard, SubjectSubscriptions } from '../student-widgets.js';
import { useSubscriptionCopy } from '../subscription-copy.js';
import { useStudentCopy } from '../student-copy.js';
import { SubjectCards, subjectHub, useStudentSubjects } from './Subjects.js';

function NextLesson({
  lesson,
  serverAt,
  receivedAt,
  status,
}: {
  lesson: NextLessonDto | null;
  serverAt: string;
  receivedAt: number;
  status?: string | undefined;
}) {
  const { copy, locale } = useStudentCopy();
  const { timeZone } = useMe();
  const requestRead = useContext(StudentDeadlineRead);
  const sample = useRef({
    at: serverAt,
    receivedAt,
    server: serverSampleTime(serverAt, receivedAt, Date.now()),
    monotonic: performance.now(),
  });
  if (sample.current.at !== serverAt || sample.current.receivedAt !== receivedAt)
    sample.current = {
      at: serverAt,
      receivedAt,
      server: serverSampleTime(serverAt, receivedAt, Date.now()),
      monotonic: performance.now(),
    };
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const serverNow =
    sample.current.server === null
      ? null
      : sample.current.server + performance.now() - sample.current.monotonic;
  useEffect(() => {
    if (!lesson || lesson.canJoin) return;
    const serverNowAtRead = serverSampleTime(serverAt, receivedAt, Date.now());
    if (serverNowAtRead === null) return;
    const delay = Date.parse(lesson.scheduledAt) - 600_000 - serverNowAtRead;
    if (delay <= 0 || delay > 2_147_483_647) return;
    const dueAt = performance.now() + delay;
    const timer = window.setTimeout(() => requestRead('deadline', dueAt), delay + 100);
    return () => window.clearTimeout(timer);
  }, [requestRead, lesson?.lessonId, lesson?.scheduledAt, lesson?.canJoin, serverAt, receivedAt]);
  const countdown = lesson ? lessonCountdown(lesson.scheduledAt, serverNow, locale) : null;
  return (
    <section
      className="k8k-lesson-hero"
      data-module="DASH-STU-01"
      aria-labelledby="k8k-next-lesson-heading"
    >
      <p className="k8k-hero-label">
        <UIIcon name="video" /> {copy.nextLesson}
      </p>
      <h2 id="k8k-next-lesson-heading">{lesson?.subjectName ?? copy.noLesson}</h2>
      {lesson ? (
        <>
          <p className="k8k-hero-date">
            <UIIcon name="calendar" />
            <time dateTime={lesson.scheduledAt}>
              {formatStudentDate(lesson.scheduledAt, timeZone, true, locale)}
            </time>{' '}
            · {lesson.durationMinutes} {copy.minutes}
          </p>
          <p>
            {copy.teacher}: {lesson.teacherName}
          </p>
          {status && <Status value={status} />}
          {countdown && (
            <p className="k8k-hero-countdown">
              <UIIcon name="clock" />
              {countdown}
            </p>
          )}
          <div className="k8k-hero-actions">
            <JoinButton
              lesson={lesson}
              serverNow={serverNow}
              status={status}
              fallback={
                <Link className="k8k-main-action" to={`/student/lessons/${lesson.lessonId}`}>
                  {copy.openLesson} <UIIcon name="arrow" />
                </Link>
              }
              secondary={
                <Link className="k8k-student-link" to={`/student/lessons/${lesson.lessonId}`}>
                  {copy.openLesson} <UIIcon name="arrow" />
                </Link>
              }
            />
          </div>
        </>
      ) : (
        <>
          <p>{copy.noLessonInfo}</p>
          <Link className="k8k-main-action" to="/student/lessons">
            {copy.openSchedule} <UIIcon name="arrow" />
          </Link>
        </>
      )}
    </section>
  );
}

export function StudentHome() {
  const me = useMe();
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
  const nextId = dashboard.data?.nextLesson?.lessonId;
  const nextStatus = lessons.data?.items.find((lesson) => lesson.lessonId === nextId)?.status;
  const firstSubject = skills.data?.[0];
  const goal = firstSubject?.learningGoals.find((item) => !item.isAchieved);
  const snapshot = snapshots.data?.items[0];
  return (
    <div className="k8k-student-home">
      <div className="k8k-student-heading">
        <h1>
          {copy.greeting}, {me.displayName}!
        </h1>
        <p>{copy.intro}</p>
      </div>
      <div className="k8k-student-focus">
        <QueryState operational query={dashboard} sourceTimestamp={dashboard.data?.generatedAt}>
          {dashboard.data && (
            <NextLesson
              lesson={dashboard.data.nextLesson}
              serverAt={dashboard.data.generatedAt}
              receivedAt={dashboard.dataUpdatedAt}
              status={nextStatus}
            />
          )}
        </QueryState>
        <nav className="k8k-student-shortcuts" aria-label={copy.shortcuts}>
          <Link to="/student/homework">
            <UIIcon name="tasks" />
            <span>{copy.homework}</span>
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
              {subjects.data && <SubjectCards items={subjects.data.items} />}
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
                          <p>{lesson.teacherName}</p>
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
                              <Link to={`/student/homework/${item.homeworkId}`}>{item.title}</Link>
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
            <ol className="k8k-stages" aria-label={copy.stages}>
              <li>
                <Status value="FAMILIARIZING" />
              </li>
              <li>
                <Status value="PRACTICING" />
              </li>
              <li>
                <Status value="APPLYING" />
              </li>
            </ol>
            <QueryState query={skills}>
              {firstSubject ? (
                <>
                  <h3>{firstSubject.subjectName}</h3>
                  <ul className="k8k-student-list">
                    {firstSubject.skills.slice(0, 3).map((skill) => (
                      <li key={skill.skillId}>
                        <span>{skill.name}</span>
                        <Status value={skill.status} />
                      </li>
                    ))}
                  </ul>
                  {!firstSubject.skills.length && <p>{copy.noSkills}</p>}
                  {goal && (
                    <p className="k8k-learning-goal">
                      <strong>{copy.goal}:</strong> {goal.text}
                      {goal.targetDate && (
                        <>
                          {' '}
                          · {copy.due}: {date(goal.targetDate)}
                        </>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <p>{copy.emptySkills}</p>
              )}
            </QueryState>
            <QueryState query={snapshots}>
              {snapshot ? (
                <details className="k8k-published-snapshot">
                  <summary>
                    {copy.lastSnapshot}: {snapshot.subjectName} · {date(snapshot.createdAt)}
                  </summary>
                  <p>
                    {copy.afterLesson} {snapshot.lessonNumber}
                  </p>
                  {snapshot.teacherSummary && <p>{snapshot.teacherSummary}</p>}
                  <ul className="k8k-student-list">
                    {snapshot.skills.map((skill, index) => (
                      <li key={`${skill.skillName}:${index}`}>
                        <div>
                          <strong>{skill.skillName}</strong>
                          {skill.teacherComment && <p>{skill.teacherComment}</p>}
                        </div>
                        <Status value={skill.status} />
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="k8k-student-caption">{copy.noSnapshots}</p>
              )}
            </QueryState>
          </section>
          <Link className="k8k-student-link" to="/student/reports">
            {copy.reports}
          </Link>
        </div>
        <aside className="k8k-home-secondary">
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
  );
}
