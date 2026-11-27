import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { dayKey, fmtTime } from './format';
import { addDays } from './WeekGrid';

const DOW = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const noon = (key: string) => new Date(`${key}T12:00:00Z`);

/** First day key of the month that contains `key`. */
export const monthStart = (key: string) => `${key.slice(0, 7)}-01`;
/** Same day number in the month shifted by n (clamped to the 1st for simplicity). */
export const addMonths = (key: string, n: number) => {
  const d = noon(monthStart(key));
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
export const monthLabel = (key: string) => noon(key).toLocaleDateString('ru-RU', { timeZone: 'UTC', month: 'long', year: 'numeric' });

/** 6 Monday-first weeks (42 school-day keys) covering the month of `key`. */
export function monthKeys(key: string): string[] {
  const first = monthStart(key);
  const back = (noon(first).getUTCDay() + 6) % 7;
  const start = addDays(first, -back);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Compact month picker for a calendar sidebar (Notion Calendar style). */
export function MonthPicker({
  anchor,
  today,
  inRange,
  busy,
  onPick,
  onMonth,
}: {
  anchor: string;
  today: string;
  inRange: (key: string) => boolean;
  busy: Set<string>;
  onPick: (key: string) => void;
  onMonth: (key: string) => void;
}) {
  const keys = monthKeys(anchor);
  const month = anchor.slice(0, 7);
  return (
    <div className="mpick" aria-label="Выбор даты">
      <div className="mpick-head">
        <b>{monthLabel(anchor)}</b>
        <button type="button" className="icon-btn sm" aria-label="Предыдущий месяц" onClick={() => onMonth(addMonths(anchor, -1))}>
          <ChevronLeft size={14} />
        </button>
        <button type="button" className="icon-btn sm" aria-label="Следующий месяц" onClick={() => onMonth(addMonths(anchor, 1))}>
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="mpick-grid">
        {DOW.map((d) => (
          <span key={d} className="mpick-dow">
            {d}
          </span>
        ))}
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            className={['mpick-day', k.slice(0, 7) !== month ? 'out' : '', k === today ? 'today' : '', inRange(k) ? 'sel' : '', busy.has(k) ? 'busy' : ''].join(' ')}
            aria-label={`${noon(k).getUTCDate()} ${monthLabel(k)}${busy.has(k) ? ', есть уроки' : ''}`}
            aria-current={k === today ? 'date' : undefined}
            onClick={() => onPick(k)}
          >
            {noon(k).getUTCDate()}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface MonthItem {
  id: string;
  startsAt: string;
  title: string;
  color: string;
  tint: string;
  cancelled?: boolean;
  marker?: ReactNode;
  label: string;
}

/** Month view: up to `max` events per day, the rest behind "+N" that opens the day. */
export function MonthGrid({
  anchor,
  today,
  items,
  onOpen,
  onDay,
  max = 3,
}: {
  anchor: string;
  today: string;
  items: MonthItem[];
  onOpen: (id: string) => void;
  onDay: (key: string) => void;
  max?: number;
}) {
  const keys = monthKeys(anchor);
  const month = anchor.slice(0, 7);
  const byDay = new Map<string, MonthItem[]>();
  for (const it of [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const k = dayKey(it.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), it]);
  }
  return (
    <div className="mgrid" role="region" aria-label={`Месяц: ${monthLabel(anchor)}`}>
      {DOW.map((d) => (
        <div key={d} className="mgrid-dow">
          {d}
        </div>
      ))}
      {keys.map((k) => {
        const list = byDay.get(k) ?? [];
        return (
          <div key={k} className={`mgrid-cell${k.slice(0, 7) !== month ? ' out' : ''}${k === today ? ' today' : ''}`} role="group" aria-label={`${noon(k).getUTCDate()}: ${list.length}`}>
            <button type="button" className="mgrid-num" onClick={() => onDay(k)} aria-label={`Открыть день ${noon(k).getUTCDate()}`}>
              {noon(k).getUTCDate()}
            </button>
            {list.slice(0, max).map((it) => (
              <button
                key={it.id}
                type="button"
                className={`mgrid-ev${it.cancelled ? ' cancelled' : ''}`}
                style={{ background: it.tint, borderLeftColor: it.color }}
                onClick={() => onOpen(it.id)}
                aria-label={it.label}
                title={it.label}
              >
                <span className="num">{fmtTime(it.startsAt)}</span> {it.marker}
                {it.title}
              </button>
            ))}
            {list.length > max && (
              <button type="button" className="mgrid-more" onClick={() => onDay(k)}>
                ещё {list.length - max}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
