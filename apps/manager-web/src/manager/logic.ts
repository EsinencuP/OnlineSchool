import type { CommandResult as SharedResult } from '../shared/store';
import type {
  Lead,
  LeadLostReason,
  LeadStage,
  LessonView,
  ManagerDashboard,
  ManagerState,
  ManagerTask,
} from './types';

/**
 * Pure command handlers that mirror the backend manager endpoints' rules
 * (apps/api/src/modules/manager). They return the same error codes so the UI
 * can show the same messages when the mock is replaced with HTTP calls.
 */
export type CommandResult = SharedResult<ManagerState>;

const fail = (code: string, message: string): CommandResult => ({ ok: false, code, message });

export type Command =
  | { type: 'lead.claim'; leadId: string }
  | { type: 'lead.transition'; leadId: string; to: 'IN_PROGRESS' | 'AWAITING_PAYMENT'; skipTrialReason?: string }
  | { type: 'lead.trial'; leadId: string; startsAt: string; teacherId: string }
  | { type: 'lead.lose'; leadId: string; reason: LeadLostReason; comment?: string }
  | { type: 'lead.reopen'; leadId: string }
  | { type: 'lead.create'; contactName: string; guardianName?: string; subjectName: string; phone: string; source: Lead['source']; comment?: string }
  | { type: 'task.claim'; taskId: string }
  | { type: 'task.resolve'; taskId: string; note: string }
  | { type: 'payment.requestApproval'; paymentId: string }
  /**
   * Director decision (POST /director/payments/{id}/confirm|reject). It lives in this store
   * because the demo keeps payment state here; the manager UI never dispatches it.
   */
  | { type: 'payment.decide'; paymentId: string; decision: 'CONFIRM' | 'REJECT'; reason?: string }
  | { type: 'subscription.freeze'; subscriptionId: string; days: number }
  | { type: 'subscription.unfreeze'; subscriptionId: string }
  | { type: 'lesson.cancel'; lessonId: string; reason: string };

export const FREEZE_MAX_DAYS = 30;
export const FREEZE_MAX_TOTAL_DAYS = 60;

const ALLOWED: Record<LeadStage, LeadStage[]> = {
  NEW: ['IN_PROGRESS', 'LOST'],
  IN_PROGRESS: ['TRIAL', 'AWAITING_PAYMENT', 'LOST'],
  TRIAL: ['IN_PROGRESS', 'AWAITING_PAYMENT', 'LOST'],
  AWAITING_PAYMENT: ['TRIAL', 'LOST'],
  CONVERTED: [],
  LOST: ['IN_PROGRESS'],
};

/** Same matrix as backend `leadTransition` in leads/policy.ts. */
export function canMoveLead(lead: Lead, to: LeadStage, skipReason?: string): string | null {
  if (lead.stage === 'CONVERTED') return 'LEAD_TERMINAL';
  if (!ALLOWED[lead.stage].includes(to)) return 'INVALID_STAGE_TRANSITION';
  const outcome = lead.trial?.outcome;
  if (lead.stage === 'TRIAL' && to === 'AWAITING_PAYMENT' && outcome !== 'ATTENDED')
    return 'TRIAL_OUTCOME_REQUIRED';
  if (lead.stage === 'TRIAL' && to === 'IN_PROGRESS' && !['NO_SHOW', 'CANCELLED'].includes(outcome ?? ''))
    return 'TRIAL_OUTCOME_REQUIRED';
  if (lead.stage === 'IN_PROGRESS' && to === 'AWAITING_PAYMENT' && !skipReason?.trim())
    return 'SKIP_TRIAL_REASON_REQUIRED';
  return null;
}

const ERROR_TEXT: Record<string, string> = {
  LEAD_TERMINAL: 'Заявка уже закрыта — изменить стадию нельзя.',
  INVALID_STAGE_TRANSITION: 'Такой переход между стадиями не разрешён.',
  TRIAL_OUTCOME_REQUIRED: 'Сначала нужен итог пробного урока от преподавателя.',
  SKIP_TRIAL_REASON_REQUIRED: 'Укажите причину, почему заявка идёт к оплате без пробного урока.',
  TASK_NOT_CLAIMABLE: 'Задачу уже взяли в работу или закрыли.',
  TASK_NOT_RESOLVABLE: 'Закрыть можно только задачу в работе.',
  NOTE_TOO_SHORT: 'Опишите результат — минимум 3 символа.',
  PAYMENT_NOT_PENDING: 'На подтверждение можно отправить только зарегистрированный платёж.',
  FREEZE_LIMIT_EXCEEDED: `Заморозка: не больше ${FREEZE_MAX_DAYS} дней за раз и ${FREEZE_MAX_TOTAL_DAYS} дней на абонемент.`,
  SUBSCRIPTION_NOT_ACTIVE: 'Заморозить можно только активный абонемент.',
  SUBSCRIPTION_NOT_FROZEN: 'Абонемент не заморожен.',
  SLOT_IN_PAST: 'Время пробного урока уже прошло.',
  LESSON_NOT_CANCELLABLE: 'Отменить можно только запланированный урок.',
  NOT_FOUND: 'Запись не найдена.',
};

export const errorText = (code: string) => ERROR_TEXT[code] ?? 'Не удалось выполнить действие.';

const H = 3600_000;

function patchLead(state: ManagerState, leadId: string, to: LeadStage, extra: Partial<Lead> = {}): ManagerState {
  return {
    ...state,
    leads: state.leads.map((l) =>
      l.leadId === leadId
        ? {
            ...l,
            ...extra,
            stage: to,
            stageChangedAt: state.now,
            version: l.version + 1,
            history: [...l.history, { from: l.stage, to, at: state.now, byManager: true }],
          }
        : l,
    ),
  };
}

export function execute(state: ManagerState, cmd: Command): CommandResult {
  switch (cmd.type) {
    case 'lead.claim': {
      const lead = state.leads.find((l) => l.leadId === cmd.leadId);
      if (!lead) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      if (lead.stage !== 'NEW') return fail('INVALID_STAGE_TRANSITION', errorText('INVALID_STAGE_TRANSITION'));
      return { ok: true, state: patchLead(state, lead.leadId, 'IN_PROGRESS'), message: `Заявка «${lead.contactName}» взята в работу` };
    }
    case 'lead.transition': {
      const lead = state.leads.find((l) => l.leadId === cmd.leadId);
      if (!lead) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      const code = canMoveLead(lead, cmd.to, cmd.skipTrialReason);
      if (code) return fail(code, errorText(code));
      return {
        ok: true,
        state: patchLead(state, lead.leadId, cmd.to),
        message: cmd.to === 'AWAITING_PAYMENT' ? 'Заявка переведена в «Ждём оплату»' : 'Заявка возвращена в работу',
      };
    }
    case 'lead.trial': {
      const lead = state.leads.find((l) => l.leadId === cmd.leadId);
      const teacher = state.teachers.find((t) => t.teacherId === cmd.teacherId);
      if (!lead || !teacher) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      const code = lead.stage === 'NEW' ? null : canMoveLead(lead, 'TRIAL');
      if (code) return fail(code, errorText(code));
      if (cmd.startsAt <= state.now) return fail('SLOT_IN_PAST', errorText('SLOT_IN_PAST'));
      const lessonId = `trial-${lead.leadId}-${lead.version + 1}`;
      const endsAt = new Date(new Date(cmd.startsAt).getTime() + H).toISOString();
      const next = patchLead(state, lead.leadId, 'TRIAL', {
        trialAt: cmd.startsAt,
        nextActionAt: endsAt,
        isOverdue: false,
        trial: {
          lessonId,
          startsAt: cmd.startsAt,
          endsAt,
          teacherName: teacher.name,
          meetLink: null,
          outcome: 'PENDING',
          feedbackStatus: 'PENDING',
          feedbackSummary: null,
        },
      });
      const trialLesson: LessonView = {
          kind: 'TRIAL',
          lessonId,
          studentId: lead.leadId,
          studentName: lead.contactName,
          subjectName: lead.subjectName,
          teacherId: teacher.teacherId,
          teacherName: teacher.name,
          startsAt: cmd.startsAt,
          endsAt,
          status: 'SCHEDULED',
          meetLink: null,
          subscriptionId: null,
          chargedLessons: 0,
          pendingChangeId: null,
          requiresApproval: false,
          trialBrief: {
            leadId: lead.leadId,
            audience: lead.audience,
            ageYears: lead.ageYears,
            grade: lead.grade,
            level: lead.level,
            subjectName: lead.subjectName,
          },
        };
      next.lessons = [...next.lessons, trialLesson].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      return { ok: true, state: next, message: `Пробный урок назначен: ${teacher.name}` };
    }
    case 'lead.lose': {
      const lead = state.leads.find((l) => l.leadId === cmd.leadId);
      if (!lead) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      const code = canMoveLead(lead, 'LOST');
      if (code) return fail(code, errorText(code));
      return {
        ok: true,
        state: patchLead(state, lead.leadId, 'LOST', {
          lostReason: cmd.reason,
          lostComment: cmd.comment ?? null,
          nextActionAt: null,
          isOverdue: false,
        }),
        message: 'Заявка закрыта без оплаты',
      };
    }
    case 'lead.reopen': {
      const lead = state.leads.find((l) => l.leadId === cmd.leadId);
      if (!lead) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      if (lead.stage !== 'LOST') return fail('INVALID_STAGE_TRANSITION', errorText('INVALID_STAGE_TRANSITION'));
      return {
        ok: true,
        state: patchLead(state, lead.leadId, 'IN_PROGRESS', { lostReason: null, lostComment: null }),
        message: 'Заявка снова в работе',
      };
    }
    case 'lead.create': {
      const n = state.leads.length + 1;
      const lead: Lead = {
        leadId: `new-lead-${n}`,
        stage: 'NEW',
        audience: cmd.guardianName ? 'CHILD' : 'ADULT',
        contactName: cmd.contactName.trim(),
        subjectName: cmd.subjectName,
        grade: null,
        maskedPhone: `${cmd.phone.slice(0, 7)} ••• ${cmd.phone.slice(-3)}`,
        source: cmd.source,
        createdAt: state.now,
        stageChangedAt: state.now,
        trialAt: null,
        nextActionAt: new Date(new Date(state.now).getTime() + H).toISOString(),
        isOverdue: false,
        version: 1,
        guardianName: cmd.guardianName?.trim() || null,
        phone: cmd.phone,
        email: null,
        ageYears: null,
        level: null,
        comment: cmd.comment?.trim() || null,
        studentId: null,
        subjectId: null,
        lostReason: null,
        lostComment: null,
        trial: null,
        history: [{ from: null, to: 'NEW', at: state.now, byManager: true }],
        openTasks: [],
      };
      return { ok: true, state: { ...state, leads: [lead, ...state.leads] }, message: 'Заявка создана' };
    }
    case 'task.claim': {
      const t = state.tasks.find((x) => x.taskId === cmd.taskId);
      if (!t) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      if (t.status !== 'OPEN') return fail('TASK_NOT_CLAIMABLE', errorText('TASK_NOT_CLAIMABLE'));
      return { ok: true, state: patchTask(state, t, { status: 'IN_PROGRESS' }), message: 'Задача взята в работу' };
    }
    case 'task.resolve': {
      const t = state.tasks.find((x) => x.taskId === cmd.taskId);
      if (!t) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      if (t.status !== 'IN_PROGRESS') return fail('TASK_NOT_RESOLVABLE', errorText('TASK_NOT_RESOLVABLE'));
      if (cmd.note.trim().length < 3) return fail('NOTE_TOO_SHORT', errorText('NOTE_TOO_SHORT'));
      return { ok: true, state: patchTask(state, t, { status: 'RESOLVED', isOverdue: false }), message: 'Задача закрыта' };
    }
    case 'payment.requestApproval': {
      const p = state.payments.find((x) => x.id === cmd.paymentId);
      if (!p) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      if (p.status !== 'PENDING') return fail('PAYMENT_NOT_PENDING', errorText('PAYMENT_NOT_PENDING'));
      return {
        ok: true,
        state: {
          ...state,
          payments: state.payments.map((x) => (x.id === p.id ? { ...x, status: 'AWAITING_APPROVAL' } : x)),
        },
        message: 'Платёж отправлен директору на подтверждение',
      };
    }
    case 'payment.decide': {
      const p = state.payments.find((x) => x.id === cmd.paymentId);
      if (!p) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      if (p.status !== 'AWAITING_APPROVAL') return fail('PAYMENT_NOT_AWAITING_APPROVAL', 'Платёж уже не ждёт решения директора.');
      const reason = cmd.reason?.trim() ?? '';
      if (cmd.decision === 'REJECT' && (reason.length < 3 || reason.length > 500))
        return fail('REASON_REQUIRED', 'Укажите причину — от 3 до 500 символов, её увидит менеджер.');
      const status = cmd.decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED';
      return {
        ok: true,
        state: {
          ...state,
          payments: state.payments.map((x) =>
            x.id === p.id ? { ...x, status, rejectionReason: status === 'REJECTED' ? reason : null } : x,
          ),
        },
        message: status === 'CONFIRMED' ? 'Оплата подтверждена' : 'Оплата отклонена, менеджер увидит причину',
      };
    }
    case 'subscription.freeze': {
      const s = state.subscriptions.find((x) => x.id === cmd.subscriptionId);
      if (!s) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      if (s.status !== 'ACTIVE') return fail('SUBSCRIPTION_NOT_ACTIVE', errorText('SUBSCRIPTION_NOT_ACTIVE'));
      if (cmd.days < 1 || cmd.days > FREEZE_MAX_DAYS || s.freezeDaysUsed + cmd.days > FREEZE_MAX_TOTAL_DAYS)
        return fail('FREEZE_LIMIT_EXCEEDED', errorText('FREEZE_LIMIT_EXCEEDED'));
      const until = new Date(new Date(state.now).getTime() + cmd.days * 24 * H).toISOString();
      const endsAt = new Date(new Date(s.endsAt).getTime() + cmd.days * 24 * H).toISOString();
      return {
        ok: true,
        state: withStudentStatus(
          {
            ...state,
            subscriptions: state.subscriptions.map((x) =>
              x.id === s.id ? { ...x, status: 'FROZEN', frozenUntil: until, endsAt, freezeDaysUsed: x.freezeDaysUsed + cmd.days } : x,
            ),
          },
          s.studentId,
          'FROZEN',
          endsAt,
        ),
        message: `Абонемент заморожен на ${cmd.days} дн.`,
      };
    }
    case 'subscription.unfreeze': {
      const s = state.subscriptions.find((x) => x.id === cmd.subscriptionId);
      if (!s) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      if (s.status !== 'FROZEN') return fail('SUBSCRIPTION_NOT_FROZEN', errorText('SUBSCRIPTION_NOT_FROZEN'));
      return {
        ok: true,
        state: withStudentStatus(
          {
            ...state,
            subscriptions: state.subscriptions.map((x) => (x.id === s.id ? { ...x, status: 'ACTIVE', frozenUntil: null } : x)),
          },
          s.studentId,
          'ACTIVE',
          s.endsAt,
        ),
        message: 'Абонемент разморожен',
      };
    }
    case 'lesson.cancel': {
      const l = state.lessons.find((x) => x.lessonId === cmd.lessonId);
      if (!l) return fail('NOT_FOUND', errorText('NOT_FOUND'));
      if (l.status !== 'SCHEDULED') return fail('LESSON_NOT_CANCELLABLE', errorText('LESSON_NOT_CANCELLABLE'));
      return {
        ok: true,
        state: { ...state, lessons: state.lessons.map((x) => (x.lessonId === l.lessonId ? { ...x, status: 'CANCELLED' } : x)) },
        message: 'Урок отменён, ученик получит уведомление',
      };
    }
  }
}

function patchTask(state: ManagerState, t: ManagerTask, patch: Partial<ManagerTask>): ManagerState {
  const tasks = state.tasks.map((x) => (x.taskId === t.taskId ? { ...x, ...patch, version: x.version + 1 } : x));
  const open = (x: ManagerTask) => x.status === 'OPEN' || x.status === 'IN_PROGRESS';
  return {
    ...state,
    tasks,
    students: state.students.map((s) => {
      const own = tasks.filter((x) => x.studentId === s.studentId && open(x));
      return { ...s, openTasksCount: own.length, overdueTasksCount: own.filter((x) => x.isOverdue).length };
    }),
    leads: state.leads.map((l) => ({
      ...l,
      openTasks: l.openTasks.filter((b) => tasks.some((x) => x.taskId === b.taskId && open(x))),
    })),
  };
}

function withStudentStatus(state: ManagerState, studentId: string, status: 'ACTIVE' | 'FROZEN', endsAt: string): ManagerState {
  const card = state.cards[studentId];
  return {
    ...state,
    students: state.students.map((s) =>
      s.studentId === studentId
        ? { ...s, status, activeSubscription: s.activeSubscription && { ...s.activeSubscription, endsAt } }
        : s,
    ),
    cards: card
      ? { ...state.cards, [studentId]: { ...card, status, subscription: card.subscription && { ...card.subscription, endsAt } } }
      : state.cards,
  };
}

/**
 * Client-side equivalent of GET /api/v1/manager/dashboard
 * (lessonsHorizonHours=48, expiringDays=7).
 */
export function selectDashboard(state: ManagerState, horizonHours = 48, expiringDays = 7): ManagerDashboard {
  const now = new Date(state.now).getTime();
  const todayKey = state.now.slice(0, 10);
  const openTasks = state.tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  const overdue = openTasks.filter((t) => t.isOverdue).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const pending = state.payments.filter((p) => p.status === 'PENDING' || p.status === 'AWAITING_APPROVAL');
  const totals = new Map<string, bigint>();
  for (const p of pending) {
    const [i = '0', f = ''] = p.amount.split('.');
    const cents = BigInt(i) * 100n + BigInt((f + '00').slice(0, 2));
    totals.set(p.currency, (totals.get(p.currency) ?? 0n) + cents);
  }
  const counts = { NEW: 0, IN_PROGRESS: 0, TRIAL: 0, AWAITING_PAYMENT: 0 };
  for (const l of state.leads) if (l.stage in counts) counts[l.stage as keyof typeof counts] += 1;
  const created30 = state.leads.filter((l) => now - new Date(l.createdAt).getTime() < 30 * 24 * H);
  const converted30 = created30.filter((l) => l.stage === 'CONVERTED').length;
  const critical = overdue.filter((t) => t.type === 'CHARGE_DISPUTE' || t.type === 'LEAD_FOLLOWUP');

  return {
    generatedAt: state.now,
    leads: {
      countsByStage: counts,
      createdToday: state.leads.filter((l) => l.createdAt.slice(0, 10) === todayKey).length,
      trialsToday: state.leads.filter((l) => l.trialAt?.slice(0, 10) === todayKey).length,
      overdueFollowups: state.leads.filter((l) => l.isOverdue && l.stage !== 'LOST' && l.stage !== 'CONVERTED').length,
      conversion30dBp: created30.length ? Math.round((converted30 / created30.length) * 10000) : 0,
    },
    students: {
      active: state.students.filter((s) => s.status === 'ACTIVE').length,
      frozen: state.students.filter((s) => s.status === 'FROZEN').length,
      leads: state.leads.filter((l) => l.stage !== 'CONVERTED' && l.stage !== 'LOST').length,
    },
    upcomingLessons: state.lessons
      .filter((l) => l.status === 'SCHEDULED')
      .filter((l) => {
        const t = new Date(l.startsAt).getTime();
        return t >= now && t <= now + horizonHours * H;
      })
      .map((l) => ({
        lessonId: l.lessonId,
        studentId: l.studentId,
        studentName: l.studentName,
        startsAt: l.startsAt,
        teacherName: l.teacherName,
        hasMeetLink: Boolean(l.meetLink),
      })),
    overdueTasks: {
      count: overdue.length,
      top: overdue.slice(0, 5).map((t) => ({ taskId: t.taskId, type: t.type, studentName: t.studentName, dueAt: t.dueAt })),
    },
    expiringSubscriptions: state.subscriptions
      .filter((s) => s.status === 'ACTIVE')
      .filter((s) => {
        const t = new Date(s.endsAt).getTime();
        return t >= now && t <= now + expiringDays * 24 * H;
      })
      .sort((a, b) => a.endsAt.localeCompare(b.endsAt))
      .map((s) => ({
        subscriptionId: s.id,
        studentId: s.studentId,
        studentName: state.students.find((x) => x.studentId === s.studentId)?.fullName ?? '—',
        endsAt: s.endsAt,
        remainingLessons: s.remainingLessons,
      })),
    pendingPayments: {
      count: pending.length,
      totalsByCurrency: [...totals].map(([currency, cents]) => ({
        currency,
        amount: `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`,
      })),
    },
    priority: {
      primary: critical[0] ? { taskId: critical[0].taskId, title: critical[0].studentName } : null,
      criticalCount: critical.length,
      queueAction: 'TASK_QUEUE',
      sourceAsOf: state.now,
    },
  };
}
