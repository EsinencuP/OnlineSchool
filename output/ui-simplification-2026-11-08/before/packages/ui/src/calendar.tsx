import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { Field, IconButton, StatusChip } from './controls.js';
import { Icon } from './icon.js';
import { useLocale } from './locale.js';
import { calendarDate, formatDateOnly } from './format.js';

export { calendarDate } from './format.js';

export type DatePickerProps = {
  label: string;
  value: string;
  onValueChange: (date: string) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
};
export function DatePicker({ label, value, onValueChange, ...props }: DatePickerProps) {
  const { locale, t } = useLocale();
  const valid = calendarDate(value);
  const date = valid ? Temporal.PlainDate.from(valid) : null;
  function allowed(candidate: string) {
    const next = calendarDate(candidate);
    return next && (!props.min || next >= props.min) && (!props.max || next <= props.max)
      ? next
      : null;
  }
  const previous = date && allowed(date.subtract({ days: 1 }).toString());
  const next = date && allowed(date.add({ days: 1 }).toString());
  return (
    <div className="k8k-date-picker">
      <Field
        {...props}
        label={label}
        type="date"
        required
        value={valid ?? ''}
        hint={
          formatDateOnly(value, locale, { day: 'numeric', month: 'long', year: 'numeric' }) ??
          undefined
        }
        onChange={(event) => {
          const date = allowed(event.target.value);
          if (date) onValueChange(date);
        }}
      />
      <div className="k8k-date-steps">
        <IconButton
          label={t('calendarPreviousDate')}
          variant="secondary"
          disabled={props.disabled || !previous}
          onClick={() => {
            if (previous) onValueChange(previous);
          }}
        >
          <Icon name="arrow" className="k8k-date-back" />
        </IconButton>
        <IconButton
          label={t('calendarNextDate')}
          variant="secondary"
          disabled={props.disabled || !next}
          onClick={() => {
            if (next) onValueChange(next);
          }}
        >
          <Icon name="arrow" />
        </IconButton>
      </div>
    </div>
  );
}

export type CalendarView = 'day' | 'week' | 'month' | 'list';
export type CalendarEventState = 'protected' | 'pending-renewal' | 'busy' | 'free' | 'unknown';
export type CalendarEvent = {
  id: string;
  revision: string | number | null;
  startsAt: string;
  endsAt: string;
  title: string;
  state: CalendarEventState;
  resourceId?: string;
};
export type CalendarHorizon = { from: string; to: string };
export type CalendarProps = {
  label: string;
  timeZone: string;
  view: CalendarView;
  days: readonly string[];
  horizon: CalendarHorizon | null;
  events: readonly CalendarEvent[];
  refreshing?: boolean;
  renderEvent?: (event: CalendarEvent) => ReactNode;
};
const stateLabels = {
  protected: 'calendarProtected',
  'pending-renewal': 'calendarPendingRenewal',
  busy: 'calendarBusy',
  free: 'calendarFree',
  unknown: 'calendarUnknown',
} as const;
const stateTones = {
  protected: 'warning',
  'pending-renewal': 'warning',
  busy: 'info',
  free: 'success',
  unknown: 'neutral',
} as const;
function instant(value: string) {
  try {
    return Temporal.Instant.from(value);
  } catch {
    return null;
  }
}
function calendarGroups(
  days: readonly string[],
  horizon: CalendarHorizon | null,
  events: readonly CalendarEvent[],
  timeZone: string,
) {
  const compare = Temporal.Instant.compare;
  const from = horizon && instant(horizon.from),
    to = horizon && instant(horizon.to);
  const range = from && to && compare(from, to) < 0 ? { from, to } : null;
  const groups = new Map<
    string,
    { day: Temporal.PlainDate; covered: boolean; events: CalendarEvent[] }
  >();
  for (const value of days) {
    const valid = calendarDate(value);
    if (!valid) continue;
    const day = Temporal.PlainDate.from(valid);
    let covered = false;
    if (range) {
      try {
        const start = day.toZonedDateTime(timeZone);
        const end = day.add({ days: 1 }).toZonedDateTime(timeZone);
        covered =
          start.toPlainDate().equals(day) &&
          compare(start.toInstant(), range.from) >= 0 &&
          compare(end.toInstant(), range.to) <= 0;
      } catch {
        /* Invalid zones have no authoritative coverage. */
      }
    }
    groups.set(valid, { day, covered, events: [] });
  }
  if (range)
    for (const event of events) {
      const start = instant(event.startsAt),
        end = instant(event.endsAt);
      if (
        !start ||
        !end ||
        compare(start, end) >= 0 ||
        compare(start, range.from) < 0 ||
        compare(start, range.to) >= 0
      )
        continue;
      try {
        const group = groups.get(start.toZonedDateTimeISO(timeZone).toPlainDate().toString());
        const state =
          event.state === 'free' && compare(end, range.to) > 0 ? 'unknown' : event.state;
        group?.events.push(state === event.state ? event : { ...event, state });
      } catch {
        /* An invalid zone cannot place an event. */
      }
    }
  return [...groups.values()];
}

/** A read-only calendar of supplied intervals. Omitted intervals do not grant availability. */
export function Calendar({
  label,
  timeZone,
  view,
  days,
  horizon,
  events,
  refreshing,
  renderEvent,
}: CalendarProps) {
  const { t, intlLocale } = useLocale();
  const groups = useMemo(
    () => calendarGroups(days, horizon, events, timeZone),
    [days, horizon, events, timeZone],
  );
  let times: Intl.DateTimeFormat | undefined;
  try {
    times = new Intl.DateTimeFormat(intlLocale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'shortOffset',
    });
  } catch {
    /* No display zone. */
  }
  return (
    <section
      className="k8k-calendar"
      aria-label={label}
      aria-busy={refreshing || undefined}
      data-view={view}
    >
      <p className="k8k-calendar-zone">
        {t('calendarZone')} {timeZone}
      </p>
      <div className="k8k-calendar-days">
        {groups.map(({ day, covered, events }) => (
          <section
            className="k8k-calendar-day"
            key={day.toString()}
            data-date={day.toString()}
            data-weekday={day.dayOfWeek}
          >
            <h3>
              {day.toLocaleString(intlLocale, { weekday: 'short', day: 'numeric', month: 'long' })}
            </h3>
            {!covered && <p className="k8k-calendar-notice">{t('calendarOutside')}</p>}
            {covered && !events.length && (
              <p className="k8k-calendar-notice">{t('calendarEmpty')}</p>
            )}
            {!!events.length && (
              <ul>
                {events.map((event) => (
                  <li
                    key={event.id}
                    data-event-id={event.id}
                    data-revision={event.revision ?? undefined}
                    data-event-state={event.state}
                  >
                    <p className="k8k-calendar-times">
                      <time dateTime={event.startsAt}>
                        {times?.format(new Date(event.startsAt))}
                      </time>
                      {' – '}
                      <time dateTime={event.endsAt}>{times?.format(new Date(event.endsAt))}</time>
                    </p>
                    <StatusChip tone={stateTones[event.state]}>
                      {t(stateLabels[event.state])}
                    </StatusChip>
                    {renderEvent ? renderEvent(event) : <p>{event.title}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
