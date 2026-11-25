import { describe, expect, it } from 'vitest';
import { executeTeacher, selectJournal, selectPayrollTotals, selectRate } from './logic';
import { createTeacherSeed } from './seed';
import type { TeacherState } from './types';

const NOW = new Date('2026-11-25T20:30:00'); // Wednesday evening

const ok = (r: ReturnType<typeof executeTeacher>): TeacherState => {
  expect(r).toMatchObject({ ok: true });
  return (r as Extract<typeof r, { ok: true }>).state;
};

describe('teacher cabinet rules (mirror /api/v1/teacher and regulations)', () => {
  it('computes the lesson rate from seniority and student points', () => {
    const s = createTeacherSeed(NOW);
    expect(selectRate(s)).toMatchObject({ seniority: 6, students: 3, points: 9, rate: '220.00' });
    expect(selectRate({ ...s, me: { ...s.me, seniorityMonths: 2 }, enrollments: s.enrollments.slice(0, 2) })).toMatchObject({ points: 2, rate: '200.00' });
    expect(selectRate({ ...s, enrollments: [...s.enrollments, ...s.enrollments] })).toMatchObject({ points: 10, rate: '250.00' });
  });

  it('flags lessons without a report after 24 h and records the outcome once', () => {
    const s = createTeacherSeed(NOW);
    const awaiting = selectJournal(s).filter((j) => j.state === 'AWAITING_REPORT');
    expect(awaiting.length).toBeGreaterThan(0);
    const item = awaiting[0]!;
    expect(executeTeacher(s, { type: 'lesson.report', lessonId: item.lessonId, result: 'CONDUCTED', studentNoShow: false, waited15: false, durationMin: 60, note: '' })).toMatchObject({ ok: false, code: 'NOTE_REQUIRED' });
    const next = ok(executeTeacher(s, { type: 'lesson.report', lessonId: item.lessonId, result: 'CONDUCTED', studentNoShow: false, waited15: false, durationMin: 60, note: 'Квадратные уравнения' }));
    expect(selectJournal(next).find((j) => j.lessonId === item.lessonId)?.state).toBe('CONDUCTED');
    expect(next.payroll.lines[0]).toMatchObject({ status: 'PENDING_ACCRUAL', amount: '220.00' });
    expect(executeTeacher(next, { type: 'lesson.report', lessonId: item.lessonId, result: 'CONDUCTED', studentNoShow: false, waited15: false, durationMin: 60, note: 'again' })).toMatchObject({ ok: false, code: 'OUTCOME_ALREADY_RECORDED' });
  });

  it('requires the 15-minute wait before reporting a student no-show', () => {
    const s = createTeacherSeed(NOW);
    const item = selectJournal(s).find((j) => j.state === 'AWAITING_REPORT')!;
    expect(executeTeacher(s, { type: 'lesson.report', lessonId: item.lessonId, result: 'NOT_CONDUCTED', studentNoShow: true, waited15: false, durationMin: 0, note: 'Не подключился' })).toMatchObject({ ok: false, code: 'WAIT_REQUIRED' });
    const next = ok(executeTeacher(s, { type: 'lesson.report', lessonId: item.lessonId, result: 'NOT_CONDUCTED', studentNoShow: true, waited15: true, durationMin: 0, note: 'Не подключился' }));
    expect(next.payroll.lines[0]?.rateBasis).toContain('полная ставка');
  });

  it('opens a checkpoint every 4 confirmed lessons (report every 8)', () => {
    let s = createTeacherSeed(NOW);
    const enr = s.enrollments.find((e) => e.confirmedLessons % 4 === 3) ?? s.enrollments[0]!;
    s = { ...s, enrollments: s.enrollments.map((e) => (e === enr ? { ...e, confirmedLessons: 7 } : e)) };
    const lesson = s.lessons.find((l) => l.studentId === enr.studentId && l.endsAt <= s.now && !s.reports[l.lessonId]) ?? s.lessons.find((l) => l.studentId === enr.studentId && l.endsAt <= s.now)!;
    const reports = { ...s.reports };
    delete reports[lesson.lessonId];
    s = { ...s, reports };
    const next = ok(executeTeacher(s, { type: 'lesson.report', lessonId: lesson.lessonId, result: 'CONDUCTED', studentNoShow: false, waited15: false, durationMin: 60, note: 'Системы уравнений' }));
    expect(next.checkpoints[0]).toMatchObject({ type: 'LESSON_8', confirmedLessonCount: 8, state: 'PENDING' });
    expect(executeTeacher(next, { type: 'checkpoint.complete', checkpointId: next.checkpoints[0]!.checkpointId })).toMatchObject({ ok: false, code: 'WRONG_CHECKPOINT_TYPE' });
    expect(executeTeacher(next, { type: 'checkpoint.publish', checkpointId: next.checkpoints[0]!.checkpointId, content: { achievements: 'ok', growthAreas: 'ok', recommendations: 'ok', teacherSignature: 'x' } })).toMatchObject({ ok: false, code: 'REPORT_FIELDS_REQUIRED' });
  });

  it('needs a public reason to move a skill back a stage (9.3)', () => {
    const s = createTeacherSeed(NOW);
    const [enrollmentId, list] = Object.entries(s.skills)[0]!;
    const skill = list.find((k) => k.status === 'APPLYING' || k.status === 'PRACTICING')!;
    expect(executeTeacher(s, { type: 'skill.assess', enrollmentId, skillId: skill.skillId, status: 'FAMILIARIZING', publicComment: '', internalComment: '' })).toMatchObject({ ok: false, code: 'REASON_REQUIRED' });
    expect(executeTeacher(s, { type: 'skill.assess', enrollmentId, skillId: skill.skillId, status: 'FAMILIARIZING', publicComment: 'Повторим тему', internalComment: '' }).ok).toBe(true);
  });

  it('enforces notice periods for schedule requests unless marked as emergency', () => {
    const s = createTeacherSeed(NOW);
    const soon = s.lessons.find((l) => l.status === 'SCHEDULED' && new Date(l.startsAt).getTime() - NOW.getTime() < 48 * 3600_000 && l.startsAt > s.now)!;
    expect(executeTeacher(s, { type: 'request.create', kind: 'SINGLE_CANCEL', lessonId: soon.lessonId, startsAt: null, reason: 'Конференция', emergency: false })).toMatchObject({ ok: false, code: 'NOTICE_TOO_SHORT' });
    expect(executeTeacher(s, { type: 'request.create', kind: 'SINGLE_CANCEL', lessonId: soon.lessonId, startsAt: null, reason: 'Заболела', emergency: true }).ok).toBe(true);
    const inTenDays = new Date(NOW.getTime() + 10 * 24 * 3600_000).toISOString();
    expect(executeTeacher(s, { type: 'request.create', kind: 'PERMANENT_CHANGE', lessonId: null, startsAt: inTenDays, reason: 'Сдвинуть слот', emergency: false }).ok).toBe(true);
    expect(executeTeacher(s, { type: 'request.create', kind: 'ABSENCE', lessonId: null, startsAt: inTenDays, reason: 'Отпуск на неделю', emergency: false })).toMatchObject({ ok: false, code: 'NOTICE_TOO_SHORT' });
  });

  it('protects booked lessons when removing availability and rejects overlaps', () => {
    const s = createTeacherSeed(NOW);
    const monday = s.availability.find((w) => w.weekday === 0)!;
    expect(executeTeacher(s, { type: 'availability.remove', windowId: monday.id })).toMatchObject({ ok: false, code: 'WINDOW_HAS_LESSONS' });
    expect(executeTeacher(s, { type: 'availability.add', weekday: 0, from: 15, to: 16 })).toMatchObject({ ok: false, code: 'WINDOW_OVERLAP' });
    expect(executeTeacher(s, { type: 'availability.add', weekday: 6, from: 11, to: 13 }).ok).toBe(true);
  });

  it('requires a comment to send homework back and sums payroll in decimal strings', () => {
    const s = createTeacherSeed(NOW);
    const h = s.homework.find((x) => x.state === 'AWAITING_REVIEW')!;
    expect(executeTeacher(s, { type: 'homework.review', deliveryId: h.deliveryId, result: 'NEEDS_REVISION', comment: '' })).toMatchObject({ ok: false, code: 'COMMENT_REQUIRED' });
    expect(ok(executeTeacher(s, { type: 'homework.review', deliveryId: h.deliveryId, result: 'ACCEPTED', comment: '' })).homework.find((x) => x.deliveryId === h.deliveryId)?.state).toBe('REVIEWED');
    const t = selectPayrollTotals([
      { ...s.payroll.lines[0]!, amount: '220.00', paid: '220.00', status: 'PAID' },
      { ...s.payroll.lines[0]!, amount: '220.00', paid: '0.00', status: 'ACCRUED' },
      { ...s.payroll.lines[0]!, amount: '200.00', paid: '0.00', status: 'PENDING_ACCRUAL' },
    ]);
    expect(t).toEqual({ currency: 'MDL', accrued: '440.00', paid: '220.00', outstanding: '220.00', pendingAccrual: '200.00' });
  });
});
