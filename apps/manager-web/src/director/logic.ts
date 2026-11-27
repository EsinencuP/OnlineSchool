import type { ManagerState } from '../manager/types';
import type { CommandResult as SharedResult } from '../shared/store';
import type { Tone } from '../shared/ui';
import { PORTFOLIO_MANAGER_ID } from './seed';
import type { DecisionItem, DecisionKind, DirectorState, ManagerMetrics, StaffItem, TeacherMetrics, UnresolvedKind } from './types';

/**
 * Pure command handlers mirroring /api/v1/director/* rules:
 * - a decision executes only when `ready` (blockedBy explains why not);
 * - decline needs a reason of 3–500 chars and exists only for request-type decisions;
 * - an escalation is accepted once.
 * Payment confirm/reject lives in the manager store, which owns payment state in this demo.
 */
export type CommandResult = SharedResult<DirectorState>;

export type Command =
  | { type: 'decision.approve'; kind: Exclude<DecisionKind, 'PAYMENT'>; id: string }
  | { type: 'decision.decline'; kind: Exclude<DecisionKind, 'PAYMENT'>; id: string; reason: string }
  | { type: 'escalation.accept'; escalationId: string };

const fail = (code: string, message: string): CommandResult => ({ ok: false, code, message });

/** Request-type decisions have a decline endpoint (/director/requests/{id}/decline, refund decide). */
export const DECLINABLE: ReadonlySet<DecisionKind> = new Set(['PAYMENT', 'SCHEDULE_EXCEPTION', 'TEMPORARY_ACCESS', 'REFUND_REQUEST']);

export const decisionKind: Record<DecisionKind, { label: string; short: string; tone: Tone; approve: string }> = {
  PAYMENT: { label: 'Подтверждение оплаты', short: 'Оплаты', tone: 'blue', approve: 'Подтвердить' },
  DISTRIBUTION: { label: 'Распределение оплаты', short: 'Распределения', tone: 'teal', approve: 'Одобрить' },
  SCHEDULE_EXCEPTION: { label: 'Исключение в расписании', short: 'Расписание', tone: 'violet', approve: 'Одобрить' },
  DISPUTE: { label: 'Спорное списание', short: 'Споры', tone: 'coral', approve: 'Одобрить' },
  TEMPORARY_ACCESS: { label: 'Временный доступ', short: 'Доступ', tone: 'neutral', approve: 'Выдать' },
  REFUND_REQUEST: { label: 'Возврат средств', short: 'Возвраты', tone: 'yellow', approve: 'Одобрить' },
};
export const DECISION_KINDS = Object.keys(decisionKind) as DecisionKind[];

export const unresolvedKind: Record<UnresolvedKind, string> = {
  UNACCRUED_LESSON: 'Урок без начисления',
  DISPUTED_LESSON: 'Оспоренный урок',
  OPEN_PAYOUT_ATTEMPT: 'Выплата без сверки',
  DRAFT_LEDGER_ENTRY: 'Черновик проводки',
};

export const availability: Record<ManagerMetrics['availability'], { label: string; tone: Tone }> = {
  AVAILABLE: { label: 'На связи', tone: 'teal' },
  UNAVAILABLE: { label: 'Недоступен', tone: 'coral' },
  OFF_SHIFT: { label: 'Не в смене', tone: 'neutral' },
};

export function execute(state: DirectorState, cmd: Command): CommandResult {
  switch (cmd.type) {
    case 'decision.approve':
    case 'decision.decline': {
      const d = state.decisions.find((x) => x.kind === cmd.kind && x.id === cmd.id);
      if (!d) return fail('NOT_FOUND', 'Решение уже принято или не найдено.');
      if (cmd.type === 'decision.decline') {
        if (!DECLINABLE.has(d.kind)) return fail('DECLINE_NOT_SUPPORTED', 'Это решение можно только одобрить.');
        const reason = cmd.reason.trim();
        if (reason.length < 3 || reason.length > 500) return fail('REASON_REQUIRED', 'Укажите причину — от 3 до 500 символов, её увидит менеджер.');
      } else if (!d.ready) {
        return fail('DECISION_NOT_READY', d.blockedBy ? `Пока нельзя: ${d.blockedBy.toLowerCase()}.` : 'Решение пока нельзя выполнить.');
      }
      return {
        ok: true,
        state: { ...state, decisions: state.decisions.filter((x) => x !== d) },
        message: cmd.type === 'decision.approve' ? `${decisionKind[d.kind].label}: одобрено` : `${decisionKind[d.kind].label}: отклонено`,
      };
    }
    case 'escalation.accept': {
      const e = state.escalations.find((x) => x.escalationId === cmd.escalationId);
      if (!e) return fail('NOT_FOUND', 'Эскалация не найдена.');
      if (e.state !== 'OPEN') return fail('ESCALATION_NOT_OPEN', 'Эскалацию уже приняли.');
      return {
        ok: true,
        state: {
          ...state,
          escalations: state.escalations.map((x) =>
            x === e ? { ...x, state: 'ACCEPTED', acceptedAt: state.now, acceptedByName: state.me.displayName } : x,
          ),
        },
        message: 'Задача принята вами',
      };
    }
  }
}

/** PAYMENT decisions = payments the manager sent for approval (GET /director/decisions, kind=PAYMENT). */
export function paymentDecisions(manager: ManagerState): DecisionItem[] {
  return manager.payments
    .filter((p) => p.status === 'AWAITING_APPROVAL')
    .map((p) => ({
      kind: 'PAYMENT',
      id: p.id,
      requestedAt: p.receivedAt,
      requestedBy: manager.me.displayName,
      studentId: p.studentId,
      studentName: p.studentName,
      amount: p.amount,
      currency: p.currency,
      ready: true,
      blockedBy: null,
    }));
}

/** Oldest first, like the backend queue. */
export const allDecisions = (state: DirectorState, manager: ManagerState): DecisionItem[] =>
  [...paymentDecisions(manager), ...state.decisions].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));

export const managerMetrics = (s: StaffItem) => s.metrics as unknown as ManagerMetrics;
export const teacherMetrics = (s: StaffItem) => s.metrics as unknown as TeacherMetrics;

/**
 * Staff list with the portfolio manager's metrics computed from the manager cabinet's live
 * state, so both cabinets show the same numbers after any action.
 */
export function liveStaff(state: DirectorState, manager: ManagerState): StaffItem[] {
  const openEsc = (id: string) => state.escalations.filter((e) => e.state === 'OPEN' && e.primaryManagerId === id).length;
  return state.staff.map((s) => {
    if (s.kind !== 'MANAGER') return s;
    const base = managerMetrics(s);
    if (s.id !== PORTFOLIO_MANAGER_ID) return { ...s, metrics: { ...base, openEscalations: openEsc(s.id) } };
    const m: ManagerMetrics = {
      students: manager.students.filter((x) => x.status !== 'LEAD' && x.status !== 'ARCHIVED').length,
      leads: manager.leads.filter((l) => l.stage !== 'CONVERTED' && l.stage !== 'LOST').length,
      openTasks: manager.tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
      openEscalations: openEsc(s.id),
      availability: base.availability,
    };
    return { ...s, metrics: { ...m } };
  });
}

/** Whole days since `iso` (0 for less than a day). */
export const ageDays = (iso: string, now: string) => Math.max(0, Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / (24 * 3600_000)));

/** Decimal-string sum for a single currency (display only; ledger maths stays on the server). */
export const sumAmounts = (amounts: (string | null)[]) => amounts.reduce((a, x) => a + (x ? Number(x) : 0), 0).toFixed(2);
