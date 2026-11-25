import { dayKey, fmtTime } from './format';

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
  cancelled?: boolean;
  label: string;
}

export function weekDays(nowIso: string, weekOffset: number): Date[] {
  const today = new Date(nowIso);
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export const weekRangeLabel = (days: Date[]) =>
  `${days[0]!.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — ${days[6]!.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;

/**
 * Week calendar shared by manager and teacher cabinets. Overlapping items are
 * laid out in lanes; optional `shade` paints availability windows per weekday.
 */
export function WeekGrid({
  days,
  items,
  now,
  onOpen,
  shade,
}: {
  days: Date[];
  items: GridItem[];
  now: string;
  onOpen: (id: string) => void;
  shade?: (weekday: number) => { from: number; to: number }[];
}) {
  const keys = days.map((d) => dayKey(d.toISOString()));
  const todayKey = dayKey(now);
  const nowDate = new Date(now);
  const hours = GRID_END_H - GRID_START_H;

  return (
    <div className="week" role="grid" aria-label="Неделя">
      <div />
      {days.map((d, i) => (
        <div key={i} className={`week-day-head${keys[i] === todayKey ? ' today' : ''}`}>
          {DOW[i]}
          <b className="num">{d.getDate()}</b>
        </div>
      ))}
      <div>
        {Array.from({ length: hours }, (_, h) => (
          <div key={h} className="week-hour num">
            {String(GRID_START_H + h).padStart(2, '0')}:00
          </div>
        ))}
      </div>
      {days.map((d, i) => {
        const dayItems = items.filter((it) => dayKey(it.startsAt) === keys[i]);
        const nowTop = (nowDate.getHours() + nowDate.getMinutes() / 60 - GRID_START_H) * ROW;
        return (
          <div key={i} className={`week-col${i >= 5 ? ' weekend' : ''}`} role="gridcell" aria-label={`${DOW[i]} ${d.getDate()}: ${dayItems.length}`}>
            {Array.from({ length: hours }, (_, h) => (
              <div key={h} className="week-slot-line" />
            ))}
            {shade?.(i).map((w, k) => (
              <div
                key={k}
                className="avail-shade"
                style={{ top: (Math.max(w.from, GRID_START_H) - GRID_START_H) * ROW, height: (Math.min(w.to, GRID_END_H) - Math.max(w.from, GRID_START_H)) * ROW }}
                aria-hidden="true"
              />
            ))}
            {keys[i] === todayKey && nowTop > 0 && nowTop < hours * ROW && <div className="now-marker" style={{ top: nowTop }} aria-hidden="true" />}
            {dayItems.map((it) => {
              const overlapping = dayItems.filter((o) => o.startsAt < it.endsAt && it.startsAt < o.endsAt);
              const lane = overlapping.indexOf(it);
              const s = new Date(it.startsAt);
              const top = (s.getHours() + s.getMinutes() / 60 - GRID_START_H) * ROW;
              if (top < 0 || top > hours * ROW) return null;
              const height = Math.max(28, ((new Date(it.endsAt).getTime() - s.getTime()) / 3600_000) * ROW - 4);
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`lesson-block${it.cancelled ? ' cancelled' : ''}`}
                  style={{
                    top: top + 2,
                    height,
                    background: it.background,
                    left: `calc(${(lane / overlapping.length) * 100}% + 3px)`,
                    width: `calc(${100 / overlapping.length}% - 6px)`,
                    right: 'auto',
                  }}
                  onClick={() => onOpen(it.id)}
                  aria-label={it.label}
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
