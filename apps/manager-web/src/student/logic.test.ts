import { describe, expect, it } from 'vitest';
import { executeStudent, joinState, selectDashboard, selectLessons } from './logic';
import { createStudentSeed } from './seed';

const NOW = new Date('2026-11-24T12:00:00');

describe('student cabinet rules (mirror /api/v1/student)', () => {
  it('opens the Meet link exactly 10 minutes before the lesson', () => {
    const lesson = { scheduledAt: '2026-11-24T12:30:00.000Z', durationMinutes: 60, status: 'SCHEDULED' as const, meetLink: 'https://meet.google.com/x' };
    expect(joinState(lesson, '2026-11-24T12:19:00.000Z').canJoin).toBe(false);
    expect(joinState(lesson, '2026-11-24T12:20:00.000Z').canJoin).toBe(true);
    expect(joinState(lesson, '2026-11-24T13:30:00.000Z').canJoin).toBe(false);
    expect(joinState({ ...lesson, meetLink: null }, '2026-11-24T12:25:00.000Z').canJoin).toBe(false);
  });

  it('allows a reschedule request only ≥ 24 h before the lesson, once', () => {
    const s = createStudentSeed(NOW);
    const lessons = selectLessons(s);
    const soon = lessons.find((l) => new Date(l.scheduledAt).getTime() - NOW.getTime() < 24 * 3600_000)!;
    const far = lessons.find((l) => new Date(l.scheduledAt).getTime() - NOW.getTime() >= 24 * 3600_000)!;
    expect(soon.canRequestReschedule).toBe(false);
    expect(executeStudent(s, { type: 'lesson.requestReschedule', lessonId: soon.lessonId, preferredDate: '2026-12-01', comment: 'Олимпиада в этот день' })).toMatchObject({ ok: false, code: 'RESCHEDULE_TOO_LATE' });
    const r = executeStudent(s, { type: 'lesson.requestReschedule', lessonId: far.lessonId, preferredDate: '2026-12-01', comment: 'Олимпиада в этот день' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(selectLessons(r.state).find((l) => l.lessonId === far.lessonId)?.canRequestReschedule).toBe(false);
    expect(executeStudent(r.state, { type: 'lesson.requestReschedule', lessonId: far.lessonId, preferredDate: '2026-12-01', comment: 'Олимпиада в этот день' })).toMatchObject({ ok: false, code: 'RESCHEDULE_ALREADY_REQUESTED' });
  });

  it('disputes only deducted lessons within 30 days, one open dispute per lesson', () => {
    const s = createStudentSeed(NOW);
    const recent = s.history.find((h) => h.lessonDeducted && h.canDispute)!;
    const old = s.history.find((h) => h.lessonDeducted && !h.canDispute)!;
    const cancelled = s.history.find((h) => !h.lessonDeducted)!;
    expect(executeStudent(s, { type: 'lesson.dispute', lessonId: old.lessonId, comment: 'Урок не состоялся вовремя' })).toMatchObject({ ok: false, code: 'DISPUTE_NOT_ALLOWED' });
    expect(executeStudent(s, { type: 'lesson.dispute', lessonId: cancelled.lessonId, comment: 'Урок не состоялся вовремя' })).toMatchObject({ ok: false, code: 'DISPUTE_NOT_ALLOWED' });
    const r = executeStudent(s, { type: 'lesson.dispute', lessonId: recent.lessonId, comment: 'Урок не состоялся вовремя' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(executeStudent(r.state, { type: 'lesson.dispute', lessonId: recent.lessonId, comment: 'Урок не состоялся вовремя' })).toMatchObject({ ok: false, code: 'DISPUTE_ALREADY_OPEN' });
  });

  it('submits homework as a new version and blocks resubmission while on review', () => {
    const s = createStudentSeed(NOW);
    const revise = s.homework.find((h) => h.status === 'NEEDS_REVISION')!;
    const reviewed = s.homework.find((h) => h.status === 'REVIEWED')!;
    expect(executeStudent(s, { type: 'homework.submit', homeworkId: reviewed.homeworkId, content: 'ещё раз' })).toMatchObject({ ok: false, code: 'HOMEWORK_ALREADY_REVIEWED' });
    const r = executeStudent(s, { type: 'homework.submit', homeworkId: revise.homeworkId, content: 'Исправленное эссе' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = r.state.homework.find((h) => h.homeworkId === revise.homeworkId)!;
    expect(after.status).toBe('SUBMITTED');
    expect(after.versions).toHaveLength(revise.versions.length + 1);
    expect(after.draftContent).toBeNull();
    expect(executeStudent(r.state, { type: 'homework.submit', homeworkId: revise.homeworkId, content: 'ещё' })).toMatchObject({ ok: false, code: 'HOMEWORK_AWAITING_REVIEW' });
  });

  it('builds the dashboard like GET /student/dashboard', () => {
    const d = selectDashboard(createStudentSeed(NOW));
    expect(d.nextLesson).not.toBeNull();
    expect(d.homework.total).toBe(6);
    expect(d.subscription?.isFrozen).toBe(true);
    const sp = d.skillProgress;
    expect(sp.applying + sp.practicing + sp.familiarizing + sp.notStudied).toBe(15);
  });
});
