import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  getStudentLesson,
  getStudentLessons,
  requestStudentLessonReschedule,
} from '@online-school/api-contracts';
import type { LessonCardDto } from '@online-school/api-contracts';
import { k8kEnabled, Segmented, useLocale } from '@online-school/ui';
import { useCommand, useStudentQuery, write } from '../api.js';
import {
  date,
  dayKey,
  Empty,
  ErrorNotice,
  JoinButton,
  Modal,
  Pager,
  Panel,
  QueryState,
  Status,
} from '../components.js';
function Reschedule({ lesson, close }: { lesson: LessonCardDto; close(): void }) {
  const mutation = useCommand((body: { reason: string; preferredDate: string }, key) =>
    write((o) => requestStudentLessonReschedule(lesson.lessonId, body, o), key),
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const values = new FormData(event.currentTarget);
    mutation.mutate({
      reason: String(values.get('reason')).trim(),
      preferredDate: String(values.get('preferredDate')),
    });
  }
  return (
    <Modal title="Запросить перенос" close={close} busy={mutation.isPending}>
      {mutation.isSuccess ? (
        <>
          <p role="status">
            Запрос передан менеджеру. Урок остаётся в расписании до подтверждения.
          </p>
          <button onClick={close}>Готово</button>
        </>
      ) : (
        <form onSubmit={submit}>
          <p>
            {lesson.subjectName} · {date(lesson.scheduledAt, true)}
          </p>
          <fieldset disabled={mutation.isPending}>
            <label>
              Причина
              <textarea name="reason" required maxLength={500} />
            </label>
            <label>
              Желаемая дата
              <input
                name="preferredDate"
                type="date"
                required
                min={dayKey(new Date().toISOString())}
              />
            </label>
            <ErrorNotice error={mutation.error} />
            <button className="primary" type="submit">
              {mutation.isPending ? 'Отправляем…' : 'Отправить запрос'}
            </button>
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
export function LessonList({ items }: { items: LessonCardDto[] }) {
  const [reschedule, setReschedule] = useState<LessonCardDto | null>(null);
  return (
    <>
      {items.length ? (
        <div className="lesson-table">
          <div className="lesson-table-head">
            <span>Дата и время</span>
            <span>Преподаватель / Предмет</span>
            <span>Статус</span>
            <span>Действия</span>
          </div>
          {items.map((l) => (
            <article className="lesson-row" key={l.lessonId}>
              <div>
                <Link to={`/student/lessons/${l.lessonId}`}>
                  <strong>{date(l.scheduledAt, true)}</strong>
                </Link>
                <small>{l.durationMinutes} минут</small>
              </div>
              <div>
                <strong>{l.subjectName}</strong>
                <small>{l.teacherName}</small>
              </div>
              <Status value={l.status} />
              <div className="lesson-actions">
                <JoinButton lesson={l} />
                {l.canRequestReschedule && (
                  <button className="quiet" onClick={() => setReschedule(l)}>
                    Запросить перенос
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty>В этом периоде уроков нет.</Empty>
      )}
      {reschedule && <Reschedule lesson={reschedule} close={() => setReschedule(null)} />}
    </>
  );
}
export function Lessons() {
  const { locale } = useLocale();
  const ro = locale === 'ro';
  const [params, setParams] = useSearchParams();
  const [defaultMonth] = useState(() => dayKey(new Date().toISOString()).slice(0, 7));
  const monthParam = params.get('month') ?? '';
  const month = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : defaultMonth;
  const periodParam = params.get('period');
  const period =
    periodParam === 'today' || periodParam === 'week' || periodParam === 'archive'
      ? periodParam
      : 'month';
  const view = params.get('view') === 'calendar' ? 'calendar' : 'list';
  const pageParam = params.get('page') ?? '';
  const page =
    /^[1-9]\d*$/.test(pageParam) && Number.isSafeInteger(Number(pageParam)) ? Number(pageParam) : 1;
  function change(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) next.set(key, value);
    setParams(next);
  }
  const calendar = view === 'calendar';
  const query = useStudentQuery(
    ['lessons', period, view, page, month],
    (o) => getStudentLessons(calendar ? { month } : { period, page, pageSize: 20 }, o),
    true,
    30_000,
  );
  return (
    <>
      <h1>Уроки</h1>
      <p className="lead">Твоё расписание и история занятий</p>
      <div className="toolbar">
        <div className="tabs" aria-label="Период">
          {(
            [
              ['today', 'Сегодня'],
              ['week', 'Неделя'],
              ['month', 'Месяц'],
              ['archive', 'Архив'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={period === key && !calendar}
              onClick={() => {
                change({ period: key, page: '1', view: 'list' });
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {k8kEnabled ? (
          <Segmented
            label={ro ? 'Mod de afișare a orarului' : 'Вид расписания'}
            value={view}
            options={[
              { value: 'list', label: ro ? 'Listă' : 'Список' },
              { value: 'calendar', label: ro ? 'Calendar' : 'Календарь' },
            ]}
            onValueChange={(mode) => {
              change({ view: mode, page: '1' });
            }}
          />
        ) : (
          <div className="tabs" aria-label="Вид расписания">
            {[
              ['list', 'Список'],
              ['calendar', 'Календарь'],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={view === key}
                onClick={() => {
                  if (key) change({ view: key, page: '1' });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {calendar && (
        <label className="month-picker">
          Месяц
          <input
            type="month"
            value={month}
            required
            onChange={(e) => {
              if (e.target.value) change({ month: e.target.value });
            }}
          />
        </label>
      )}
      <Panel title={calendar ? 'Календарь занятий' : 'Расписание'}>
        <QueryState query={query}>
          {calendar ? (
            <div className="lesson-calendar">
              {Array.from(new Set(query.data?.items.map((l) => dayKey(l.scheduledAt))))
                .sort()
                .map((day) => (
                  <section key={day}>
                    <h3>{date(day)}</h3>
                    <LessonList
                      items={query.data?.items.filter((l) => dayKey(l.scheduledAt) === day) ?? []}
                    />
                  </section>
                ))}
              {!query.data?.items.length && <Empty>В этом месяце уроков нет.</Empty>}
            </div>
          ) : (
            <LessonList items={query.data?.items ?? []} />
          )}
        </QueryState>
        {query.data && !calendar && (
          <Pager {...query.data} change={(next) => change({ page: String(next) })} />
        )}
      </Panel>
    </>
  );
}
export function LessonDetail() {
  const { id = '' } = useParams();
  const query = useStudentQuery(['lesson', id], (o) => getStudentLesson(id, o), true, 30_000);
  return (
    <>
      <Link to="/student/lessons">← Все уроки</Link>
      <h1>Урок</h1>
      <Panel title="Информация об уроке">
        <QueryState query={query}>
          {query.data ? (
            <LessonList items={[query.data]} />
          ) : (
            <Empty>Урок не найден в доступном расписании.</Empty>
          )}
        </QueryState>
      </Panel>
    </>
  );
}
