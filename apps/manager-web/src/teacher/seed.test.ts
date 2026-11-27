import { describe, expect, it } from 'vitest';
import { dayKey } from '../shared/format';
import { selectPayrollTotals } from './logic';
import { createTeacherSeed } from './seed';

const NOW = new Date('2026-11-27T18:00:00Z');

describe('teacher demo data is consistent across screens', () => {
  const s = createTeacherSeed(NOW);

  it('conducted lessons in the history equal each enrollment confirmed-lesson counter', () => {
    for (const e of s.enrollments) {
      const conducted = s.lessons.filter((l) => l.studentId === e.studentId && l.status === 'CONDUCTED').length;
      if (!s.lessons.some((l) => l.studentId === e.studentId && l.status !== 'CANCELLED')) continue; // frozen student
      expect(conducted).toBe(e.confirmedLessons);
    }
  });

  it('has no lessons before the student was assigned', () => {
    for (const e of s.enrollments)
      expect(s.lessons.filter((l) => l.studentId === e.studentId && l.startsAt < e.assignedFrom)).toHaveLength(0);
  });

  it('previous-month payroll is built from the conducted lessons of that month', () => {
    const prev = s.payrollHistory.at(-1)!;
    const lessons = s.lessons.filter((l) => l.status === 'CONDUCTED' && dayKey(l.startsAt).slice(0, 7) === prev.month);
    expect(prev.lines).toHaveLength(lessons.length);
    expect(Number(selectPayrollTotals(prev.lines).accrued)).toBe(lessons.length * 220);
  });

  it('current-month payroll lines match conducted lessons of this month', () => {
    const month = dayKey(s.now).slice(0, 7);
    const conducted = s.lessons.filter((l) => l.status === 'CONDUCTED' && dayKey(l.startsAt).slice(0, 7) === month);
    expect(s.payroll.lines).toHaveLength(conducted.length);
  });
});
