import { Link } from 'react-router-dom';
import { Icon, useLocale, formatDateOnly, Field } from '@online-school/ui';
import type { LessonCardDto } from '@online-school/api-contracts';
import { useMe } from './Layout.js';
import { dayKey } from './components.js';
import { lessonHref } from './lesson-navigation.js';
import { useIdentityCopy } from './identity-copy.js';
import { calendarMonth, adjacentMonth, lessonCalendarDay } from './calendar-presentation.js';

export function StudentMonthCalendar({
  month,
  items,
  change,
  backTo,
  fromSubject,
  eventsKnown = true,
}: {
  month: string;
  items: readonly LessonCardDto[];
  change: (month: string) => void;
  backTo: string;
  fromSubject?: string | undefined;
  eventsKnown?: boolean;
}) {
  const { locale, intlLocale } = useLocale();
  const { timeZone } = useMe();
  const text = useIdentityCopy();
  const previous = adjacentMonth(month, -1),
    next = adjacentMonth(month, 1);
  const today = dayKey(new Date().toISOString());
  const dateKey = (value: string) => lessonCalendarDay(value, timeZone);
  const lessons = new Map<string, LessonCardDto>();
  for (const lesson of items)
    if (!lessons.has(dateKey(lesson.scheduledAt))) lessons.set(dateKey(lesson.scheduledAt), lesson);
  return (
    <div className="k8k-month-calendar">
      <div className="k8k-month-heading">
        <button
          type="button"
          aria-label={text('previousMonth')}
          disabled={!previous}
          onClick={() => previous && change(previous)}
        >
          <Icon name="arrow" className="k8k-arrow-back" />
        </button>
        <h2>{formatDateOnly(month + '-01', locale, { month: 'long', year: 'numeric' })}</h2>
        <button
          type="button"
          aria-label={text('nextMonth')}
          disabled={!next}
          onClick={() => next && change(next)}
        >
          <Icon name="arrow" />
        </button>
      </div>
      <div className="k8k-month-grid" aria-label={text('lessons')}>
        {Array.from({ length: 7 }, (_, index) => (
          <span key={'weekday-' + index} className="k8k-month-weekday">
            {new Intl.DateTimeFormat(intlLocale, { weekday: 'short', timeZone: 'UTC' }).format(
              new Date(Date.UTC(2026, 10, 2 + index)),
            )}
          </span>
        ))}
        {calendarMonth(month).map((date, index) => {
          if (!date) return <span key={'blank-' + index} />;
          const lesson = lessons.get(date);
          const label =
            formatDateOnly(date, locale, { day: 'numeric', month: 'long', year: 'numeric' }) ??
            date;
          return lesson ? (
            <Link
              key={date}
              className="k8k-month-day"
              data-has-lesson="true"
              aria-current={date === today ? 'date' : undefined}
              aria-label={label + ' · ' + lesson.subjectName}
              to={lessonHref(lesson.lessonId, backTo, fromSubject)}
            >
              {Number(date.slice(-2))}
            </Link>
          ) : (
            <time
              key={date}
              className="k8k-month-day"
              dateTime={date}
              aria-current={date === today ? 'date' : undefined}
            >
              {Number(date.slice(-2))}
            </time>
          );
        })}
      </div>
      <p className="k8k-month-legend">
        <span aria-hidden="true" />
        {text(eventsKnown ? 'hasLesson' : 'calendarUnverified')}
      </p>
      <details className="k8k-month-jump">
        <summary>{text('chooseMonth')}</summary>
        <Field
          label={text('month')}
          type="month"
          value={month}
          onChange={(event) => {
            if (/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value))
              change(event.target.value);
          }}
          containerClassName="k8k-month-input"
        />
      </details>
    </div>
  );
}
