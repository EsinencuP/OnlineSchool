import { useContext } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  getStudentHomework,
  getStudentLesson,
  getStudentLessonHistory,
  getStudentLessons,
  getStudentMaterials,
} from '@online-school/api-contracts';
import type { LessonCardDto, LessonHistoryItemDto } from '@online-school/api-contracts';
import {
  Button,
  Field,
  ListRow,
  Segmented,
  StateBoundary,
  Icon,
  FreshnessDisplay,
  formatTime,
  formatDateOnly,
  k8kEnabled,
} from '@online-school/ui';
import { StudentNextLessonHero } from '../lesson-hero.js';
import { StudentPageHeading } from '../student-chrome.js';
import { StudentMonthCalendar } from '../student-calendar.js';
import { useIdentityCopy } from '../identity-copy.js';
import { useStudentQuery } from '../api.js';
import { dayKey, Empty, JoinButton, Pager, Panel, QueryState, Status } from '../components.js';
import { useMe } from '../Layout.js';
import { useLessonCopy } from '../lesson-copy.js';
import { lessonHref, positivePage, scheduleReturn } from '../lesson-navigation.js';
import { LessonCommands } from '../lesson-requests.js';
import {
  formatStudentDate,
  StudentMeetClock,
  StudentReadFreshness,
} from '../student-presentation.js';
import { SubjectBack, useSubjectReturn } from './Subjects.js';

export function LessonList({
  items,
  fromSubject,
  backTo = '/student/lessons',
}: {
  items: LessonCardDto[];
  fromSubject?: string | undefined;
  backTo?: string;
}) {
  const { locale, text } = useLessonCopy();
  const { timeZone } = useMe();
  const fresh = useContext(StudentReadFreshness);
  const { verifying } = useContext(StudentMeetClock);
  if (k8kEnabled)
    return items.length ? (
      <div className="k8k-schedule-rows">
        {items.map((lesson) => (
          <article className="k8k-schedule-row" key={lesson.lessonId}>
            <Link
              className="k8k-date-tile"
              aria-label={formatStudentDate(lesson.scheduledAt, timeZone, true, locale)}
              to={lessonHref(lesson.lessonId, backTo, fromSubject)}
            >
              <strong>
                {new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone }).format(
                  new Date(lesson.scheduledAt),
                )}
              </strong>
              <span>
                {new Intl.DateTimeFormat(locale, { month: 'short', timeZone }).format(
                  new Date(lesson.scheduledAt),
                )}
              </span>
            </Link>
            <div className="k8k-schedule-subject">
              <h3>
                <Link to={lessonHref(lesson.lessonId, backTo, fromSubject)}>
                  {lesson.subjectName}
                </Link>
              </h3>
              <p title={lesson.teacherName}>{lesson.teacherName}</p>
            </div>
            <div className="k8k-schedule-time">
              <strong>
                <time dateTime={lesson.scheduledAt}>
                  {formatTime(lesson.scheduledAt, locale, timeZone)}–
                  {formatTime(
                    Date.parse(lesson.scheduledAt) + lesson.durationMinutes * 60000,
                    locale,
                    timeZone,
                  )}
                </time>
              </strong>
              <Status value={lesson.status} />
              <small>
                {lesson.durationMinutes} {text('minutes')}
              </small>
            </div>
            <div className="k8k-schedule-actions">
              <JoinButton lesson={lesson} compact />
              <StudentReadFreshness.Provider value={fresh && !verifying}>
                <LessonCommands
                  lesson={lesson}
                  kind="reschedule"
                  allowed={lesson.canRequestReschedule}
                />
              </StudentReadFreshness.Provider>
            </div>
            <Link
              className="k8k-row-arrow"
              aria-label={text('openLesson') + ': ' + lesson.subjectName}
              to={lessonHref(lesson.lessonId, backTo, fromSubject)}
            >
              <Icon name="arrow" />
            </Link>
          </article>
        ))}
      </div>
    ) : (
      <Empty>{text('emptySchedule')}</Empty>
    );
  return items.length ? (
    <div className="lesson-table">
      <div className="lesson-table-head">
        <span>{text('dates')}</span>
        <span>{text('teacherSubject')}</span>
        <span>{text('status')}</span>
        <span>{text('actions')}</span>
      </div>
      {items.map((lesson) => (
        <article className="lesson-row" key={lesson.lessonId}>
          <div>
            <Link to={lessonHref(lesson.lessonId, backTo, fromSubject)}>
              <strong>{formatStudentDate(lesson.scheduledAt, timeZone, true, locale)}</strong>
            </Link>
            <small>
              {lesson.durationMinutes} {text('minutes')}
            </small>
          </div>
          <div>
            <strong>{lesson.subjectName}</strong>
            <small>{lesson.teacherName}</small>
          </div>
          <Status value={lesson.status} />
          <div className="lesson-actions">
            <JoinButton lesson={lesson} />
            <StudentReadFreshness.Provider value={fresh && !verifying}>
              <LessonCommands
                lesson={lesson}
                kind="reschedule"
                allowed={lesson.canRequestReschedule}
              />
            </StudentReadFreshness.Provider>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty>{text('emptySchedule')}</Empty>
  );
}

function HistoryItem({
  item,
  backTo,
  fromSubject,
  link = true,
  verifying = false,
}: {
  item: LessonHistoryItemDto;
  backTo: string;
  fromSubject?: string | undefined;
  link?: boolean;
  verifying?: boolean;
}) {
  const { locale, text } = useLessonCopy();
  const { timeZone } = useMe();
  const fresh = useContext(StudentReadFreshness);
  const balance = (value: string | null) => value ?? text('unknownBalance');
  return (
    <ListRow
      title={
        <>
          {link ? (
            <Link to={lessonHref(item.lessonId, backTo, fromSubject)}>
              {item.subjectName} · {formatStudentDate(item.scheduledAt, timeZone, true, locale)}
            </Link>
          ) : (
            <strong>{item.subjectName}</strong>
          )}
          <Status value={item.attendanceStatus} />
        </>
      }
      details={[
        {
          id: 'teacher',
          label: text(item.attendanceStatus === 'COMPLETED' ? 'actualTeacher' : 'teacher'),
          value: item.teacherName,
        },
        {
          id: 'duration',
          label: text(item.attendanceStatus === 'COMPLETED' ? 'actualDuration' : 'duration'),
          value: item.durationMinutes + ' ' + text('minutes'),
        },
        {
          id: 'deducted',
          label: text('status'),
          value: text(item.lessonDeducted ? 'deducted' : 'notDeducted'),
        },
        { id: 'before', label: text('before'), value: balance(item.balanceBefore) },
        { id: 'after', label: text('after'), value: balance(item.balanceAfter) },
      ]}
      actions={
        <StudentReadFreshness.Provider value={fresh && !verifying}>
          <LessonCommands lesson={item} kind="dispute" allowed={item.canDispute} />
        </StudentReadFreshness.Provider>
      }
    />
  );
}

function History({
  page,
  subjectId,
  fromSubject,
  backTo,
  change,
}: {
  page: number;
  subjectId?: string | undefined;
  fromSubject?: string | undefined;
  backTo: string;
  change(page: number): void;
}) {
  const { text } = useLessonCopy();
  const query = useStudentQuery(['lesson-history', subjectId ?? null, page], (o) =>
    getStudentLessonHistory({ page, pageSize: 20, ...(subjectId ? { subjectId } : {}) }, o),
  );
  const content = (
    <Panel title={text('history')} className="k8k-lesson-history">
      <p>{text('historyHint')}</p>
      <QueryState
        query={query}
        operational
        empty={query.data?.items.length === 0}
        emptyMessage={text('emptyHistory')}
      >
        <ul className="k8k-lesson-history-list">
          {query.data?.items.map((item) => (
            <HistoryItem
              key={item.lessonId}
              item={item}
              verifying={query.isFetching}
              backTo={backTo}
              fromSubject={fromSubject}
            />
          ))}
        </ul>
      </QueryState>
      {query.data && (
        <>
          <p>
            {text('total')} {query.data.total}
          </p>
          <Pager {...query.data} change={change} />
        </>
      )}
    </Panel>
  );
  return k8kEnabled ? (
    <details className="k8k-history-disclosure">
      <summary>
        <Icon name="clock" />
        <strong>{text('history')}</strong>
        {query.data?.total === 0 && <span>{text('emptyHistory')}</span>}
        <Icon name="arrow" />
      </summary>
      {content}
    </details>
  ) : (
    content
  );
}

export function Lessons() {
  const { locale, text } = useLessonCopy();
  const identity = useIdentityCopy();
  const { timeZone } = useMe();
  const fromSubject = useSubjectReturn();
  const [params, setParams] = useSearchParams();
  const monthParam = params.get('month') ?? '';
  const month = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)
    ? monthParam
    : dayKey(new Date().toISOString()).slice(0, 7);
  const periodParam = params.get('period');
  const period =
    periodParam === 'today' || periodParam === 'week' || periodParam === 'archive'
      ? periodParam
      : 'month';
  const calendar = params.get('view') === 'calendar';
  const view = calendar ? 'calendar' : 'list';
  const subjectId = params.get('subjectId') ?? params.get('fromSubjectId') ?? undefined;
  const page = positivePage(params.get('page'));
  const historyPage = positivePage(params.get('historyPage'));
  const location = useLocation();
  const backTo = scheduleReturn(location.pathname + location.search);
  function change(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    setParams(next, { preventScrollReset: true });
  }
  const query = useStudentQuery(
    ['lessons', period, view, page, month, subjectId ?? null],
    (o) =>
      getStudentLessons(
        {
          ...(calendar
            ? { month }
            : period === 'month'
              ? { month, view: 'list' as const, page, pageSize: 20 }
              : { period, page, pageSize: 20 }),
          ...(subjectId ? { subjectId } : {}),
        },
        o,
      ),
    true,
    30_000,
  );
  const limit =
    !!query.error && 'code' in query.error && query.error.code === 'CALENDAR_MONTH_LIMIT_EXCEEDED';
  const miniCalendar = useStudentQuery(
    ['lessons', 'month-preview', month, subjectId ?? null],
    (o) => getStudentLessons({ month, ...(subjectId ? { subjectId } : {}) }, o),
    k8kEnabled,
    30_000,
  );
  return (
    <FreshnessDisplay.Provider value={k8kEnabled ? 'compact' : 'full'}>
      <div className="k8k-student-page k8k-schedule-page">
        <StudentPageHeading
          title={text(k8kEnabled ? 'schedule' : 'lessons')}
          lead={k8kEnabled ? identity('scheduleLead') : text('lead')}
        />
        <SubjectBack id={fromSubject} />
        <div className="k8k-page-columns">
          <div className="k8k-page-primary">
            {k8kEnabled && (
              <div className="k8k-schedule-hero">
                <StudentNextLessonHero />
              </div>
            )}
            <div className="toolbar">
              <div className="tabs" aria-label={text('period')}>
                {(['today', 'week', 'month'] as const).map((value) => (
                  <Button
                    key={value}
                    variant="secondary"
                    aria-pressed={!calendar && period === value}
                    onClick={() => change({ period: value, view: 'list', page: '1' })}
                  >
                    {text(value)}
                  </Button>
                ))}
              </div>
              <Segmented
                label={text('view')}
                value={view}
                options={[
                  { value: 'list', label: text('list') },
                  { value: 'calendar', label: text('calendar') },
                ]}
                onValueChange={(value) => change({ view: value, page: '1' })}
              />
            </div>
            {!k8kEnabled && (calendar || period === 'month') && (
              <Field
                label={text('month')}
                type="month"
                value={month}
                required
                onChange={(event) => {
                  if (event.target.value) change({ month: event.target.value, page: '1' });
                }}
              />
            )}
            <Panel
              title={
                period === 'month' || calendar
                  ? (formatDateOnly(month + '-01', locale, { month: 'long', year: 'numeric' }) ??
                    text('schedule'))
                  : text('schedule')
              }
              className="k8k-schedule-list"
              headerAside={
                k8kEnabled && query.data ? (
                  <span className="k8k-section-meta">
                    {identity('lessons')}: {query.data.total}
                  </span>
                ) : undefined
              }
            >
              {limit ? (
                <div role="status">
                  <p>{text('calendarLimit')}</p>
                  <Button
                    variant="secondary"
                    onClick={() => change({ period: 'month', view: 'list', page: '1', month })}
                  >
                    {text('openMonthList')}
                  </Button>
                </div>
              ) : (
                <QueryState
                  query={query}
                  operational={calendar || period !== 'archive'}
                  empty={query.data?.items.length === 0}
                  emptyMessage={text('emptySchedule')}
                  meet={{ lessons: query.data?.items ?? [] }}
                >
                  {calendar ? (
                    <div className="lesson-calendar">
                      {Array.from(
                        new Set(query.data?.items.map((item) => dayKey(item.scheduledAt))),
                      )
                        .sort()
                        .map((day) => (
                          <section key={day}>
                            <h3>{formatStudentDate(day, timeZone, false, locale)}</h3>
                            <LessonList
                              items={
                                query.data?.items.filter(
                                  (item) => dayKey(item.scheduledAt) === day,
                                ) ?? []
                              }
                              fromSubject={fromSubject}
                              backTo={backTo}
                            />
                          </section>
                        ))}
                    </div>
                  ) : (
                    <LessonList
                      items={query.data?.items ?? []}
                      fromSubject={fromSubject}
                      backTo={backTo}
                    />
                  )}
                </QueryState>
              )}
              {query.data && !calendar && (
                <>
                  {!k8kEnabled && (
                    <p>
                      {text('total')} {query.data.total}
                    </p>
                  )}
                  <Pager {...query.data} change={(next) => change({ page: String(next) })} />
                </>
              )}
            </Panel>
            <History
              page={historyPage}
              subjectId={subjectId}
              fromSubject={fromSubject}
              backTo={backTo}
              change={(next) => change({ historyPage: String(next) })}
            />
          </div>
          {k8kEnabled && (
            <aside className="k8k-page-aside">
              <section className="k8k-student-card k8k-calendar-card">
                <StudentMonthCalendar
                  month={month}
                  items={miniCalendar.error ? [] : (miniCalendar.data?.items ?? [])}
                  eventsKnown={!!miniCalendar.data && !miniCalendar.error}
                  change={(value) => change({ month: value, period: 'month', page: '1' })}
                  backTo={backTo}
                  fromSubject={fromSubject}
                />
                <QueryState query={miniCalendar} operational>
                  {null}
                </QueryState>
              </section>
              <section className="k8k-support-card k8k-support-warm">
                <h2>
                  <Icon name="clock" />
                  {identity('lessonTime')}
                </h2>
                <p>
                  {identity('timeZone')}: {timeZone}
                </p>
                <p>{identity('meetHint')}</p>
              </section>
            </aside>
          )}
        </div>
      </div>
    </FreshnessDisplay.Provider>
  );
}

function LessonFacts({ lesson, backTo }: { lesson: LessonCardDto; backTo: string }) {
  const { text } = useLessonCopy();
  const [params, setParams] = useSearchParams();
  const history = useStudentQuery(['lesson-history', 'lesson', lesson.lessonId], (o) =>
    getStudentLessonHistory({ lessonId: lesson.lessonId, pageSize: 1 }, o),
  );
  const homeworkPage = positivePage(params.get('homeworkPage'));
  const materialPage = positivePage(params.get('materialPage'));
  const homework = useStudentQuery(['lesson-homework', lesson.lessonId, homeworkPage], (o) =>
    getStudentHomework({ lessonId: lesson.lessonId, page: homeworkPage, pageSize: 10 }, o),
  );
  const materials = useStudentQuery(['lesson-materials', lesson.lessonId, materialPage], (o) =>
    getStudentMaterials({ lessonId: lesson.lessonId, page: materialPage, pageSize: 10 }, o),
  );
  function change(key: string, page: number) {
    const next = new URLSearchParams(params);
    next.set(key, String(page));
    setParams(next, { preventScrollReset: true });
  }
  return (
    <>
      <Panel title={text('history')}>
        <QueryState
          query={history}
          operational
          empty={history.data?.items.length === 0}
          emptyMessage={text('emptyHistory')}
        >
          <ul className="k8k-lesson-history-list">
            {history.data?.items.map((item) => (
              <HistoryItem
                key={item.lessonId}
                item={item}
                backTo={backTo}
                link={false}
                verifying={history.isFetching}
              />
            ))}
          </ul>
        </QueryState>
      </Panel>
      <Panel title={text('homework')}>
        <QueryState
          query={homework}
          empty={homework.data?.items.length === 0}
          emptyMessage={text('emptyHomework')}
        >
          <ul className="k8k-lesson-history-list">
            {homework.data?.items.map((item) => (
              <ListRow
                key={item.homeworkId}
                title={
                  <Link className="k8k-student-link" to={'/student/homework/' + item.homeworkId}>
                    {item.title}
                  </Link>
                }
                details={[
                  { id: 'status', label: text('status'), value: <Status value={item.status} /> },
                ]}
              />
            ))}
          </ul>
        </QueryState>
        {homework.data && (
          <Pager {...homework.data} change={(page) => change('homeworkPage', page)} />
        )}
      </Panel>
      <Panel title={text('materials')}>
        <QueryState
          query={materials}
          empty={materials.data?.items.length === 0}
          emptyMessage={text('emptyMaterials')}
        >
          <ul className="k8k-lesson-history-list">
            {materials.data?.items.map((item) => (
              <ListRow
                key={item.fileId}
                title={item.fileName}
                details={[
                  { id: 'teacher', label: text('sharedBy'), value: item.sharedByTeacherName },
                ]}
              />
            ))}
          </ul>
          {!!materials.data?.items.length && (
            <Link
              className="k8k-student-link"
              to={
                '/student/materials?' + new URLSearchParams({ lessonId: lesson.lessonId, backTo })
              }
            >
              {text('openMaterials')}
            </Link>
          )}
        </QueryState>
        {materials.data && (
          <Pager {...materials.data} change={(page) => change('materialPage', page)} />
        )}
      </Panel>
    </>
  );
}

export function LessonDetail() {
  const { locale, text } = useLessonCopy();
  const { timeZone } = useMe();
  const fromSubject = useSubjectReturn();
  const [params] = useSearchParams();
  const backTo = scheduleReturn(
    params.get('backTo') ??
      (fromSubject
        ? '/student/lessons?' + new URLSearchParams({ fromSubjectId: fromSubject })
        : null),
  );
  const { id = '' } = useParams();
  const query = useStudentQuery(['lesson', id], (o) => getStudentLesson(id, o), true, 30_000);
  return (
    <>
      <Link className="k8k-student-link" to={backTo}>
        ← {text('back')}
      </Link>
      <SubjectBack id={fromSubject} />
      <h1>{text('lesson')}</h1>
      <QueryState query={query} operational meet={{ lessons: query.data ? [query.data] : [] }}>
        {query.data ? (
          <>
            <Panel title={text('details')}>
              <LessonList items={[query.data]} fromSubject={fromSubject} backTo={backTo} />
              {query.data.originalScheduledAt &&
                query.data.originalScheduledAt !== query.data.scheduledAt && (
                  <p className="k8k-lesson-moved">
                    {text('movedFrom')}{' '}
                    {formatStudentDate(query.data.originalScheduledAt, timeZone, true, locale)}
                  </p>
                )}
            </Panel>
            <LessonFacts lesson={query.data} backTo={backTo} />
          </>
        ) : (
          <StateBoundary state={{ status: 'empty', message: text('notFound') }} />
        )}
      </QueryState>
    </>
  );
}
