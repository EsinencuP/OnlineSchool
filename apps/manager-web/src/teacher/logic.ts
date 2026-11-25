import type { CommandResult } from '../shared/store';
import { RATE_TABLE } from './seed';
import type {
  AvailabilityWindow,
  Checkpoint,
  JournalItem,
  PayrollLine,
  PayrollTotal,
  ReportContent,
  RequestKind,
  SkillStatus,
  TeacherState,
} from './types';

/**
 * Pure command handlers mirroring /api/v1/teacher/* and the teacher regulations:
 *  - lesson outcome within 24 h of the planned end (rule 6.3, REG-T-11);
 *  - every 4 confirmed lessons → skills review, every 8 → educational report (CON-07);
 *  - no auto-promotion of skills, a step back needs a reason (9.2, 9.3);
 *  - booked slots change only through the manager; notice 48 h / 7 days / 14 days (REG-T-15..17);
 *  - rate = 200 MDL base + 5 MDL per point, ≤ 6 seniority + ≤ 4 student points (academy rules).
 */
export type TeacherCommand =
  | { type: 'lesson.report'; lessonId: string; result: 'CONDUCTED' | 'NOT_CONDUCTED'; studentNoShow: boolean; waited15: boolean; durationMin: number; note: string }
  | { type: 'homework.review'; deliveryId: string; result: 'ACCEPTED' | 'NEEDS_REVISION'; comment: string }
  | { type: 'homework.issue'; enrollmentId: string; title: string; description: string; dueAt: string | null }
  | { type: 'skill.assess'; enrollmentId: string; skillId: string; status: SkillStatus; publicComment: string; internalComment: string }
  | { type: 'goal.add'; enrollmentId: string; text: string; targetDate: string | null }
  | { type: 'goal.setStatus'; goalId: string; status: 'ACTIVE' | 'ACHIEVED' | 'PAUSED' }
  | { type: 'checkpoint.complete'; checkpointId: string }
  | { type: 'checkpoint.publish'; checkpointId: string; content: ReportContent }
  | { type: 'availability.add'; weekday: number; from: number; to: number }
  | { type: 'availability.remove'; windowId: string }
  | { type: 'request.create'; kind: RequestKind; lessonId: string | null; startsAt: string | null; reason: string; emergency: boolean }
  | { type: 'material.share'; fileId: string; studentId: string }
  | { type: 'material.unshare'; fileId: string; studentId: string }
  | { type: 'notification.read'; key: string }
  | { type: 'notification.readAll' };

type R = CommandResult<TeacherState>;
const H = 3600_000;
const D = 24 * H;
export const REPORT_DEADLINE_H = 24;
export const NOTICE: Record<RequestKind, { hours: number; label: string }> = {
  SINGLE_CANCEL: { hours: 48, label: '48 часов' },
  PERMANENT_CHANGE: { hours: 7 * 24, label: '7 календарных дней' },
  ABSENCE: { hours: 14 * 24, label: '14 календарных дней' },
};
const STAGE_ORDER: SkillStatus[] = ['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING'];

const TEXT: Record<string, string> = {
  NOT_FOUND: 'Запись не найдена.',
  LESSON_NOT_FINISHED: 'Результат можно внести после окончания урока.',
  OUTCOME_ALREADY_RECORDED: 'Результат уже внесён. Исправления — через менеджера.',
  NOTE_REQUIRED: 'Кратко запишите тему урока (минимум 3 символа).',
  WAIT_REQUIRED: 'Отметьте, что ожидали ученика 15 минут в Google Meet.',
  DURATION_INVALID: 'Длительность — от 1 до 90 минут.',
  REVIEW_NOT_ALLOWED: 'Проверить можно только сданную работу.',
  COMMENT_REQUIRED: 'Объясните, что доработать (минимум 3 символа).',
  TITLE_REQUIRED: 'Укажите название задания.',
  REASON_REQUIRED: 'Возврат на предыдущий этап требует публичного обоснования (9.3).',
  SAME_STATUS: 'Статус не изменился.',
  GOAL_TEXT_REQUIRED: 'Сформулируйте цель (минимум 5 символов).',
  CHECKPOINT_DONE: 'Контрольная точка уже закрыта.',
  REPORT_FIELDS_REQUIRED: 'Заполните достижения, зоны роста и рекомендации (по 10+ символов).',
  WRONG_CHECKPOINT_TYPE: 'Для этой контрольной точки нужен другой шаг.',
  WINDOW_INVALID: 'Интервал должен быть в пределах суток и заканчиваться позже начала.',
  WINDOW_OVERLAP: 'Интервал пересекается с уже заявленным.',
  WINDOW_HAS_LESSONS: 'В этом окне есть подтверждённые уроки — изменить их можно только через менеджера.',
  NOTICE_TOO_SHORT: 'Срок уведомления не соблюдён. Отметьте экстренный случай — менеджер рассмотрит его отдельно.',
  LESSON_REQUIRED: 'Выберите урок.',
  DATE_REQUIRED: 'Укажите дату.',
  MATERIAL_PENDING: 'Файл ещё проходит проверку хранилища.',
};
const fail = (code: string): R => ({ ok: false, code, message: TEXT[code] ?? 'Не удалось выполнить действие.' });

// ---------------------------------------------------------------- selectors

/** GET /teacher/journal: past lessons with their reporting state. */
export function selectJournal(state: TeacherState): JournalItem[] {
  const now = new Date(state.now).getTime();
  return state.lessons
    .filter((l) => new Date(l.endsAt).getTime() <= now && l.status !== 'CANCELLED')
    .map((l) => {
      const report = state.reports[l.lessonId];
      const deadline = new Date(l.endsAt).getTime() + REPORT_DEADLINE_H * H;
      return {
        lessonId: l.lessonId,
        startsAt: l.startsAt,
        endsAt: l.endsAt,
        state: report ? (report.result === 'CONDUCTED' ? 'CONDUCTED' : 'CANCELLED') : 'AWAITING_REPORT',
        kind: l.kind,
        studentId: l.studentId,
        studentName: l.studentName,
        subjectName: l.subjectName,
        reportDeadlineAt: new Date(deadline).toISOString(),
        overdue: !report && now > deadline,
        latestReportResult: report?.result ?? null,
      } satisfies JournalItem;
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

/** Seniority/student points and the resulting lesson rate (academy rules, CON-03). */
export function selectRate(state: TeacherState) {
  const seniority = Math.min(6, Math.floor(state.me.seniorityMonths / 2));
  const active = state.enrollments.length;
  const students = Math.min(4, Math.floor(active / 2));
  const points = seniority + students;
  const rate = RATE_TABLE.find((r) => points <= r.maxPoints)?.rate ?? '250.00';
  return { seniority, students, points, active, rate };
}

const cents = (v: string) => {
  const [i = '0', f = ''] = v.split('.');
  return BigInt(i) * 100n + BigInt((f + '00').slice(0, 2));
};
const money = (c: bigint) => `${c / 100n}.${(c % 100n).toString().padStart(2, '0')}`;

export function selectPayrollTotals(lines: PayrollLine[]): PayrollTotal {
  let accrued = 0n;
  let paid = 0n;
  let pending = 0n;
  for (const l of lines) {
    if (l.status === 'PENDING_ACCRUAL') pending += cents(l.amount);
    else accrued += cents(l.amount);
    paid += cents(l.paid);
  }
  return { currency: 'MDL', accrued: money(accrued), paid: money(paid), outstanding: money(accrued - paid), pendingAccrual: money(pending) };
}

export function lessonsToNextReview(confirmed: number) {
  return 4 - (confirmed % 4);
}

// ---------------------------------------------------------------- commands

export function executeTeacher(state: TeacherState, cmd: TeacherCommand): R {
  const now = new Date(state.now).getTime();
  switch (cmd.type) {
    case 'lesson.report': {
      const l = state.lessons.find((x) => x.lessonId === cmd.lessonId);
      if (!l) return fail('NOT_FOUND');
      if (new Date(l.endsAt).getTime() > now) return fail('LESSON_NOT_FINISHED');
      if (state.reports[l.lessonId]) return fail('OUTCOME_ALREADY_RECORDED');
      if (cmd.note.trim().length < 3) return fail('NOTE_REQUIRED');
      if (cmd.result === 'NOT_CONDUCTED' && cmd.studentNoShow && !cmd.waited15) return fail('WAIT_REQUIRED');
      if (cmd.result === 'CONDUCTED' && (cmd.durationMin < 1 || cmd.durationMin > 90)) return fail('DURATION_INVALID');

      const report = {
        reportId: `report-${l.lessonId}`,
        version: 1,
        result: cmd.result,
        studentNoShow: cmd.result === 'NOT_CONDUCTED' && cmd.studentNoShow,
        actualStartedAt: cmd.result === 'CONDUCTED' ? l.startsAt : null,
        durationMin: cmd.result === 'CONDUCTED' ? cmd.durationMin : null,
        note: cmd.note.trim(),
        reportedAt: state.now,
        current: true,
      } as const;
      let next: TeacherState = {
        ...state,
        reports: { ...state.reports, [l.lessonId]: report },
        lessons: state.lessons.map((x) =>
          x.lessonId === l.lessonId ? { ...x, outcomeRecorded: true, status: cmd.result === 'CONDUCTED' ? 'CONDUCTED' : x.status === 'SCHEDULED' ? 'CANCELLED' : x.status } : x,
        ),
      };
      let message = 'Результат урока сохранён';

      // Payable outcome: conducted lesson, or student no-show while the teacher was ready.
      const payable = cmd.result === 'CONDUCTED' || report.studentNoShow;
      if (payable && l.kind === 'REGULAR') {
        const { rate, points } = selectRate(state);
        next.payroll = {
          ...next.payroll,
          lines: [
            {
              outcomeId: `outcome-${l.lessonId}`,
              lessonStartedAt: l.startsAt,
              durationMin: cmd.durationMin,
              studentName: l.studentName,
              subjectName: l.subjectName,
              rate,
              points,
              rateBasis: report.studentNoShow ? 'Ученик не подключился, ожидание 15 мин — полная ставка' : `${points} очков → ${rate} лей, снимок на начало урока`,
              currency: 'MDL',
              amount: rate,
              paid: '0.00',
              status: 'PENDING_ACCRUAL',
              accruedAt: null,
              lastPaidAt: null,
            },
            ...next.payroll.lines,
          ],
        };
      }
      // Counter of confirmed lessons → checkpoints every 4 / 8 (CON-07).
      if (cmd.result === 'CONDUCTED' && l.kind === 'REGULAR') {
        const enr = next.enrollments.find((e) => e.studentId === l.studentId);
        if (enr) {
          const confirmed = enr.confirmedLessons + 1;
          next = { ...next, enrollments: next.enrollments.map((e) => (e === enr ? { ...e, confirmedLessons: confirmed } : e)) };
          if (confirmed % 4 === 0) {
            const type = confirmed % 8 === 0 ? 'LESSON_8' : 'LESSON_4';
            const cp: Checkpoint = {
              checkpointId: `cp-${enr.enrollmentId}-${confirmed}`,
              type,
              confirmedLessonCount: confirmed,
              triggeredAt: state.now,
              state: 'PENDING',
              completedAt: null,
              enrollmentId: enr.enrollmentId,
              studentId: enr.studentId,
              studentName: enr.studentName,
              subjectName: enr.subjectName,
            };
            next = { ...next, checkpoints: [cp, ...next.checkpoints] };
            message = type === 'LESSON_8' ? 'Урок подтверждён. Пора подготовить отчёт за 8 уроков' : 'Урок подтверждён. Пора пересмотреть навыки (4 урока)';
          }
        }
      }
      return { ok: true, state: next, message };
    }

    case 'homework.review': {
      const h = state.homework.find((x) => x.deliveryId === cmd.deliveryId);
      if (!h) return fail('NOT_FOUND');
      if (h.state !== 'AWAITING_REVIEW') return fail('REVIEW_NOT_ALLOWED');
      if (cmd.result === 'NEEDS_REVISION' && cmd.comment.trim().length < 3) return fail('COMMENT_REQUIRED');
      return {
        ok: true,
        state: {
          ...state,
          homework: state.homework.map((x) =>
            x.deliveryId === h.deliveryId
              ? {
                  ...x,
                  state: cmd.result === 'ACCEPTED' ? 'REVIEWED' : 'NEEDS_REVISION',
                  reviews: [...x.reviews, { reviewId: `rv-${x.deliveryId}-${x.reviews.length + 1}`, result: cmd.result, comment: cmd.comment.trim() || null, reviewedAt: state.now }],
                }
              : x,
          ),
        },
        message: cmd.result === 'ACCEPTED' ? 'Работа принята, ученик получит уведомление' : 'Отправлено на доработку',
      };
    }

    case 'homework.issue': {
      const e = state.enrollments.find((x) => x.enrollmentId === cmd.enrollmentId);
      if (!e) return fail('NOT_FOUND');
      if (cmd.title.trim().length < 3) return fail('TITLE_REQUIRED');
      return {
        ok: true,
        state: {
          ...state,
          homework: [
            {
              deliveryId: `hw-${state.homework.length + 1}`,
              enrollmentId: e.enrollmentId,
              title: cmd.title.trim(),
              description: cmd.description.trim(),
              issuedAt: state.now,
              dueAt: cmd.dueAt,
              state: 'NOT_SUBMITTED',
              studentId: e.studentId,
              studentName: e.studentName,
              subjectName: e.subjectName,
              submissionCount: 0,
              latestSubmittedAt: null,
              isLate: false,
              answer: null,
              reviews: [],
            },
            ...state.homework,
          ],
        },
        message: `Задание выдано: ${e.studentName}`,
      };
    }

    case 'skill.assess': {
      const list = state.skills[cmd.enrollmentId];
      const skill = list?.find((s) => s.skillId === cmd.skillId);
      if (!list || !skill) return fail('NOT_FOUND');
      if (skill.status === cmd.status && cmd.publicComment === (skill.publicComment ?? '') && cmd.internalComment === (skill.internalComment ?? '')) return fail('SAME_STATUS');
      const back = STAGE_ORDER.indexOf(cmd.status) < STAGE_ORDER.indexOf(skill.status);
      if (back && cmd.publicComment.trim().length < 3) return fail('REASON_REQUIRED');
      return {
        ok: true,
        state: {
          ...state,
          skills: {
            ...state.skills,
            [cmd.enrollmentId]: list.map((s) =>
              s.skillId === skill.skillId
                ? { ...s, status: cmd.status, assessedAt: state.now, assessedByName: state.me.displayName, publicComment: cmd.publicComment.trim() || null, internalComment: cmd.internalComment.trim() || null }
                : s,
            ),
          },
        },
        message: 'Оценка навыка сохранена, изменение записано в журнал',
      };
    }

    case 'goal.add': {
      if (cmd.text.trim().length < 5) return fail('GOAL_TEXT_REQUIRED');
      return {
        ok: true,
        state: {
          ...state,
          goals: [
            { goalId: `goal-${state.goals.length + 1}`, enrollmentId: cmd.enrollmentId, text: cmd.text.trim(), targetDate: cmd.targetDate, status: 'ACTIVE', skillId: null, createdAt: state.now, updatedAt: state.now },
            ...state.goals,
          ],
        },
        message: 'Цель добавлена',
      };
    }

    case 'goal.setStatus': {
      const g = state.goals.find((x) => x.goalId === cmd.goalId);
      if (!g) return fail('NOT_FOUND');
      return {
        ok: true,
        state: { ...state, goals: state.goals.map((x) => (x.goalId === g.goalId ? { ...x, status: cmd.status, updatedAt: state.now } : x)) },
        message: cmd.status === 'ACHIEVED' ? 'Цель достигнута — ученик получит поздравление' : 'Статус цели обновлён',
      };
    }

    case 'checkpoint.complete': {
      const c = state.checkpoints.find((x) => x.checkpointId === cmd.checkpointId);
      if (!c) return fail('NOT_FOUND');
      if (c.state === 'COMPLETED') return fail('CHECKPOINT_DONE');
      if (c.type !== 'LESSON_4') return fail('WRONG_CHECKPOINT_TYPE');
      return { ok: true, state: completeCheckpoint(state, c.checkpointId), message: 'Пересмотр навыков завершён' };
    }

    case 'checkpoint.publish': {
      const c = state.checkpoints.find((x) => x.checkpointId === cmd.checkpointId);
      if (!c) return fail('NOT_FOUND');
      if (c.state === 'COMPLETED') return fail('CHECKPOINT_DONE');
      if (c.type !== 'LESSON_8') return fail('WRONG_CHECKPOINT_TYPE');
      const { achievements, growthAreas, recommendations } = cmd.content;
      if ([achievements, growthAreas, recommendations].some((v) => v.trim().length < 10)) return fail('REPORT_FIELDS_REQUIRED');
      return {
        ok: true,
        state: { ...completeCheckpoint(state, c.checkpointId), publishedReports: { ...state.publishedReports, [c.checkpointId]: cmd.content } },
        message: 'Отчёт опубликован в кабинете ученика',
      };
    }

    case 'availability.add': {
      if (cmd.from < 0 || cmd.to > 24 || cmd.from >= cmd.to) return fail('WINDOW_INVALID');
      if (state.availability.some((w) => w.weekday === cmd.weekday && cmd.from < w.to && w.from < cmd.to)) return fail('WINDOW_OVERLAP');
      const w: AvailabilityWindow = { id: `win-${cmd.weekday}-${cmd.from}-${cmd.to}`, weekday: cmd.weekday, from: cmd.from, to: cmd.to };
      return { ok: true, state: { ...state, availability: [...state.availability, w] }, message: 'Окно доступности добавлено' };
    }

    case 'availability.remove': {
      const w = state.availability.find((x) => x.id === cmd.windowId);
      if (!w) return fail('NOT_FOUND');
      const booked = state.lessons.some((l) => {
        const s = new Date(l.startsAt);
        return l.status === 'SCHEDULED' && s.getTime() > now && (s.getDay() + 6) % 7 === w.weekday && s.getHours() >= w.from && s.getHours() < w.to;
      });
      if (booked) return fail('WINDOW_HAS_LESSONS');
      return { ok: true, state: { ...state, availability: state.availability.filter((x) => x.id !== w.id) }, message: 'Окно удалено' };
    }

    case 'request.create': {
      if (cmd.reason.trim().length < 5) return fail('NOTE_REQUIRED');
      const lesson = cmd.lessonId ? state.lessons.find((l) => l.lessonId === cmd.lessonId) : null;
      if (cmd.kind === 'SINGLE_CANCEL' && !lesson) return fail('LESSON_REQUIRED');
      const startsAt = lesson?.startsAt ?? cmd.startsAt;
      if (!startsAt) return fail('DATE_REQUIRED');
      const notice = new Date(startsAt).getTime() - now;
      if (notice < NOTICE[cmd.kind].hours * H && !cmd.emergency) return fail('NOTICE_TOO_SHORT');
      return {
        ok: true,
        state: {
          ...state,
          requests: [
            {
              requestId: `req-${state.requests.length + 1}`,
              kind: cmd.kind,
              emergency: cmd.emergency,
              status: 'PENDING',
              createdAt: state.now,
              reason: cmd.reason.trim(),
              requestedStartAt: cmd.kind === 'SINGLE_CANCEL' ? null : startsAt,
              requestedEndAt: null,
              lessonId: lesson?.lessonId ?? null,
              slotId: null,
              lessonStartsAt: lesson?.startsAt ?? null,
              studentName: lesson?.studentName ?? 'Все ученики',
              subjectName: 'Математика',
            },
            ...state.requests,
          ],
        },
        message: 'Запрос отправлен менеджеру. До согласования действует прежнее расписание.',
      };
    }

    case 'material.share':
    case 'material.unshare': {
      const m = state.materials.find((x) => x.fileId === cmd.fileId);
      if (!m) return fail('NOT_FOUND');
      if (m.status !== 'VERIFIED') return fail('MATERIAL_PENDING');
      const grantedTo = cmd.type === 'material.share' ? [...new Set([...m.grantedTo, cmd.studentId])] : m.grantedTo.filter((s) => s !== cmd.studentId);
      return {
        ok: true,
        state: { ...state, materials: state.materials.map((x) => (x.fileId === m.fileId ? { ...x, grantedTo, activeGrants: grantedTo.length } : x)) },
        message: cmd.type === 'material.share' ? 'Материал открыт ученику' : 'Доступ к материалу закрыт',
      };
    }

    case 'notification.read':
      return { ok: true, state: { ...state, notifications: state.notifications.map((n) => (n.key === cmd.key ? { ...n, read: true } : n)) }, message: 'Прочитано' };
    case 'notification.readAll':
      return { ok: true, state: { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) }, message: 'Все уведомления прочитаны' };
  }
}

function completeCheckpoint(state: TeacherState, id: string): TeacherState {
  return { ...state, checkpoints: state.checkpoints.map((c) => (c.checkpointId === id ? { ...c, state: 'COMPLETED', completedAt: state.now } : c)) };
}

export const daysUntil = (iso: string, nowIso: string) => Math.ceil((new Date(iso).getTime() - new Date(nowIso).getTime()) / D);
