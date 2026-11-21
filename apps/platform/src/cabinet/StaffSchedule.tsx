import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, formatDateOnly, useLocale } from '@online-school/ui';
import { CabinLink } from './Home.js';
import { statusLabel } from './Operations.js';
import './staff-schedule.css';

export type ScheduleLesson = {
  id: string;
  startsAt: string;
  endsAt: string;
  title: string;
  person: string;
  status: string;
  trial: boolean;
};

export function scheduleDate(date: Date, zone: string) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(date);
}

export function addDays(iso: string, delta: number) {
  const date = new Date(iso + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function monday(iso: string) {
  return addDays(iso, -((new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7));
}

function useScheduleClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function clockLabel(minute: number) {
  return [Math.floor(minute / 60), minute % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function minuteOfDay(time: string) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}

function lessonTone(lesson: ScheduleLesson) {
  if (lesson.status === 'STAR_PENDING' || lesson.status === 'DISPUTED') return 'rose';
  if (lesson.trial) return 'yellow';
  if (lesson.status === 'CONDUCTED' || lesson.status === 'COMPLETED') return 'blue';
  if (lesson.status === 'IN_PROGRESS') return 'mint';
  return 'violet';
}

type Props = {
  title: string;
  zone: string;
  from: string;
  lessons: readonly ScheduleLesson[];
  changeWeek: (from: string | null) => void;
  loading?: boolean;
  notice?: ReactNode;
  unavailableDays?: readonly string[];
  action?: ReactNode;
} & (
  | { lessonUrl: (id: string) => string; navigate: (url: string) => void }
  | { onSelect: (id: string) => void; selectedId: string | undefined }
);

export function StaffSchedule(props: Props) {
  const {
    title,
    zone,
    from,
    lessons,
    changeWeek,
    loading,
    notice,
    unavailableDays = [],
    action,
  } = props;
  const { locale, intlLocale } = useLocale();
  const ro = locale === 'ro';
  const now = useScheduleClock();
  const zonedDate = new Intl.DateTimeFormat('sv-SE', { timeZone: zone });
  const today = zonedDate.format(now);
  const days = Array.from({ length: 7 }, (_, index) => addDays(from, index));
  const [view, setView] = useState<'week' | 'day'>('week');
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const selected =
    pickedDay && days.includes(pickedDay) ? pickedDay : days.includes(today) ? today : from;
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  });
  const rows = new Map<number, Map<string, ScheduleLesson[]>>();
  const dateFormat = new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const range = dateFormat.formatRange(
    new Date(from + 'T00:00:00Z'),
    new Date(days[6] + 'T00:00:00Z'),
  );
  const dayLabel = new Intl.DateTimeFormat(intlLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const dayLabels = new Map(
    days.map((day) => [day, dayLabel.format(new Date(day + 'T00:00:00Z'))]),
  );
  let first = 1440;
  let last = 0;
  let selectedHasLessons = false;
  for (const lesson of lessons) {
    const start = new Date(lesson.startsAt);
    const end = Date.parse(lesson.endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end) || end <= start.getTime())
      continue;
    const day = zonedDate.format(start);
    if (!days.includes(day)) continue;
    const time = minuteOfDay(clock.format(start));
    first = Math.min(first, time);
    last = Math.max(last, time);
    if (day === selected) selectedHasLessons = true;
    const row = rows.get(time) ?? new Map<string, ScheduleLesson[]>();
    const items = row.get(day) ?? [];
    items.push(lesson);
    row.set(day, items);
    rows.set(time, row);
  }
  const hasLessons = rows.size > 0;
  const opening = hasLessons ? Math.max(0, Math.floor(first / 60) * 60 - 60) : 480;
  const closing = hasLessons ? Math.min(1440, Math.max(opening + 360, last + 60)) : 1080;
  for (let time = opening; time < closing; time += 60) {
    if (!rows.has(time)) rows.set(time, new Map());
  }
  const currentTime = minuteOfDay(clock.format(now));
  const showTime =
    !loading && days.includes(today) && currentTime >= opening && currentTime < closing;
  if (showTime && !rows.has(currentTime)) rows.set(currentTime, new Map());

  function move(next: string | null) {
    setPickedDay(null);
    changeWeek(next);
  }

  function card(lesson: ScheduleLesson, day: string) {
    const title = (
      <>
        <span className="cab-sr-only">{dayLabels.get(day)}</span>
        <span className="cab-schedule-time">
          <Icon name={lesson.trial ? 'brand' : 'clock'} size={13} />
          <span>
            <time dateTime={lesson.startsAt}>{clock.format(new Date(lesson.startsAt))}</time>
            {'–'}
            <time dateTime={lesson.endsAt}>{clock.format(new Date(lesson.endsAt))}</time>
          </span>
        </span>
        <strong>{lesson.title}</strong>
        {lesson.person && <span className="cab-schedule-person">{lesson.person}</span>}
        <span className="cab-schedule-status">
          {lesson.trial && (ro ? 'De probă · ' : 'Пробный · ')}
          {statusLabel(lesson.status)}
        </span>
      </>
    );
    const className = `cab-schedule-lesson is-${lessonTone(lesson)}`;
    return 'lessonUrl' in props ? (
      <CabinLink
        key={lesson.id}
        className={className}
        to={props.lessonUrl(lesson.id)}
        navigate={props.navigate}
      >
        {title}
      </CabinLink>
    ) : (
      <button
        key={lesson.id}
        type="button"
        className={className}
        aria-pressed={props.selectedId === lesson.id}
        onClick={() => props.onSelect(lesson.id)}
      >
        {title}
      </button>
    );
  }

  return (
    <section className="cab-staff-schedule" aria-labelledby="cab-staff-schedule-title">
      <header className="cab-page-title cab-schedule-heading">
        <h1 id="cab-staff-schedule-title">{title}</h1>
        {action}
      </header>
      <div className="cab-schedule-board" data-view={view} aria-busy={loading || undefined}>
        <div className="cab-schedule-toolbar">
          <div
            className="cab-schedule-period"
            role="group"
            aria-label={ro ? 'Perioada orarului' : 'Период расписания'}
          >
            <button
              type="button"
              className="cab-button cab-schedule-step"
              aria-label={ro ? 'Săptămâna precedentă' : 'Предыдущая неделя'}
              onClick={() => move(addDays(from, -7))}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <p className="cab-schedule-range" aria-live="polite">
              {range}
            </p>
            <button
              type="button"
              className="cab-button cab-schedule-step"
              aria-label={ro ? 'Săptămâna următoare' : 'Следующая неделя'}
              onClick={() => move(addDays(from, 7))}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <div className="cab-schedule-options">
            <button
              type="button"
              className="cab-button cab-schedule-today"
              onClick={() => move(null)}
            >
              {ro ? 'Astăzi' : 'Сегодня'}
            </button>
            <div
              className="cab-schedule-views"
              role="group"
              aria-label={ro ? 'Vizualizare orar' : 'Вид расписания'}
            >
              <button
                className="cab-button"
                type="button"
                aria-pressed={view === 'day'}
                onClick={() => setView('day')}
              >
                {ro ? 'Zi' : 'День'}
              </button>
              <button
                className="cab-button"
                type="button"
                aria-pressed={view === 'week'}
                onClick={() => setView('week')}
              >
                {ro ? 'Săptămână' : 'Неделя'}
              </button>
            </div>
          </div>
        </div>
        <div
          className="cab-schedule-days"
          role="group"
          aria-label={ro ? 'Alege ziua' : 'Выбор дня'}
        >
          <div className="cab-schedule-zone" title={zone} aria-hidden="true">
            <Icon name="clock" size={16} />
          </div>
          {days.map((day) => (
            <button
              type="button"
              key={day}
              aria-pressed={day === selected}
              aria-current={day === today ? 'date' : undefined}
              aria-label={
                dayLabels.get(day) +
                (unavailableDays.includes(day) ? (ro ? ', fără date' : ', нет данных') : '')
              }
              onClick={() => setPickedDay(day)}
            >
              <span>{formatDateOnly(day, locale, { weekday: 'short' })}</span>
              <time dateTime={day}>
                {formatDateOnly(day, locale, { day: 'numeric', month: 'numeric' })}
              </time>
              {unavailableDays.includes(day) && <small>{ro ? 'Fără date' : 'Нет данных'}</small>}
            </button>
          ))}
        </div>
        {notice}
        {!loading && (
          <>
            {!hasLessons && !unavailableDays.length && (
              <p className="cab-schedule-week-empty">
                {ro ? 'Nu sunt lecții în această săptămână.' : 'На этой неделе занятий нет.'}
              </p>
            )}
            {!selectedHasLessons && (
              <p className="cab-schedule-day-empty" role="status">
                {unavailableDays.includes(selected)
                  ? ro
                    ? 'Orarul zilei nu este disponibil.'
                    : 'Расписание этого дня недоступно.'
                  : ro
                    ? 'Nu sunt lecții în această zi.'
                    : 'На этот день занятий нет.'}
              </p>
            )}
            <div
              className="cab-schedule-timeline"
              role="region"
              aria-label={ro ? `Fus orar ${zone}` : `Часовой пояс ${zone}`}
            >
              {[...rows.entries()]
                .sort(([left], [right]) => left - right)
                .map(([minute, row]) => (
                  <div
                    className="cab-schedule-row"
                    key={minute}
                    data-day-has-lessons={row.has(selected)}
                    data-hour={minute % 60 === 0}
                    data-now={showTime && minute === currentTime}
                  >
                    {showTime && minute === currentTime ? (
                      <time className="cab-schedule-hour" dateTime={now.toISOString()}>
                        <span className="cab-sr-only">{ro ? 'Ora curentă' : 'Текущее время'}</span>{' '}
                        {clockLabel(minute)}
                      </time>
                    ) : (
                      <span className="cab-schedule-hour" aria-hidden="true">
                        {minute % 60 === 0 && clockLabel(minute)}
                      </span>
                    )}
                    {days.map((day) => (
                      <div className="cab-schedule-slot" key={day} data-selected={day === selected}>
                        {row.get(day)?.map((lesson) => card(lesson, day))}
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
