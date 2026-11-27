import type { ReactNode } from 'react';
import { dayKey, fmtTime, hourOf } from './format';

export const GRID_START_H = 9;
export const GRID_END_H = 21;
const ROW = 56;
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export interface GridItem {
  id: string;
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle: string;
  background: string;
  /** Left edge colour: status at a glance without relying on the fill alone. */
  edge?: string;
  cancelled?: boolean;
  label: string;
  /** Resource column (e.g. teacher id) for the day-by-resource view. */
  column?: string;
}

/** A column is a school-timezone day; in resource mode it is one resource on that day. */
export interface GridColumn {
  key: string;
  day: string;
  head: ReactNode;
  label: string;
  weekend?: boolean;
}

const keyToNoonUtc = (key: string) => new Date(`${key}T12:00:00Z`);
const noonKey = (d: Date) => d.toISOString().slice(0, 10);

/** Monday-first week of day keys (YYYY-MM-DD, school timezone) around `nowIso`. */
export function weekDays(nowIso: string, weekOffset: number): string[] {
  const today = keyToNoonUtc(dayKey(nowIso));
  const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * 864e5 + weekOffset * 7 * 864e5);
  return Array.from({ length: 7 }, (_, i) => noonKey(new Date(monday.getTime() + i * 864e5)));
}

/** Day key shifted by n days. */
export const addDays = (key: string, n: number) => noonKey(new Date(keyToNoonUtc(key).getTime() + n * 864e5));

const fmtKey = (key: string, opts: Intl.DateTimeFormatOptions) => keyToNoonUtc(key).toLocaleDateString('ru-RU', { timeZone: 'UTC', ...opts });
export const dayLabel = (key: string) => fmtKey(key, { weekday: 'long', day: 'numeric', month: 'long' });
export const weekRangeLabel = (days: string[]) => `${fmtKey(days[0]!, { day: 'numeric', month: 'long' })} — ${fmtKey(days[6]!, { day: 'numeric', month: 'long' })}`;

export function dayColumns(days: string[]): GridColumn[] {
  return days.map((k) => {
    const wd = (keyToNoonUtc(k).getUTCDay() + 6) % 7;
    return { key: k, day: k, head: <>{DOW[wd]}<b className="num">{keyToNoonUtc(k).getUTCDate()}</b></>, label: `${DOW[wd]} ${keyToNoonUtc(k).getUTCDate()}`, weekend: wd >= 5 };
  });
}

/**
 * Side-by-side lanes for overlapping items: items that overlap transitively form one cluster,
 * each item takes the first free lane, and the whole cluster shares the cluster's lane count.
 */
export function layoutLanes(items: { id: string; startsAt: string; endsAt: string }[]) {
  const out = new Map<string, { lane: number; of: number }>();
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || b.endsAt.localeCompare(a.endsAt));
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: string[] = [];
  let clusterEnd = '';
  const flush = () => {
    for (const c of cluster) out.set(c.id, { lane: c.lane, of: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.startsAt >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= it.startsAt);
    if (lane === -1) lane = laneEnds.push(it.endsAt) - 1;
    else laneEnds[lane] = it.endsAt;
    cluster.push({ id: it.id, lane });
    clusterEnd = cluster.length === 1 || it.endsAt > clusterEnd ? it.endsAt : clusterEnd;
  }
  flush();
  return out;
}

/**
 * Calendar grid shared by manager and teacher cabinets. Pass `days` for a week, or
 * `columns` for one day split by resource. Overlapping items are laid out in lanes;
 * `shade` paints availability windows per column index (weekday in week mode).
 */
export function WeekGrid({
  days,
  columns,
  items,
  now,
  onOpen,
  shade,
}: {
  days?: string[];
  columns?: GridColumn[];
  items: GridItem[];
  now: string;
  onOpen: (id: string) => void;
  shade?: (index: number) => { from: number; to: number }[];
}) {
  const cols = columns ?? dayColumns(days ?? []);
  const todayKey = dayKey(now);
  // Widen the default 09–21 window so early or late lessons are never dropped.
  const shown = items.filter((it) => cols.some((c) => c.day === dayKey(it.startsAt)));
  const startH = Math.max(0, Math.min(GRID_START_H, ...shown.map((it) => Math.floor(hourOf(it.startsAt)))));
  const endH = Math.min(24, Math.max(GRID_END_H, ...shown.map((it) => Math.ceil(hourOf(it.startsAt) + (new Date(it.endsAt).getTime() - new Date(it.startsAt).getTime()) / 3600_000))));
  const hours = endH - startH;
  const nowTop = (hourOf(now) - startH) * ROW;

  return (
    <div className="week" role="region" aria-label="Расписание" style={{ ['--cols' as string]: cols.length }}>
      <div />
      {cols.map((c) => (
        <div key={c.key} className={`week-day-head${!columns && c.day === todayKey ? ' today' : ''}`}>
          {c.head}
        </div>
      ))}
      <div>
        {Array.from({ length: hours }, (_, h) => (
          <div key={h} className="week-hour num">
            {String(startH + h).padStart(2, '0')}:00
          </div>
        ))}
      </div>
      {cols.map((c, i) => {
        const colItems = items.filter((it) => dayKey(it.startsAt) === c.day && (!columns || it.column === c.key));
        const lanes = layoutLanes(colItems);
        return (
          <div key={c.key} className={`week-col${c.weekend ? ' weekend' : ''}`} role="group" aria-label={`${c.label}: ${colItems.length}`}>
            {Array.from({ length: hours }, (_, h) => (
              <div key={h} className="week-slot-line" />
            ))}
            {shade?.(i).map((w, k) => (
              <div
                key={k}
                className="avail-shade"
                style={{ top: (Math.max(w.from, startH) - startH) * ROW, height: Math.max(0, Math.min(w.to, endH) - Math.max(w.from, startH)) * ROW }}
                aria-hidden="true"
              />
            ))}
            {c.day === todayKey && nowTop > 0 && nowTop < hours * ROW && <div className="now-marker" style={{ top: nowTop }} aria-hidden="true" />}
            {colItems.map((it) => {
              const { lane, of } = lanes.get(it.id) ?? { lane: 0, of: 1 };
              const top = (hourOf(it.startsAt) - startH) * ROW;
              const height = Math.max(28, ((new Date(it.endsAt).getTime() - new Date(it.startsAt).getTime()) / 3600_000) * ROW - 4);
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`lesson-block${it.cancelled ? ' cancelled' : ''}`}
                  style={{
                    top: top + 2,
                    height,
                    background: it.background,
                    ['--block-edge' as string]: it.edge ?? 'transparent',
                    left: `calc(${(lane / of) * 100}% + 3px)`,
                    width: `calc(${100 / of}% - 6px)`,
                    right: 'auto',
                  }}
                  onClick={() => onOpen(it.id)}
                  aria-label={it.label}
                  title={it.label}
                >
                  <b>{it.title}</b>
                  <span className="num">
                    {fmtTime(it.startsAt)} · {it.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
