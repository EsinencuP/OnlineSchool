import type { CommandResult } from '../shared/store';
import type { HomeworkItem, LessonCard, StudentDashboard, StudentState } from './types';

/**
 * Pure command handlers mirroring /api/v1/student/* rules:
 *  - Meet link opens 10 minutes before the lesson (GM-SCOPE-05);
 *  - reschedule request only while the lesson is ≥ 24 h away (lessons.service);
 *  - dispute only for a deducted lesson within 720 h and without an open dispute (history.service);
 *  - homework: draft → submit creates a new version; REVIEWED is final.
 */
export type StudentCommand =
  | { type: 'homework.saveDraft'; homeworkId: string; content: string }
  | { type: 'homework.submit'; homeworkId: string; content: string }
  | { type: 'lesson.requestReschedule'; lessonId: string; preferredDate: string; comment: string }
  | { type: 'lesson.dispute'; lessonId: string; comment: string }
  | { type: 'report.read'; reportId: string }
  | { type: 'notification.read'; notificationId: string }
  | { type: 'notification.readAll' }
  | { type: 'reports.exportPdf' }
  | { type: 'reports.exportReady' };

type R = CommandResult<StudentState>;
const H = 3600_000;
export const JOIN_OPENS_MIN = 10;
export const RESCHEDULE_MIN_HOURS = 24;
export const DISPUTE_WINDOW_HOURS = 720;

const TEXT: Record<string, string> = {
  NOT_FOUND: 'Запись не найдена.',
  HOMEWORK_ALREADY_REVIEWED: 'Задание уже проверено — новая версия не нужна.',
  HOMEWORK_AWAITING_REVIEW: 'Задание на проверке у преподавателя.',
  CONTENT_REQUIRED: 'Добавьте ответ — хотя бы пару слов.',
  RESCHEDULE_TOO_LATE: `Перенос можно запросить не позднее чем за ${RESCHEDULE_MIN_HOURS} часа до урока. Напишите менеджеру.`,
  RESCHEDULE_ALREADY_REQUESTED: 'Запрос на перенос этого урока уже отправлен.',
  REASON_REQUIRED: 'Опишите причину — минимум 10 символов.',
  DISPUTE_NOT_ALLOWED: 'Оспорить можно только списанный урок за последние 30 дней.',
  DISPUTE_ALREADY_OPEN: 'Обращение по этому уроку уже рассматривается.',
};
const fail = (code: string): R => ({ ok: false, code, message: TEXT[code] ?? 'Не удалось выполнить действие.' });

export function joinState(lesson: Pick<LessonCard, 'scheduledAt' | 'durationMinutes' | 'status' | 'meetLink'>, nowIso: string) {
  const start = new Date(lesson.scheduledAt).getTime();
  const now = new Date(nowIso).getTime();
  const opensAt = start - JOIN_OPENS_MIN * 60_000;
  const endsAt = start + lesson.durationMinutes * 60_000;
  const canJoin = lesson.status === 'SCHEDULED' && Boolean(lesson.meetLink) && now >= opensAt && now < endsAt;
  return { canJoin, opensAt: new Date(opensAt).toISOString(), live: now >= start && now < endsAt };
}

export function canRequestReschedule(lesson: LessonCard, state: StudentState): boolean {
  const delta = new Date(lesson.scheduledAt).getTime() - new Date(state.now).getTime();
  return lesson.status === 'SCHEDULED' && delta >= RESCHEDULE_MIN_HOURS * H;
}

/** Lessons with server-computed flags, as GET /student/lessons returns them. */
export function selectLessons(state: StudentState): LessonCard[] {
  return state.lessons.map((l) => ({
    ...l,
    canJoin: joinState(l, state.now).canJoin,
    canRequestReschedule: canRequestReschedule(l, state) && !state.rescheduleRequests.some((r) => r.lessonId === l.lessonId),
  }));
}

/** Client-side equivalent of GET /api/v1/student/dashboard. */
export function selectDashboard(state: StudentState): StudentDashboard {
  const next = selectLessons(state).find((l) => new Date(l.scheduledAt).getTime() + l.durationMinutes * 60_000 > new Date(state.now).getTime());
  const active = state.subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'FROZEN');
  const soonest = [...active].sort((a, b) => (a.validUntil ?? '').localeCompare(b.validUntil ?? ''))[0];
  const count = (s: HomeworkItem['status']) => state.homework.filter((h) => h.status === s).length;
  const skill = (s: string) => state.skills.filter((k) => k.status === s).length;
  return {
    generatedAt: state.now,
    nextLesson: next
      ? {
          lessonId: next.lessonId,
          scheduledAt: next.scheduledAt,
          durationMinutes: next.durationMinutes,
          teacherName: next.teacherName,
          subjectName: next.subjectName,
          meetLink: next.meetLink,
          canJoin: next.canJoin,
          status: next.status,
        }
      : null,
    homework: {
      notSubmitted: count('NOT_SUBMITTED'),
      submitted: count('SUBMITTED'),
      needsRevision: count('NEEDS_REVISION'),
      total: state.homework.length,
    },
    subscription: soonest
      ? {
          lessonsRemaining: active.reduce((sum, s) => sum + (s.lessonsRemaining ?? 0), 0),
          validUntil: soonest.validUntil,
          isFrozen: active.some((s) => s.isFrozen),
          frozenUntil: active.find((s) => s.isFrozen)?.frozenUntil ?? null,
        }
      : null,
    skillProgress: {
      familiarizing: skill('FAMILIARIZING'),
      practicing: skill('PRACTICING'),
      applying: skill('APPLYING'),
      notStudied: skill('NOT_STUDIED'),
    },
  };
}

function patchHomework(state: StudentState, id: string, patch: (h: HomeworkItem) => HomeworkItem): StudentState {
  return { ...state, homework: state.homework.map((h) => (h.homeworkId === id ? patch(h) : h)) };
}

export function executeStudent(state: StudentState, cmd: StudentCommand): R {
  switch (cmd.type) {
    case 'homework.saveDraft': {
      const h = state.homework.find((x) => x.homeworkId === cmd.homeworkId);
      if (!h) return fail('NOT_FOUND');
      if (h.status === 'REVIEWED') return fail('HOMEWORK_ALREADY_REVIEWED');
      return { ok: true, state: patchHomework(state, h.homeworkId, (x) => ({ ...x, draftContent: cmd.content })), message: 'Черновик сохранён' };
    }
    case 'homework.submit': {
      const h = state.homework.find((x) => x.homeworkId === cmd.homeworkId);
      if (!h) return fail('NOT_FOUND');
      if (h.status === 'REVIEWED') return fail('HOMEWORK_ALREADY_REVIEWED');
      if (h.status === 'SUBMITTED') return fail('HOMEWORK_AWAITING_REVIEW');
      if (cmd.content.trim().length < 2) return fail('CONTENT_REQUIRED');
      const version = {
        versionNumber: h.versions.length + 1,
        content: cmd.content.trim(),
        submittedAt: state.now,
        teacherComment: null,
        teacherStatus: null,
        attachments: [],
      };
      return {
        ok: true,
        state: patchHomework(state, h.homeworkId, (x) => ({
          ...x,
          status: 'SUBMITTED',
          isLate: x.dueAt !== null && x.dueAt < state.now,
          draftContent: null,
          versions: [...x.versions, version],
          latestVersion: version,
        })),
        message: `Отправлено преподавателю (версия ${version.versionNumber})`,
      };
    }
    case 'lesson.requestReschedule': {
      const l = state.lessons.find((x) => x.lessonId === cmd.lessonId);
      if (!l) return fail('NOT_FOUND');
      if (state.rescheduleRequests.some((r) => r.lessonId === l.lessonId)) return fail('RESCHEDULE_ALREADY_REQUESTED');
      if (!canRequestReschedule(l, state)) return fail('RESCHEDULE_TOO_LATE');
      if (cmd.comment.trim().length < 10) return fail('REASON_REQUIRED');
      return {
        ok: true,
        state: {
          ...state,
          rescheduleRequests: [
            ...state.rescheduleRequests,
            { lessonId: l.lessonId, createdAt: state.now, preferredDate: cmd.preferredDate, comment: cmd.comment.trim(), status: 'SENT' },
          ],
        },
        message: 'Запрос отправлен менеджеру. Урок остаётся в расписании до подтверждения.',
      };
    }
    case 'lesson.dispute': {
      const h = state.history.find((x) => x.lessonId === cmd.lessonId);
      if (!h) return fail('NOT_FOUND');
      if (state.disputes.includes(h.lessonId)) return fail('DISPUTE_ALREADY_OPEN');
      const age = new Date(state.now).getTime() - new Date(h.scheduledAt).getTime();
      if (!h.lessonDeducted || age > DISPUTE_WINDOW_HOURS * H) return fail('DISPUTE_NOT_ALLOWED');
      if (cmd.comment.trim().length < 10) return fail('REASON_REQUIRED');
      return {
        ok: true,
        state: {
          ...state,
          disputes: [...state.disputes, h.lessonId],
          history: state.history.map((x) => (x.lessonId === h.lessonId ? { ...x, canDispute: false } : x)),
        },
        message: 'Обращение передано менеджеру. Решение по списанию принимает руководитель.',
      };
    }
    case 'report.read':
      return {
        ok: true,
        state: { ...state, reports: state.reports.map((r) => (r.reportId === cmd.reportId ? { ...r, isNew: false } : r)) },
        message: 'Отчёт отмечен прочитанным',
      };
    case 'notification.read':
      return {
        ok: true,
        state: { ...state, notifications: state.notifications.map((n) => (n.notificationId === cmd.notificationId ? { ...n, isRead: true } : n)) },
        message: 'Уведомление прочитано',
      };
    case 'notification.readAll':
      return { ok: true, state: { ...state, notifications: state.notifications.map((n) => ({ ...n, isRead: true })) }, message: 'Все уведомления прочитаны' };
    case 'reports.exportPdf':
      return { ok: true, state: { ...state, pdfExport: 'PREPARING' }, message: 'Готовим PDF с образовательной историей…' };
    case 'reports.exportReady':
      return { ok: true, state: { ...state, pdfExport: 'READY' }, message: 'PDF готов к скачиванию' };
  }
}
