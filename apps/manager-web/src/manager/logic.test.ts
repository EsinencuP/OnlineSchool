import { describe, expect, it } from 'vitest';
import { canMoveLead, execute, selectDashboard } from './logic';
import { createSeed } from './seed';

const NOW = new Date('2026-11-24T12:00:00Z');

describe('manager command rules (mirror backend policy)', () => {
  it('requires a skip-trial reason to move IN_PROGRESS → AWAITING_PAYMENT', () => {
    const s = createSeed(NOW);
    const lead = s.leads.find((l) => l.stage === 'IN_PROGRESS')!;
    expect(canMoveLead(lead, 'AWAITING_PAYMENT')).toBe('SKIP_TRIAL_REASON_REQUIRED');
    const r = execute(s, { type: 'lead.transition', leadId: lead.leadId, to: 'AWAITING_PAYMENT', skipTrialReason: 'Продолжает обучение' });
    expect(r.ok && r.state.leads.find((l) => l.leadId === lead.leadId)?.stage).toBe('AWAITING_PAYMENT');
  });

  it('blocks TRIAL → AWAITING_PAYMENT until the trial was attended', () => {
    const s = createSeed(NOW);
    const pending = s.leads.find((l) => l.stage === 'TRIAL' && l.trial?.outcome === 'PENDING')!;
    const attended = s.leads.find((l) => l.stage === 'TRIAL' && l.trial?.outcome === 'ATTENDED')!;
    expect(execute(s, { type: 'lead.transition', leadId: pending.leadId, to: 'AWAITING_PAYMENT' })).toMatchObject({ ok: false, code: 'TRIAL_OUTCOME_REQUIRED' });
    expect(execute(s, { type: 'lead.transition', leadId: attended.leadId, to: 'AWAITING_PAYMENT' }).ok).toBe(true);
  });

  it('treats CONVERTED as terminal and only reopens LOST', () => {
    const s = createSeed(NOW);
    const converted = s.leads.find((l) => l.stage === 'CONVERTED')!;
    const lost = s.leads.find((l) => l.stage === 'LOST')!;
    expect(execute(s, { type: 'lead.lose', leadId: converted.leadId, reason: 'PRICE' })).toMatchObject({ ok: false, code: 'LEAD_TERMINAL' });
    expect(execute(s, { type: 'lead.reopen', leadId: converted.leadId })).toMatchObject({ ok: false });
    expect(execute(s, { type: 'lead.reopen', leadId: lost.leadId }).ok).toBe(true);
  });

  it('enforces freeze limits of 30 days per freeze and 60 per subscription', () => {
    const s = createSeed(NOW);
    const sub = s.subscriptions.find((x) => x.status === 'ACTIVE')!;
    expect(execute(s, { type: 'subscription.freeze', subscriptionId: sub.id, days: 31 })).toMatchObject({ ok: false, code: 'FREEZE_LIMIT_EXCEEDED' });
    const r = execute(s, { type: 'subscription.freeze', subscriptionId: sub.id, days: 30 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.students.find((x) => x.studentId === sub.studentId)?.status).toBe('FROZEN');
    const back = execute(r.state, { type: 'subscription.unfreeze', subscriptionId: sub.id });
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(execute(back.state, { type: 'subscription.freeze', subscriptionId: sub.id, days: 31 }).ok).toBe(false);
    expect(execute(back.state, { type: 'subscription.freeze', subscriptionId: sub.id, days: 30 }).ok).toBe(true);
  });

  it('lets the manager only send PENDING payments to the director', () => {
    const s = createSeed(NOW);
    const pending = s.payments.find((p) => p.status === 'PENDING')!;
    const r = execute(s, { type: 'payment.requestApproval', paymentId: pending.id });
    expect(r.ok && r.state.payments.find((p) => p.id === pending.id)?.status).toBe('AWAITING_APPROVAL');
    if (!r.ok) return;
    expect(execute(r.state, { type: 'payment.requestApproval', paymentId: pending.id })).toMatchObject({ ok: false, code: 'PAYMENT_NOT_PENDING' });
  });

  it('claims then resolves a task with a note and updates student counters', () => {
    const s = createSeed(NOW);
    const t = s.tasks.find((x) => x.status === 'OPEN' && x.studentId)!;
    expect(execute(s, { type: 'task.resolve', taskId: t.taskId, note: 'ok ok' })).toMatchObject({ ok: false, code: 'TASK_NOT_RESOLVABLE' });
    const claimed = execute(s, { type: 'task.claim', taskId: t.taskId });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(execute(claimed.state, { type: 'task.resolve', taskId: t.taskId, note: 'ok' })).toMatchObject({ ok: false, code: 'NOTE_TOO_SHORT' });
    const done = execute(claimed.state, { type: 'task.resolve', taskId: t.taskId, note: 'Созвонились, договорились' });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    const before = s.students.find((x) => x.studentId === t.studentId)!.openTasksCount;
    expect(done.state.students.find((x) => x.studentId === t.studentId)!.openTasksCount).toBe(before - 1);
  });

  it('builds the dashboard with per-currency decimal totals', () => {
    const s = createSeed(NOW);
    const d = selectDashboard(s);
    expect(d.pendingPayments.count).toBe(3);
    expect(d.pendingPayments.totalsByCurrency).toEqual([{ currency: 'MDL', amount: '7200.00' }]);
    expect(d.upcomingLessons.every((l) => l.startsAt >= s.now)).toBe(true);
    expect(d.overdueTasks.top.length).toBeLessThanOrEqual(5);
  });
});
