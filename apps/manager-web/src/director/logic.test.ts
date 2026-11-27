import { describe, expect, it } from 'vitest';
import { execute as managerExecute } from '../manager/logic';
import { createSeed } from '../manager/seed';
import { ageDays, allDecisions, execute, liveStaff, managerMetrics, paymentDecisions } from './logic';
import { createDirectorSeed, PORTFOLIO_MANAGER_ID } from './seed';

const NOW = new Date('2026-11-24T12:00:00Z');

describe('director decisions (mirror /api/v1/director rules)', () => {
  it('approves only ready decisions and explains the blocker', () => {
    const s = createDirectorSeed(NOW.getTime());
    const blocked = s.decisions.find((d) => !d.ready && d.kind !== 'PAYMENT')!;
    const ready = s.decisions.find((d) => d.ready && d.kind === 'DISTRIBUTION')!;
    expect(execute(s, { type: 'decision.approve', kind: blocked.kind as 'DISTRIBUTION', id: blocked.id })).toMatchObject({ ok: false, code: 'DECISION_NOT_READY' });
    const r = execute(s, { type: 'decision.approve', kind: 'DISTRIBUTION', id: ready.id });
    expect(r.ok && r.state.decisions.some((d) => d.id === ready.id)).toBe(false);
  });

  it('declines only request-type decisions and requires a 3–500 char reason', () => {
    const s = createDirectorSeed(NOW.getTime());
    const refund = s.decisions.find((d) => d.kind === 'REFUND_REQUEST')!;
    const dispute = s.decisions.find((d) => d.kind === 'DISPUTE')!;
    expect(execute(s, { type: 'decision.decline', kind: 'REFUND_REQUEST', id: refund.id, reason: ' x ' })).toMatchObject({ ok: false, code: 'REASON_REQUIRED' });
    expect(execute(s, { type: 'decision.decline', kind: 'DISPUTE', id: dispute.id, reason: 'Не согласен' })).toMatchObject({ ok: false, code: 'DECLINE_NOT_SUPPORTED' });
    expect(execute(s, { type: 'decision.decline', kind: 'REFUND_REQUEST', id: refund.id, reason: 'Нет оснований' }).ok).toBe(true);
  });

  it('accepts an escalation once', () => {
    const s = createDirectorSeed(NOW.getTime());
    const open = s.escalations.find((e) => e.state === 'OPEN')!;
    const r = execute(s, { type: 'escalation.accept', escalationId: open.escalationId });
    expect(r.ok && r.state.escalations.find((e) => e.escalationId === open.escalationId)?.acceptedByName).toBe(s.me.displayName);
    if (r.ok) expect(execute(r.state, { type: 'escalation.accept', escalationId: open.escalationId })).toMatchObject({ ok: false, code: 'ESCALATION_NOT_OPEN' });
  });
});

describe('cross-cabinet consistency', () => {
  it('shows payments the manager sent for approval as PAYMENT decisions, and removes them once decided', () => {
    const manager = createSeed(NOW);
    const director = createDirectorSeed(NOW.getTime());
    const waiting = manager.payments.filter((p) => p.status === 'AWAITING_APPROVAL');
    expect(paymentDecisions(manager)).toHaveLength(waiting.length);
    expect(allDecisions(director, manager)).toHaveLength(waiting.length + director.decisions.length);

    const id = waiting[0]!.id;
    expect(managerExecute(manager, { type: 'payment.decide', paymentId: id, decision: 'REJECT', reason: '' })).toMatchObject({ ok: false, code: 'REASON_REQUIRED' });
    const r = managerExecute(manager, { type: 'payment.decide', paymentId: id, decision: 'CONFIRM' });
    expect(r.ok && r.state.payments.find((p) => p.id === id)?.status).toBe('CONFIRMED');
    if (r.ok) expect(paymentDecisions(r.state).some((d) => d.id === id)).toBe(false);
  });

  it('computes the portfolio manager metrics from the manager cabinet state', () => {
    const manager = createSeed(NOW);
    const director = createDirectorSeed(NOW.getTime());
    const m = managerMetrics(liveStaff(director, manager).find((s) => s.id === PORTFOLIO_MANAGER_ID)!);
    expect(m.openTasks).toBe(manager.tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length);
    expect(m.leads).toBe(manager.leads.filter((l) => l.stage !== 'CONVERTED' && l.stage !== 'LOST').length);
  });

  it('keeps payroll totals equal to the sum of teacher rows', () => {
    const s = createDirectorSeed(NOW.getTime());
    const total = s.payroll.totals[0]!;
    const sum = (k: 'accrued' | 'paid' | 'outstanding') => s.payroll.teachers.reduce((a, t) => a + Number(t[k]), 0).toFixed(2);
    expect([total.accrued, total.paid, total.outstanding]).toEqual([sum('accrued'), sum('paid'), sum('outstanding')]);
    expect(Number(total.outstanding)).toBe(Number(total.accrued) - Number(total.paid));
  });

  it('counts whole days of waiting', () => {
    expect(ageDays('2026-11-21T12:00:00Z', NOW.toISOString())).toBe(3);
    expect(ageDays('2026-11-24T11:00:00Z', NOW.toISOString())).toBe(0);
  });
});
