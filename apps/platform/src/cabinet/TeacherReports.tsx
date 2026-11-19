import { useId } from 'react';
import type { components } from '@online-school/api-contracts';
import { formatDateTime, Icon, useLocale } from '@online-school/ui';
import { SubjectIcon } from './Brand.js';
import { CabinLink } from './Home.js';
import { useEndpoint } from './hooks.js';
import { teacherReportsPath } from './recordRoutes.js';
import { isRouteUuid } from './studentSubjectRoutes.js';
import { TeacherCheckpointCard } from './TeacherCheckpointCard.js';
import { teacherCopy } from './teacherCopy.js';
import { CursorPager, TeacherRecordLoad, useCursorPages } from './teacherRecordControls.js';

type Schemas = components['schemas'];
type Journal = Schemas['TeacherJournalPageDto'];
type Checkpoints = Schemas['TeacherCheckpointPageDto'];
type JournalState = Journal['items'][number]['state'];
type CheckpointState = Checkpoints['items'][number]['state'];
type CheckpointType = Checkpoints['items'][number]['type'];
type Navigate = (url: string) => void;
type Time = (value: string) => string | null;
type Filters = { view: 'journal' | 'checkpoints'; state?: string; type?: CheckpointType };

const journalTones: Record<JournalState, string> = {
  AWAITING_REPORT: 'peach',
  AWAITING_CONFIRMATION: 'blue',
  CONDUCTED: 'mint',
  CANCELLED: 'violet',
  DISPUTED: 'rose',
};

const copy = {
  ru: {
    journal: 'Журнал уроков',
    checkpoints: 'Срезы и отчёты',
    nav: 'Разделы журнала',
    filter: 'Статус',
    type: 'Вид контрольной точки',
    all: 'Все статусы',
    allTypes: 'Все виды',
    emptyJournal: 'Уроков с таким статусом пока нет.',
    emptyCheckpoints: 'Контрольных точек пока нет.',
    overdue: 'Просрочен отчёт',
    confirmed: 'Подтверждённых уроков',
    deadline: 'Отправить до',
    completedAt: 'Завершено',
    back: 'К срезам и отчётам',
    loading: 'Загружаем данные…',
    unavailable: 'Не удалось загрузить данные.',
    retryRead: 'Обновить данные',
    prev: 'Назад',
    next: 'Далее',
    states: { PENDING: 'Ожидает действий', COMPLETED: 'Завершено' },
    types: { LESSON_4: 'Срез навыков', LESSON_8: 'Отчёт об обучении' },
  },
  ro: {
    journal: 'Registrul lecțiilor',
    checkpoints: 'Evaluări și rapoarte',
    nav: 'Secțiunile registrului',
    filter: 'Stare',
    type: 'Tipul punctului de control',
    all: 'Toate stările',
    allTypes: 'Toate tipurile',
    emptyJournal: 'Nu există încă lecții cu această stare.',
    emptyCheckpoints: 'Nu există încă puncte de control.',
    overdue: 'Termenul raportului a expirat',
    confirmed: 'Lecții confirmate',
    deadline: 'Trimite până la',
    completedAt: 'Finalizat',
    back: 'Înapoi la evaluări și rapoarte',
    loading: 'Se încarcă datele…',
    unavailable: 'Datele nu au putut fi încărcate.',
    retryRead: 'Reîncarcă datele',
    prev: 'Înapoi',
    next: 'Înainte',
    states: { PENDING: 'Necesită acțiune', COMPLETED: 'Finalizat' },
    types: { LESSON_4: 'Evaluarea competențelor', LESSON_8: 'Raport de studiu' },
  },
};
type Locale = keyof typeof copy;
type Copy = (typeof copy)[Locale];
const checkpointStates = ['PENDING', 'COMPLETED'] satisfies CheckpointState[];
const checkpointTypes = ['LESSON_4', 'LESSON_8'] satisfies CheckpointType[];
const journalStates = Object.keys(journalTones) as JournalState[];

function reportsUrl(filters: Filters, checkpointId?: string) {
  const params = new URLSearchParams();
  if (filters.view === 'checkpoints' && !checkpointId) params.set('view', 'checkpoints');
  if (filters.state) params.set('state', filters.state);
  if (filters.type) params.set('type', filters.type);
  return (
    teacherReportsPath +
    (checkpointId ? '/' + encodeURIComponent(checkpointId) : '') +
    (params.size ? '?' + params : '')
  );
}

function Filter({
  label,
  all,
  values,
  selected,
  change,
}: {
  label: string;
  all: string;
  values: Record<string, string>;
  selected?: string;
  change: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="cab-form-label">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={selected ?? ''} onChange={(event) => change(event.target.value)}>
        <option value="">{all}</option>
        {Object.entries(values).map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

function JournalList({
  state,
  locale,
  time,
  navigate,
}: {
  state: JournalState | undefined;
  locale: Locale;
  time: Time;
  navigate: Navigate;
}) {
  const page = useCursorPages();
  const t = copy[locale];
  const lesson = teacherCopy[locale];
  const result = useEndpoint<Journal>(
    'getTeacherJournal',
    {},
    {
      limit: 20,
      ...(state ? { state } : {}),
      ...(page.cursor ? { cursor: page.cursor } : {}),
    },
  );
  return (
    <div className="cab-lesson-stack">
      <div className="cab-card cab-panel cab-report-filters">
        <Filter
          label={t.filter}
          all={t.all}
          values={lesson.lessonStates}
          selected={state ?? ''}
          change={(next) => navigate(reportsUrl({ view: 'journal', state: next }))}
        />
      </div>
      {!result.data ? (
        <TeacherRecordLoad t={t} pending={result.pending} retry={result.refresh} />
      ) : result.data.items.length ? (
        <ul className="cab-roster-list">
          {result.data.items.map((item) => (
            <li key={item.lessonId}>
              <CabinLink
                to={'/teacher/lessons/' + encodeURIComponent(item.lessonId)}
                navigate={navigate}
                className="cab-card cab-panel cab-roster-row"
              >
                <SubjectIcon subject={item.subjectName} compact />
                <div className="cab-roster-name">
                  <strong>
                    {item.studentName} · {item.subjectName}
                  </strong>
                  <p>
                    <time dateTime={item.startsAt}>{time(item.startsAt)}</time> ·{' '}
                    {item.kind === 'TRIAL' ? lesson.trial : lesson.regular}
                  </p>
                  {item.latestReportResult &&
                    lesson.reportTypes[item.latestReportResult] !==
                      lesson.lessonStates[item.state] && (
                      <p>{lesson.reportTypes[item.latestReportResult]}</p>
                    )}
                </div>
                <div className="cab-roster-details cab-lesson-report-meta">
                  <span className={'cab-status cab-tone-' + journalTones[item.state]}>
                    {lesson.lessonStates[item.state]}
                  </span>
                  {item.overdue ? (
                    <p className="cab-form-error">{t.overdue}</p>
                  ) : (
                    item.state === 'AWAITING_REPORT' && (
                      <p>
                        {t.deadline} ·{' '}
                        <time dateTime={item.reportDeadlineAt}>{time(item.reportDeadlineAt)}</time>
                      </p>
                    )
                  )}
                </div>
                <Icon name="arrow" size={17} />
              </CabinLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cab-empty">{t.emptyJournal}</p>
      )}
      <CursorPager page={page} next={result.data?.nextCursor} t={t} />
    </div>
  );
}

function CheckpointList({
  state,
  type,
  t,
  time,
  navigate,
}: {
  state: CheckpointState | undefined;
  type: CheckpointType | undefined;
  t: Copy;
  time: Time;
  navigate: Navigate;
}) {
  const page = useCursorPages();
  const filters: Filters = {
    view: 'checkpoints',
    ...(state ? { state } : {}),
    ...(type ? { type } : {}),
  };
  const result = useEndpoint<Checkpoints>(
    'getTeacherCheckpoints',
    {},
    {
      limit: 20,
      ...(state ? { state } : {}),
      ...(type ? { type } : {}),
      ...(page.cursor ? { cursor: page.cursor } : {}),
    },
  );
  return (
    <div className="cab-lesson-stack">
      <div className="cab-card cab-panel cab-report-filters">
        <Filter
          label={t.filter}
          all={t.all}
          values={t.states}
          selected={state ?? ''}
          change={(next) => navigate(reportsUrl({ ...filters, state: next }))}
        />
        <Filter
          label={t.type}
          all={t.allTypes}
          values={t.types}
          selected={type ?? ''}
          change={(next) => {
            const selected = checkpointTypes.find((value) => value === next);
            navigate(
              reportsUrl({
                view: 'checkpoints',
                ...(state ? { state } : {}),
                ...(selected ? { type: selected } : {}),
              }),
            );
          }}
        />
      </div>
      {!result.data ? (
        <TeacherRecordLoad t={t} pending={result.pending} retry={result.refresh} />
      ) : result.data.items.length ? (
        <ul className="cab-roster-list">
          {result.data.items.map((item) => (
            <li key={item.checkpointId}>
              <CabinLink
                to={reportsUrl(filters, item.checkpointId)}
                navigate={navigate}
                className="cab-card cab-panel cab-roster-row"
              >
                <SubjectIcon subject={item.subjectName} compact />
                <div className="cab-roster-name">
                  <strong>
                    {t.types[item.type]} · {item.studentName}
                  </strong>
                  <p>
                    {item.subjectName} · {t.confirmed} {item.confirmedLessonCount}
                  </p>
                  <time className="cab-detail-subtitle" dateTime={item.triggeredAt}>
                    {time(item.triggeredAt)}
                  </time>
                </div>
                <div className="cab-roster-details cab-lesson-report-meta">
                  <span
                    className={
                      'cab-status cab-tone-' + (item.state === 'COMPLETED' ? 'mint' : 'peach')
                    }
                  >
                    {t.states[item.state]}
                  </span>
                  {item.completedAt && (
                    <p>
                      {t.completedAt} ·{' '}
                      <time dateTime={item.completedAt}>{time(item.completedAt)}</time>
                    </p>
                  )}
                </div>
                <Icon name="arrow" size={17} />
              </CabinLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cab-empty">{t.emptyCheckpoints}</p>
      )}
      <CursorPager page={page} next={result.data?.nextCursor} t={t} />
    </div>
  );
}

export default function TeacherReports({
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
  const query = new URLSearchParams(search);
  const isCheckpoint = query.get('view') === 'checkpoints' || Boolean(detail);
  const state = query.get('state');
  const checkpointState = checkpointStates.find((value) => value === state);
  const checkpointType = checkpointTypes.find((value) => value === query.get('type'));
  const journalState = journalStates.find((value) => value === state);
  const time = (value: string) => formatDateTime(value, locale, zone);
  if (detail) {
    const back = reportsUrl({
      view: 'checkpoints',
      ...(checkpointState ? { state: checkpointState } : {}),
      ...(checkpointType ? { type: checkpointType } : {}),
    });
    return (
      <div className="cab-lesson-layout">
        <CabinLink to={back} navigate={navigate} className="cab-inline-link">
          {t.back}
        </CabinLink>
        {isRouteUuid(detail) ? (
          <TeacherCheckpointCard
            key={detail}
            id={detail.toLowerCase()}
            zone={zone}
            navigate={navigate}
          />
        ) : (
          <TeacherRecordLoad t={t} />
        )}
      </div>
    );
  }
  return (
    <div className="cab-lesson-layout">
      <nav className="cab-action-grid" aria-label={t.nav}>
        {isCheckpoint ? (
          <>
            <CabinLink
              to={teacherReportsPath}
              navigate={navigate}
              className="cab-button cab-secondary"
            >
              {t.journal}
            </CabinLink>
            <span className="cab-button cab-primary" aria-current="page">
              {t.checkpoints}
            </span>
          </>
        ) : (
          <>
            <span className="cab-button cab-primary" aria-current="page">
              {t.journal}
            </span>
            <CabinLink
              to={reportsUrl({ view: 'checkpoints' })}
              navigate={navigate}
              className="cab-button cab-secondary"
            >
              {t.checkpoints}
            </CabinLink>
          </>
        )}
      </nav>
      {isCheckpoint ? (
        <CheckpointList
          key={JSON.stringify([checkpointState, checkpointType])}
          state={checkpointState}
          type={checkpointType}
          time={time}
          t={t}
          navigate={navigate}
        />
      ) : (
        <JournalList
          key={journalState ?? 'all'}
          state={journalState}
          locale={locale}
          time={time}
          navigate={navigate}
        />
      )}
    </div>
  );
}
