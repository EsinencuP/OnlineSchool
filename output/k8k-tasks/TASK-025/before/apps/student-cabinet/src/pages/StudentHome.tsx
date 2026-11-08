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
import { date, JoinButton, QueryState, Status } from '../components.js';
import {
  lessonCountdown,
  serverSampleTime,
  studentModuleAvailability,
} from '../student-presentation.js';
import { SubjectSubscriptions } from '../student-widgets.js';

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
  const countdown = lesson ? lessonCountdown(lesson.scheduledAt, serverNow) : null;
  return (
    <section
      className="k8k-lesson-hero"
      data-module="DASH-STU-01"
      aria-labelledby="k8k-next-lesson-heading"
    >
      <p className="k8k-hero-label">
        <UIIcon name="video" /> Следующий урок
      </p>
      <h2 id="k8k-next-lesson-heading">
        {lesson?.subjectName ?? 'Ближайший урок пока не назначен'}
      </h2>
      {lesson ? (
        <>
          <p className="k8k-hero-date">
            <UIIcon name="calendar" />
            <time dateTime={lesson.scheduledAt}>{date(lesson.scheduledAt, true)}</time> ·{' '}
            {lesson.durationMinutes} мин
          </p>
          <p>Преподаватель: {lesson.teacherName}</p>
          {status && <Status value={status} />}
          {countdown && (
            <p className="k8k-hero-countdown">
              <UIIcon name="clock" />
              {countdown}
            </p>
          )}
          <div className="k8k-hero-actions">
            <JoinButton lesson={lesson} serverNow={serverNow} status={status} />
            <Link className="k8k-student-link" to={`/student/lessons/${lesson.lessonId}`}>
              Открыть урок <UIIcon name="arrow" />
            </Link>
          </div>
        </>
      ) : (
        <>
          <p>
            Когда занятие появится в расписании, здесь будут время, преподаватель и доступное
            подключение.
          </p>
          <Link className="k8k-main-action" to="/student/lessons">
            Открыть расписание <UIIcon name="arrow" />
          </Link>
        </>
      )}
    </section>
  );
}

export function StudentHome() {
  const me = useMe();
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
        <h1>Привет, {me.displayName}!</h1>
        <p>Твои уроки и задания — всё под рукой.</p>
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
        <nav className="k8k-student-shortcuts" aria-label="Быстрые входы">
          <Link to="/student/homework">
            <UIIcon name="tasks" />
            <span>Мои задания</span>
            <UIIcon name="arrow" />
          </Link>
          <Link to="/student/lessons">
            <UIIcon name="calendar" />
            <span>Расписание</span>
            <UIIcon name="arrow" />
          </Link>
        </nav>
      </div>
      <div className="k8k-student-panels">
        <section className="k8k-student-card" data-module="DASH-STU-03">
          <div className="k8k-card-heading">
            <h2>Ближайшие занятия</h2>
            <Link className="k8k-student-link" to="/student/lessons">
              Всё расписание <UIIcon name="arrow" />
            </Link>
          </div>
          <QueryState operational query={lessons} empty={lessons.data?.items.length === 0}>
            {lessons.data?.items.length ? (
              <ul className="k8k-student-list">
                {lessons.data.items.slice(0, 3).map((lesson) => (
                  <li key={lesson.lessonId}>
                    <div>
                      <h3>
                        <Link to={`/student/lessons/${lesson.lessonId}`}>{lesson.subjectName}</Link>
                      </h3>
                      <time dateTime={lesson.scheduledAt}>{date(lesson.scheduledAt, true)}</time>
                      <p>{lesson.teacherName}</p>
                    </div>
                    <Status value={lesson.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p>Ближайших занятий пока нет. Проверь расписание позже.</p>
            )}
          </QueryState>
        </section>
        <section className="k8k-student-card" data-module="DASH-STU-02">
          <div className="k8k-card-heading">
            <h2>Мои задания</h2>
            <Link className="k8k-student-link" to="/student/homework">
              Все задания <UIIcon name="arrow" />
            </Link>
          </div>
          <QueryState query={homework} empty={homework.data?.items.length === 0}>
            {homework.data?.items.length ? (
              <>
                <p className="k8k-student-caption">Последние выданные работы</p>
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
                            Срок: <time dateTime={item.dueAt}>{date(item.dueAt, true)}</time>
                          </p>
                        )}
                        {item.isLate && <p>Сдано с опозданием</p>}
                      </div>
                      <Status value={item.status} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Заданий пока нет. Здесь появятся работы, которые выдаст преподаватель.</p>
            )}
          </QueryState>
        </section>
      </div>
      <section className="k8k-student-card k8k-knowledge" data-module="DASH-STU-04">
        <div className="k8k-card-heading">
          <h2>Мой путь знаний</h2>
          <Link className="k8k-student-link" to="/student/skills">
            Открыть карту <UIIcon name="arrow" />
          </Link>
        </div>
        <p className="k8k-student-caption">Этап каждого навыка подтверждает преподаватель.</p>
        <ol className="k8k-stages" aria-label="Этапы освоения">
          <li>Знакомлюсь</li>
          <li>Практикую</li>
          <li>Применяю</li>
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
              {!firstSubject.skills.length && <p>Преподаватель ещё не добавил навыки.</p>}
              {goal && (
                <p className="k8k-learning-goal">
                  <strong>Учебная цель:</strong> {goal.text}
                  {goal.targetDate && <> · до {date(goal.targetDate)}</>}
                </p>
              )}
            </>
          ) : (
            <p>
              Карта появится после назначения предмета. Опубликованные навыки будут видны здесь.
            </p>
          )}
        </QueryState>
        <QueryState query={snapshots}>
          {snapshot ? (
            <details className="k8k-published-snapshot">
              <summary>
                Последний опубликованный срез: {snapshot.subjectName} · {date(snapshot.createdAt)}
              </summary>
              <p>После урока {snapshot.lessonNumber}</p>
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
            <p className="k8k-student-caption">Опубликованных срезов пока нет.</p>
          )}
        </QueryState>
      </section>
      <Link className="k8k-student-link" to="/student/reports">
        Опубликованные отчёты после восьми уроков
      </Link>
      <SubjectSubscriptions enabled={studentModuleAvailability.subjectSubscriptions} />
    </div>
  );
}
