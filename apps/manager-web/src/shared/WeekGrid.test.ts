import { describe, expect, it } from 'vitest';
import { addDays, layoutLanes, weekDays } from './WeekGrid';

const at = (h: number) => `2026-11-24T${String(h).padStart(2, '0')}:00:00Z`;

describe('WeekGrid helpers', () => {
  it('gives a transitive overlap cluster one shared lane count, so blocks never cover each other', () => {
    const lanes = layoutLanes([
      { id: 'A', startsAt: at(9), endsAt: at(11) },
      { id: 'B', startsAt: at(10), endsAt: at(12) },
      { id: 'C', startsAt: at(11), endsAt: at(12) },
      { id: 'D', startsAt: at(14), endsAt: at(15) },
    ]);
    expect(lanes.get('A')).toEqual({ lane: 0, of: 2 });
    expect(lanes.get('B')).toEqual({ lane: 1, of: 2 });
    expect(lanes.get('C')).toEqual({ lane: 0, of: 2 }); // reuses A's lane after A ends
    expect(lanes.get('D')).toEqual({ lane: 0, of: 1 });
  });

  it('builds a Monday-first week of school-day keys across month boundaries', () => {
    expect(weekDays('2026-12-02T10:00:00Z', 0)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
    expect(weekDays('2026-11-29T23:30:00Z', 0)[0]).toBe('2026-11-30'); // 01:30 Monday in Chisinau
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // across DST change
  });
});
