import { uid } from '../manager/seed';
import type { DecisionItem, DirectorState, Escalation, Period, StaffItem, UnresolvedItem } from './types';

const H = 3600_000;
const D = 24 * H;
const iso = (t: number) => new Date(t).toISOString();

/** The primary manager of the manager cabinet; her live metrics replace the seeded ones. */
export const PORTFOLIO_MANAGER_ID = uid(0, 1);

/**
 * Synthetic director data shaped like /api/v1/director/*. Names match the manager and
 * teacher cabinets so one person reads the same everywhere in the demo.
 */
export function createDirectorSeed(nowMs = Date.now()): DirectorState {
  const now = Math.floor(nowMs / 60000) * 60000;

  const decisions: DecisionItem[] = [
    { kind: 'DISTRIBUTION', id: uid(20, 1), requestedAt: iso(now - 3 * D), requestedBy: 'Кристина Делеу', studentId: uid(2, 3), studentName: 'Александра Ротару', amount: '2400.00', currency: 'MDL', ready: true, blockedBy: null },
    { kind: 'DISTRIBUTION', id: uid(20, 2), requestedAt: iso(now - 6 * H), requestedBy: 'Ион Русу', studentId: null, studentName: 'Давид Гросу', amount: '1800.00', currency: 'MDL', ready: false, blockedBy: 'Платёж ещё не подтверждён' },
    { kind: 'SCHEDULE_EXCEPTION', id: uid(20, 3), requestedAt: iso(now - 26 * H), requestedBy: 'Кристина Делеу', studentId: uid(2, 1), studentName: 'Даниэла Ботнару', amount: null, currency: null, ready: true, blockedBy: null },
    { kind: 'SCHEDULE_EXCEPTION', id: uid(20, 4), requestedAt: iso(now - 2 * H), requestedBy: 'Марина Ткачук', studentId: null, studentName: 'Лука Моцпан', amount: null, currency: null, ready: true, blockedBy: null },
    { kind: 'DISPUTE', id: uid(20, 5), requestedAt: iso(now - 4 * D), requestedBy: 'Кристина Делеу', studentId: uid(2, 5), studentName: 'Вероника Гуцан', amount: '300.00', currency: 'MDL', ready: true, blockedBy: null },
    { kind: 'TEMPORARY_ACCESS', id: uid(20, 6), requestedAt: iso(now - 30 * 60000), requestedBy: 'Ион Русу', studentId: null, studentName: 'Ана Чорбэ', amount: null, currency: null, ready: true, blockedBy: null },
    { kind: 'REFUND_REQUEST', id: uid(20, 7), requestedAt: iso(now - 5 * D), requestedBy: 'Марина Ткачук', studentId: null, studentName: 'Олег Балта', amount: '1200.00', currency: 'MDL', ready: false, blockedBy: 'Нет реквизитов перевода' },
    { kind: 'REFUND_REQUEST', id: uid(20, 8), requestedAt: iso(now - 20 * H), requestedBy: 'Кристина Делеу', studentId: uid(2, 8), studentName: 'Артём Сырбу', amount: '600.00', currency: 'MDL', ready: true, blockedBy: null },
  ];

  const escalation = (n: number, e: Partial<Escalation>): Escalation => ({
    escalationId: uid(21, n),
    taskId: uid(22, n),
    taskType: 'LEAD_FOLLOWUP',
    title: '',
    taskStatus: 'OPEN',
    state: 'OPEN',
    reason: 'ACCEPT_TIMEOUT',
    managerStatus: 'AVAILABLE',
    primaryManagerId: null,
    primaryManagerName: null,
    studentId: null,
    studentName: null,
    leadId: null,
    leadName: null,
    acceptDueAt: iso(now - H),
    escalatedAt: iso(now - 50 * 60000),
    acceptedAt: null,
    acceptedByName: null,
    ...e,
  });
  const escalations: Escalation[] = [
    escalation(1, { taskType: 'CHARGE_DISPUTE', title: 'Спорное списание за урок 24 ноября', reason: 'MANAGER_UNAVAILABLE', managerStatus: 'UNAVAILABLE', primaryManagerId: uid(0, 2), primaryManagerName: 'Ион Русу', studentName: 'Давид Гросу', acceptDueAt: iso(now - 3 * H), escalatedAt: iso(now - 3 * H) }),
    escalation(2, { title: 'Перезвонить по заявке с сайта', primaryManagerId: uid(0, 3), primaryManagerName: 'Марина Ткачук', leadName: 'Ева Ротарь', acceptDueAt: iso(now - 40 * 60000), escalatedAt: iso(now - 30 * 60000) }),
    escalation(3, { taskType: 'RENEWAL', title: 'Продление абонемента', reason: 'ACCEPT_TIMEOUT', state: 'ACCEPTED', primaryManagerId: PORTFOLIO_MANAGER_ID, primaryManagerName: 'Кристина Делеу', studentName: 'Максим Чебан', acceptDueAt: iso(now - D), escalatedAt: iso(now - D), acceptedAt: iso(now - 22 * H), acceptedByName: 'Кристина Делеу' }),
  ];

  const manager = (n: number, fullName: string, m: Record<string, unknown>): StaffItem => ({ kind: 'MANAGER', id: uid(0, n), fullName, active: true, deactivatedAt: null, metrics: m });
  const teacher = (n: number, fullName: string, m: Record<string, unknown>): StaffItem => ({ kind: 'TEACHER', id: uid(1, n), fullName, active: true, deactivatedAt: null, metrics: m });
  const staff: StaffItem[] = [
    manager(1, 'Кристина Делеу', { students: 12, leads: 11, openTasks: 9, openEscalations: 0, availability: 'AVAILABLE' }),
    manager(2, 'Ион Русу', { students: 18, leads: 6, openTasks: 14, openEscalations: 1, availability: 'UNAVAILABLE' }),
    manager(3, 'Марина Ткачук', { students: 9, leads: 15, openTasks: 7, openEscalations: 1, availability: 'AVAILABLE' }),
    teacher(1, 'Елена Морозан', { activeStudents: 9, lessonsNext7Days: 17, futureLessons: 41 }),
    teacher(2, 'Андрей Чобану', { activeStudents: 6, lessonsNext7Days: 11, futureLessons: 26 }),
    teacher(3, 'Мария Русу', { activeStudents: 11, lessonsNext7Days: 21, futureLessons: 52 }),
    teacher(4, 'Игорь Лупу', { activeStudents: 5, lessonsNext7Days: 7, futureLessons: 15 }),
    teacher(5, 'Ольга Попа', { activeStudents: 3, lessonsNext7Days: 4, futureLessons: 9 }),
    teacher(6, 'Наталья Гуцу', { activeStudents: 7, lessonsNext7Days: 13, futureLessons: 30 }),
  ];

  const payTeacher = (n: number, teacherName: string, accrued: string, paid: string, openAttempts = 0) => {
    const outstanding = (Number(accrued) - Number(paid)).toFixed(2);
    return { currency: 'MDL', accrued, paid, outstanding, teacherId: uid(1, n), teacherName, openAttempts };
  };
  const teachers = [
    payTeacher(3, 'Мария Русу', '14700.00', '8400.00', 1),
    payTeacher(1, 'Елена Морозан', '11900.00', '7000.00'),
    payTeacher(6, 'Наталья Гуцу', '9100.00', '6300.00', 1),
    payTeacher(2, 'Андрей Чобану', '7700.00', '7700.00'),
    payTeacher(4, 'Игорь Лупу', '4900.00', '3500.00'),
    payTeacher(5, 'Ольга Попа', '2800.00', '2800.00'),
  ].sort((a, b) => Number(b.outstanding) - Number(a.outstanding));
  const sum = (k: 'accrued' | 'paid' | 'outstanding') => teachers.reduce((a, t) => a + Number(t[k]), 0).toFixed(2);

  const monthStart = new Date(now);
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const prevStart = new Date(monthStart);
  prevStart.setUTCMonth(prevStart.getUTCMonth() - 1);
  const nextStart = new Date(monthStart);
  nextStart.setUTCMonth(nextStart.getUTCMonth() + 1);
  const currentPeriodId = uid(23, 2);

  const unresolvedItems: UnresolvedItem[] = [
    { kind: 'UNACCRUED_LESSON', id: uid(24, 1), at: iso(now - 2 * D), teacherName: 'Мария Русу', studentName: 'Максим Чебан', amount: '350.00', currency: 'MDL', detail: 'Урок подтверждён, начисление не создано' },
    { kind: 'UNACCRUED_LESSON', id: uid(24, 2), at: iso(now - D), teacherName: 'Елена Морозан', studentName: 'София Бужор', amount: '350.00', currency: 'MDL', detail: 'Урок подтверждён, начисление не создано' },
    { kind: 'DISPUTED_LESSON', id: uid(24, 3), at: iso(now - 4 * D), teacherName: 'Игорь Лупу', studentName: 'Вероника Гуцан', amount: '300.00', currency: 'MDL', detail: 'Итог урока оспорен' },
    { kind: 'OPEN_PAYOUT_ATTEMPT', id: uid(24, 4), at: iso(now - 3 * D), teacherName: 'Мария Русу', studentName: null, amount: '4200.00', currency: 'MDL', detail: 'Выплата ждёт сверки с банком' },
    { kind: 'OPEN_PAYOUT_ATTEMPT', id: uid(24, 5), at: iso(now - D), teacherName: 'Наталья Гуцу', studentName: null, amount: '2800.00', currency: 'MDL', detail: 'Выплата ждёт подтверждения' },
    { kind: 'DRAFT_LEDGER_ENTRY', id: uid(24, 6), at: iso(now - 6 * H), teacherName: null, studentName: 'Давид Гросу', amount: '1800.00', currency: 'MDL', detail: 'Черновик проводки по поступлению' },
  ];
  const counts = unresolvedItems.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {});

  const periods: Period[] = [
    { id: currentPeriodId, startsAt: iso(monthStart.getTime()), endsAt: iso(nextStart.getTime()), closedAt: null, finished: false, blockers: unresolvedItems.length, readyToClose: false },
    { id: uid(23, 1), startsAt: iso(prevStart.getTime()), endsAt: iso(monthStart.getTime()), closedAt: iso(monthStart.getTime() + 3 * D), finished: true, blockers: 0, readyToClose: false },
  ];

  return {
    me: { displayName: 'Анна Бордя' },
    now: iso(now),
    decisions,
    escalations,
    staff,
    payroll: {
      periodId: currentPeriodId,
      totals: [{ currency: 'MDL', accrued: sum('accrued'), paid: sum('paid'), outstanding: sum('outstanding'), pendingAccrual: '700.00' }],
      teachers,
    },
    unresolved: { periodId: currentPeriodId, counts, items: unresolvedItems },
    periods,
  };
}
