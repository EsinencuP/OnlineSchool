import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { Icon as UIIcon } from '@online-school/ui';
import { getStudentDashboard } from '@online-school/api-contracts';
import type { NextLessonDto } from '@online-school/api-contracts';
import { useStudentQuery } from './api.js';
import { useMe } from './Layout.js';
import { JoinButton, QueryState, Status } from './components.js';
import {
  formatStudentDate,
  lessonCountdown,
  meetTime,
  StudentMeetClock,
} from './student-presentation.js';
import { useStudentCopy } from './student-copy.js';

export function NextLessonHero({ lesson }: { lesson: NextLessonDto | null }) {
  const { copy, locale } = useStudentCopy();
  const { timeZone } = useMe();
  const { clock } = useContext(StudentMeetClock);
  const serverNow = meetTime(clock, performance.now());
  const countdown = lesson ? lessonCountdown(lesson.scheduledAt, serverNow, locale) : null;
  return (
    <section
      className="k8k-lesson-hero"
      data-module="DASH-STU-01"
      aria-labelledby="k8k-next-lesson-heading"
    >
      <h2 id="k8k-next-lesson-heading">
        <UIIcon name="video" />
        {copy.nextLesson}
      </h2>
      <h3>{lesson?.subjectName ?? copy.noLesson}</h3>
      {lesson ? (
        <>
          <p className="k8k-hero-date">
            <UIIcon name="calendar" />
            <time dateTime={lesson.scheduledAt}>
              {formatStudentDate(lesson.scheduledAt, timeZone, true, locale)}
            </time>{' '}
            · {lesson.durationMinutes} {copy.minutes}
          </p>
          <p className="k8k-hero-teacher">
            <UIIcon name="profile" />
            {copy.teacher}: {lesson.teacherName}
          </p>
          <div className="k8k-hero-meta">
            {lesson.status && <Status value={lesson.status} />}
            {countdown && (
              <p className="k8k-hero-countdown">
                <UIIcon name="clock" />
                {countdown}
              </p>
            )}
          </div>
          <div className="k8k-hero-actions">
            <JoinButton
              lesson={lesson}
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

export function StudentNextLessonHero() {
  const query = useStudentQuery(['dashboard'], getStudentDashboard, true, 60_000);
  const lesson = query.data?.nextLesson;
  return (
    <QueryState
      operational
      query={query}
      sourceTimestamp={lesson?.meetAsOf ?? query.data?.generatedAt}
      meet={{ lessons: lesson ? [lesson] : [], countdown: true }}
    >
      {query.data && <NextLessonHero lesson={lesson ?? null} />}
    </QueryState>
  );
}
