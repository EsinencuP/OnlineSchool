import { useId, useState } from 'react';
import type { components } from '@online-school/api-contracts';
import { formatDateTime, Icon, useLocale } from '@online-school/ui';
import { SubjectIcon } from './Brand.js';
import { CabinLink } from './Home.js';

import { useEndpoint } from './hooks.js';
import { teacherStudentsPath } from './recordRoutes.js';
import { isRouteUuid } from './studentSubjectRoutes.js';
import { TeacherStudentGoals } from './TeacherStudentGoals.js';
import { TeacherStudentSkills } from './TeacherStudentSkills.js';

type Schemas = components['schemas'];
type Overview = Schemas['TeacherStudentOverviewDto'];
type Lesson = Schemas['OverviewLessonDto'];
type Navigate = (url: string) => void;
type DateLabel = (value: string) => string;
type Tab = 'overview' | 'skills' | 'goals';

const tabs: Tab[] = ['overview', 'skills', 'goals'];
const copy = {
  ru: {
    find: 'Поиск по имени',
    subject: 'Предмет',
    allSubjects: 'Все предметы',
    noStudents: 'Назначенных учеников пока нет.',
    noMatches: 'Ученики не найдены.',
    loading: 'Загружаем данные…',
    unavailable: 'Данные ученика недоступны.',
    retry: 'Обновить данные',
    back: 'К списку учеников',
    sections: 'Разделы карточки ученика',
    tabs: { overview: 'Обзор ученика', skills: 'Карта навыков', goals: 'Цели обучения' },
    teacherSince: 'Веду занятия с',
    confirmed: 'Подтверждённые уроки',
    upcoming: 'Ближайшие уроки',
    recent: 'Недавние уроки',
    next: 'Следующий урок',
    noUpcoming: 'Ближайших уроков нет.',
    noRecent: 'Недавних уроков нет.',
    toReview: 'Уроков до оценки навыков',
    pending: 'Ожидают среза или отчёта',
    activeGoals: 'Активные цели',
    homework: 'Домашние задания',
    homeworkStages: ['Ожидают сдачи', 'На проверке', 'На доработке', 'Проверено'],
    skillStages: ['Не изучено', 'Знакомится', 'Практикуется', 'Применяет'],
    scheduled: 'Запланирован',
    renewal: 'Ожидает продления',
    conducted: 'Проведён',
    cancelled: 'Отменён',
    disputed: 'Оспаривается',
  },
  ro: {
    find: 'Caută după nume',
    subject: 'Disciplina',
    allSubjects: 'Toate disciplinele',
    noStudents: 'Nu aveți încă elevi atribuiți.',
    noMatches: 'Nu s-au găsit elevi.',
    loading: 'Se încarcă datele…',
    unavailable: 'Datele elevului nu sunt disponibile.',
    retry: 'Reîncarcă datele',
    back: 'Înapoi la lista elevilor',
    sections: 'Secțiunile fișei elevului',
    tabs: {
      overview: 'Prezentarea elevului',
      skills: 'Harta competențelor',
      goals: 'Obiective de învățare',
    },
    teacherSince: 'Profesor din',
    confirmed: 'Lecții confirmate',
    upcoming: 'Lecții viitoare',
    recent: 'Lecții recente',
    next: 'Următoarea lecție',
    noUpcoming: 'Nu sunt programate lecții.',
    noRecent: 'Nu există lecții recente.',
    toReview: 'Lecții până la evaluarea competențelor',
    pending: 'Evaluări sau rapoarte în așteptare',
    activeGoals: 'Obiective active',
    homework: 'Teme pentru acasă',
    homeworkStages: ['Așteaptă predarea', 'În verificare', 'Pentru revizuire', 'Verificate'],
    skillStages: ['Nestudiat', 'Se familiarizează', 'Exersează', 'Aplică'],
    scheduled: 'Programată',
    renewal: 'Așteaptă reînnoirea',
    conducted: 'Desfășurată',
    cancelled: 'Anulată',
    disputed: 'Contestată',
  },
};

type Copy = (typeof copy)[keyof typeof copy];
const lessonStatus = {
  SCHEDULED: 'scheduled',
  STAR_PENDING: 'renewal',
  CONDUCTED: 'conducted',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
} satisfies Record<string, keyof Copy>;

function studentUrl(id: string, tab: Tab = 'overview') {
  return (
    teacherStudentsPath +
    '/' +
    encodeURIComponent(id) +
    (tab === 'overview' ? '' : '?' + new URLSearchParams({ tab }))
  );
}

function StudentReadState({
  pending,
  retry,
  t,
}: {
  pending?: boolean;
  retry?: () => void;
  t: Copy;
}) {
  return (
    <div
      className={pending ? 'cab-empty' : 'cab-empty cab-empty-error'}
      role={pending ? 'status' : 'alert'}
    >
      {pending ? t.loading : t.unavailable}
      {!pending && retry && (
        <button type="button" className="cab-text-button" onClick={retry}>
          {t.retry}
        </button>
      )}
    </div>
  );
}

function StudentDirectory({ navigate, t, date }: { navigate: Navigate; t: Copy; date: DateLabel }) {
  const result = useEndpoint<Schemas['TeacherEnrollmentsResponseDto']>('getTeacherEnrollments');
  const [filter, setFilter] = useState('');
  const [subject, setSubject] = useState('');
  const subjectControl = useId();
  if (!result.data)
    return <StudentReadState pending={result.pending} retry={result.refresh} t={t} />;
  const { items } = result.data;
  if (!items.length) return <p className="cab-empty">{t.noStudents}</p>;
  const subjects = new Map(items.map((item) => [item.subjectId, item.subjectName]));
  const term = filter.trim().toLocaleLowerCase();
  const visible = items.filter(
    (item) =>
      (!subject || item.subjectId === subject) &&
      item.studentName.toLocaleLowerCase().includes(term),
  );
  return (
    <div className="cab-lesson-stack">
      <div className="cab-card cab-panel cab-fields">
        <label className="cab-form-label">
          <span>{t.find}</span>
          <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} />
        </label>
        <div className="cab-form-label">
          <label htmlFor={subjectControl}>{t.subject}</label>
          <select
            id={subjectControl}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          >
            <option value="">{t.allSubjects}</option>
            {[...subjects].map(([id, name]) => (
              <option value={id} key={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {visible.length ? (
        <ul className="cab-roster-list">
          {visible.map((row) => (
            <li key={row.enrollmentId}>
              <CabinLink
                to={studentUrl(row.enrollmentId)}
                navigate={navigate}
                className="cab-card cab-panel cab-roster-row"
              >
                <SubjectIcon subject={row.subjectName} compact />
                <div className="cab-roster-name">
                  <strong>{row.studentName}</strong>
                  <p>{row.subjectName}</p>
                </div>
                <div className="cab-roster-details">
                  <p>
                    {t.confirmed} · <strong>{row.confirmedLessons}</strong>
                  </p>
                  {row.nextLessonAt ? (
                    <p>
                      {t.next} · <time dateTime={row.nextLessonAt}>{date(row.nextLessonAt)}</time>
                    </p>
                  ) : (
                    <p>
                      {t.teacherSince}{' '}
                      <time dateTime={row.assignedFrom}>{date(row.assignedFrom)}</time>
                    </p>
                  )}
                </div>
                <Icon name="arrow" size={17} />
              </CabinLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cab-empty">{t.noMatches}</p>
      )}
    </div>
  );
}

function LessonList({
  heading,
  empty,
  lessons,
  date,
  t,
  navigate,
}: {
  heading: string;
  empty: string;
  lessons: Lesson[];
  date: DateLabel;
  t: Copy;
  navigate: Navigate;
}) {
  return (
    <section className="cab-card cab-panel cab-lesson-stack">
      <h2>{heading}</h2>
      {lessons.length ? (
        <ul className="cab-roster-list">
          {lessons.map((lesson) => {
            const state = lessonStatus[lesson.status as keyof typeof lessonStatus];
            return (
              <li key={lesson.lessonId}>
                <CabinLink
                  to={'/teacher/lessons/' + encodeURIComponent(lesson.lessonId)}
                  navigate={navigate}
                  className="cab-agenda-item"
                >
                  <Icon name="calendar" size={17} />
                  <span className="cab-agenda-title">
                    <strong>
                      <time dateTime={lesson.startsAt}>{date(lesson.startsAt)}</time>
                    </strong>
                    {state && <small>{t[state]}</small>}
                  </span>
                  <Icon name="arrow" size={16} />
                </CabinLink>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cab-detail-subtitle">{empty}</p>
      )}
    </section>
  );
}

function CounterPanel({
  heading,
  labels,
  counts,
}: {
  heading: string;
  labels: string[];
  counts: number[];
}) {
  return (
    <section className="cab-card cab-panel cab-lesson-stack">
      <h2>{heading}</h2>
      <dl className="cab-roster-counters">
        {labels.map((label, index) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{counts[index]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function StudentOverview({
  overview,
  t,
  date,
  navigate,
}: {
  overview: Overview;
  t: Copy;
  date: DateLabel;
  navigate: Navigate;
}) {
  const { homework, skills } = overview;
  const counters = [
    [t.confirmed, overview.confirmedLessons, 'mint'],
    [t.toReview, overview.lessonsToNextReview, 'blue'],
    [t.activeGoals, overview.activeGoals, 'violet'],
    [t.pending, overview.pendingCheckpoints, 'peach'],
  ] as const;
  return (
    <>
      <dl className="cab-roster-metrics">
        {counters.map(([label, count, tone]) => (
          <div className={'cab-metric cab-tone-' + tone} key={label}>
            <dt>{label}</dt>
            <dd className="cab-metric-value">{count}</dd>
          </div>
        ))}
      </dl>
      <div className="cab-lesson-grid cab-roster-overview">
        <div className="cab-lesson-stack">
          <LessonList
            heading={t.upcoming}
            empty={t.noUpcoming}
            lessons={overview.upcomingLessons}
            date={date}
            t={t}
            navigate={navigate}
          />
          <LessonList
            heading={t.recent}
            empty={t.noRecent}
            lessons={overview.recentLessons}
            date={date}
            t={t}
            navigate={navigate}
          />
        </div>
        <div className="cab-lesson-stack">
          <CounterPanel
            heading={t.homework}
            labels={t.homeworkStages}
            counts={[
              homework.notSubmitted,
              homework.awaitingReview,
              homework.needsRevision,
              homework.reviewed,
            ]}
          />
          <CounterPanel
            heading={t.tabs.skills}
            labels={t.skillStages}
            counts={[skills.notStudied, skills.familiarizing, skills.practicing, skills.applying]}
          />
        </div>
      </div>
    </>
  );
}

function StudentCard({
  id,
  tab,
  t,
  date,
  zone,
  navigate,
}: {
  id: string | null;
  tab: Tab;
  t: Copy;
  date: DateLabel;
  zone: string;
  navigate: Navigate;
}) {
  const result = useEndpoint<Overview>(
    id ? 'getTeacherStudentOverview' : null,
    id ? { enrollmentId: id } : {},
  );
  const data = id && result.data?.enrollmentId === id ? result.data : null;
  return (
    <div className="cab-lesson-layout">
      <CabinLink to={teacherStudentsPath} navigate={navigate} className="cab-inline-link">
        {t.back}
      </CabinLink>
      {!data ? (
        <StudentReadState
          pending={result.pending}
          {...(id ? { retry: result.refresh } : {})}
          t={t}
        />
      ) : (
        <>
          <section className="cab-card cab-panel cab-lesson-stack">
            <div className="cab-subject-intro">
              <SubjectIcon subject={data.subjectName} />
              <div>
                <h2>{data.studentName}</h2>
                <p className="cab-detail-subtitle">{data.subjectName}</p>
              </div>
            </div>
            <nav className="cab-action-grid" aria-label={t.sections}>
              {tabs.map((item) =>
                item === tab ? (
                  <span key={item} className="cab-button cab-primary" aria-current="page">
                    {t.tabs[item]}
                  </span>
                ) : (
                  <CabinLink
                    key={item}
                    to={studentUrl(data.enrollmentId, item)}
                    navigate={navigate}
                    className="cab-button cab-secondary"
                  >
                    {t.tabs[item]}
                  </CabinLink>
                ),
              )}
            </nav>
          </section>
          {tab === 'goals' ? (
            <TeacherStudentGoals enrollmentId={data.enrollmentId} zone={zone} />
          ) : tab === 'skills' ? (
            <TeacherStudentSkills
              enrollmentId={data.enrollmentId}
              zone={zone}
              recentLessons={data.recentLessons}
            />
          ) : (
            <StudentOverview overview={data} t={t} date={date} navigate={navigate} />
          )}
        </>
      )}
    </div>
  );
}

export default function TeacherStudents({
  detail,
  search,
  zone,
  navigate,
}: {
  detail?: string;
  search: string;
  zone: string;
  navigate: Navigate;
}) {
  const { locale } = useLocale();
  const t = copy[locale];
  const date = (value: string) => formatDateTime(value, locale, zone) ?? '—';
  if (!detail) return <StudentDirectory navigate={navigate} t={t} date={date} />;
  const requested = new URLSearchParams(search).get('tab');
  const tab = tabs.find((item) => item === requested) ?? 'overview';
  const id = isRouteUuid(detail) ? detail.toLowerCase() : null;
  return (
    <StudentCard
      key={detail + ':' + tab}
      id={id}
      tab={tab}
      t={t}
      date={date}
      zone={zone}
      navigate={navigate}
    />
  );
}
