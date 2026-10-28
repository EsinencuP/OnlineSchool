import { Link } from 'react-router-dom';
import {
  getStudentDashboard,
  getStudentHomework,
  getStudentUpcomingLessons,
  getStudentSkillMaps,
} from '@online-school/api-contracts';
import { useStudentQuery } from '../api.js';
import {
  Countdown,
  date,
  Empty,
  Icon,
  JoinButton,
  Panel,
  plural,
  QueryState,
  Status,
} from '../components.js';
import { useMe } from '../Layout.js';
import { LessonList } from './Lessons.js';
export function Dashboard() {
  const me = useMe(),
    dashboard = useStudentQuery(['dashboard'], getStudentDashboard, true, 60_000);
  const lessons = useStudentQuery(['upcoming'], getStudentUpcomingLessons, true, 30_000);
  const homework = useStudentQuery(['recent-homework'], (o) =>
    getStudentHomework({ pageSize: 3 }, o),
  );
  const skills = useStudentQuery(['skills'], (o) => getStudentSkillMaps(undefined, o));
  const data = dashboard.data,
    progress = data?.skillProgress;
  const total = progress
    ? progress.familiarizing + progress.practicing + progress.applying + progress.notStudied
    : 0;
  return (
    <>
      <section className="welcome">
        <div>
          <p className="eyebrow">Твой следующий шаг</p>
          <h1>
            Привет, {me.displayName}! <span aria-hidden="true">👋</span>
          </h1>
          <p>Продолжаем идти к большим целям. Всё начинается с одного урока.</p>
        </div>
        <div className="mountains" aria-hidden="true">
          <span />
          <span />
          <span />
          <i>⚑</i>
        </div>
      </section>
      <QueryState query={dashboard}>
        {data && (
          <div className="summary-grid">
            <section className="summary">
              <span className="summary-icon blue">
                <Icon name="lessons" />
              </span>
              <div>
                <h2>Следующий урок</h2>
                {data.nextLesson ? (
                  <>
                    <Link
                      className="summary-value"
                      to={`/student/lessons/${data.nextLesson.lessonId}`}
                    >
                      {date(data.nextLesson.scheduledAt, true)}
                    </Link>
                    <small>{data.nextLesson.subjectName}</small>
                    <Countdown at={data.nextLesson.scheduledAt} />
                    <JoinButton lesson={data.nextLesson} />
                  </>
                ) : (
                  <p>Пока не запланирован</p>
                )}
              </div>
            </section>
            <Link className="summary" to="/student/homework">
              <span className="summary-icon orange">
                <Icon name="homework" />
              </span>
              <div>
                <h2>Домашние задания</h2>
                <strong className="summary-value">
                  {plural(data.homework.total, ['задание', 'задания', 'заданий'])}
                </strong>
                <small>
                  Не сдано: {data.homework.notSubmitted} · Сдано: {data.homework.submitted}
                </small>
                <small>На доработку: {data.homework.needsRevision}</small>
              </div>
            </Link>
            <Link className="summary" to="/student/skills">
              <span className="summary-icon green">
                <Icon name="skills" />
              </span>
              <div>
                <h2>Мой путь знаний</h2>
                <strong className="summary-value">{progress?.applying ?? 0} применяю</strong>
                <progress
                  aria-label="Навыки на уровне «Применяю»"
                  value={progress?.applying ?? 0}
                  max={total || 1}
                />
                <small>{total} навыков в карте</small>
              </div>
            </Link>
            <Link className="summary" to="/student/subscription">
              <span className="summary-icon pink">
                <Icon name="subscription" />
              </span>
              <div>
                <h2>Осталось занятий</h2>
                <strong className="summary-value">
                  {data.subscription?.lessonsRemaining ?? '—'}
                </strong>
                <small>
                  {data.subscription
                    ? `До ${date(data.subscription.validUntil)}`
                    : 'Нет активного абонемента'}
                </small>
              </div>
            </Link>
          </div>
        )}
      </QueryState>
      <Panel title="Ближайшие уроки" to="/student/lessons">
        <QueryState query={lessons}>
          <LessonList
            items={
              lessons.data?.items
                .filter(
                  (l) =>
                    new Date(l.scheduledAt).getTime() + l.durationMinutes * 60_000 > Date.now() &&
                    l.status === 'SCHEDULED',
                )
                .slice(0, 5) ?? []
            }
          />
        </QueryState>
      </Panel>
      <div className="dashboard-bottom">
        <Panel title="Домашние задания" to="/student/homework">
          <QueryState query={homework}>
            {homework.data?.items.length ? (
              <ul className="homework-preview">
                {homework.data.items.map((h) => (
                  <li key={h.homeworkId}>
                    <div>
                      <small>{h.subjectName}</small>
                      <Link to={`/student/homework/${h.homeworkId}`}>{h.title}</Link>
                      <small>Сдать до {date(h.dueAt)}</small>
                    </div>
                    <Status value={h.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Новых заданий пока нет.</Empty>
            )}
          </QueryState>
        </Panel>
        <Panel title="Мой путь знаний" to="/student/skills">
          <QueryState query={skills}>
            {skills.data?.length ? (
              skills.data.slice(0, 1).map((s) => (
                <div key={s.subjectId}>
                  <h3>{s.subjectName}</h3>
                  <ul className="skill-list">
                    {s.skills.slice(0, 4).map((skill) => (
                      <li key={skill.skillId}>
                        <span>{skill.name}</span>
                        <Status value={skill.status} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <Empty>Карта появится после назначения предмета.</Empty>
            )}
          </QueryState>
        </Panel>
      </div>
    </>
  );
}
