import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { dayKey } from './format';

const DOW = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

/** Month calendar with dots on busy days; used by all three cabinets. */
export function MiniCalendar({ now, busy, label = 'Календарь уроков' }: { now: string; busy: Set<string>; label?: string }) {
  const today = new Date(now);
  const [offset, setOffset] = useState(0);
  const view = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const start = new Date(view);
  start.setDate(1 - ((view.getDay() + 6) % 7));
  const todayKey = dayKey(now);
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const monthLabel = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(view);

  return (
    <section className="card" aria-label={label}>
      <div className="cal-head">
        <button type="button" className="icon-btn" aria-label="Предыдущий месяц" onClick={() => setOffset((o) => o - 1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="cal-month">{monthLabel}</span>
        <button type="button" className="icon-btn" aria-label="Следующий месяц" onClick={() => setOffset((o) => o + 1)}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="cal-grid">
        {DOW.map((d) => (
          <span key={d} className="cal-dow">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const key = dayKey(d.toISOString());
          const cls = ['cal-day', d.getMonth() !== view.getMonth() ? 'out' : '', key === todayKey ? 'today' : '', busy.has(key) ? 'busy' : ''].join(' ');
          return (
            <span key={key} className={cls} aria-label={`${d.getDate()}${busy.has(key) ? ', есть уроки' : ''}`}>
              {d.getDate()}
            </span>
          );
        })}
      </div>
    </section>
  );
}
