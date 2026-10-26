import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AccountContext, CriticalContext } from '../../core/http.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { DatabaseService } from '../../core/database/database.module.js';
import { object, string, uuid } from '../identity/input.js';
import { at, Decimal, money, operation } from './finance-common.js';
import { FinanceAccess } from './finance-access.service.js';
import { FinanceLedger } from './finance-ledger.service.js';

@Injectable()
export class PayrollService {
  constructor(
    private readonly access: FinanceAccess,
    private readonly ledger: FinanceLedger,
    private readonly db: DatabaseService,
  ) {}
  async accrue(ctx: CriticalContext, body: unknown) {
    const input = object(body, ['outcomeId', 'basis', 'exceptionAmount']);
    const staff = await this.access.staff(ctx);
    const outcomeId = uuid(input.outcomeId);
    const outcome = await ctx.tx.lessonActualOutcome.findUnique({ where: { id: outcomeId } });
    if (!outcome) return fail(domainError('NOT_FOUND', 404));
    const lesson = await ctx.tx.lessonOccurrence.findUniqueOrThrow({
      where: { id: outcome.lesson_occurrence_id },
    });
    const enrollment = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: lesson.enrollment_id },
    });
    await this.access.student(ctx, enrollment.student_id);
    if (lesson.status !== 'CONDUCTED') return fail(domainError('CONFIRMED_LESSON_REQUIRED', 422));
    const now = await at(ctx.tx);
    if (outcome.confirmed_at > now) return fail(domainError('CONFIRMED_LESSON_REQUIRED', 422));
    const period = await this.ledger.period(ctx.tx, now);
    const paid = await ctx.tx.$queryRaw<
      { ok: boolean }[]
    >`SELECT EXISTS(SELECT 1 FROM subscriptions s JOIN entitlement_grants g ON g.subscription_id=s.id WHERE s.enrollment_id=${enrollment.id}::uuid AND g.granted_at<=${outcome.actual_started_at} AND t03_paid_at(s.id,${outcome.actual_started_at})>=s.full_price) AS ok`;
    const exception = input.exceptionAmount !== undefined;
    if (!paid[0]!.ok && !exception)
      return fail(domainError('UNPAID_LESSON_REQUIRES_DIRECTOR_DECISION', 422));
    if (exception) await this.access.staff(ctx, true);
    const amount = exception
      ? input.exceptionAmount === '0' || input.exceptionAmount === '0.0000'
        ? new Decimal(0)
        : money(input.exceptionAmount)
      : outcome.rate_snapshot;
    const basis = string(input.basis, 5, 500);
    const accrual = await ctx.tx.teacherAccrual.create({
      data: {
        lesson_actual_outcome_id: outcome.id,
        teacher_id: outcome.actual_teacher_id,
        rate_snapshot: outcome.rate_snapshot,
        points_snapshot: outcome.points_snapshot,
        rate_basis: outcome.rate_basis,
        amount,
        currency: outcome.currency,
        basis,
        recognized_at: now,
        authorized_by_id: staff,
        exception_authorized_by_id: exception ? staff : null,
        financial_period_id: period,
        ...operation(ctx.operationId),
      },
    });
    const obligation = await ctx.tx.payrollObligation.create({
      data: {
        accrual_id: accrual.id,
        amount,
        currency: accrual.currency,
        recognized_at: now,
        ...operation(randomUUID()),
      },
    });
    let entryId: string | null = null;
    if (amount.gt(0)) {
      const entry = await this.ledger.event(ctx, {
        accrual_id: accrual.id,
        basis,
        ...operation(randomUUID()),
      });
      entryId = entry.id;
      await ctx.tx.payrollObligation.update({
        where: { id: obligation.id },
        data: { recognition_entry_id: entry.id },
      });
    }
    return { ...accrual, obligationId: obligation.id, ledgerEntryId: entryId };
  }
  private async obligation(ctx: CriticalContext, id: string) {
    await this.access.staff(ctx);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM payroll_obligations WHERE id=${id}::uuid FOR UPDATE`;
    const obligation = await ctx.tx.payrollObligation.findUnique({ where: { id } });
    if (!obligation) return fail(domainError('NOT_FOUND', 404));
    const accrual = await ctx.tx.teacherAccrual.findUniqueOrThrow({
      where: { id: obligation.accrual_id },
    });
    const outcome = await ctx.tx.lessonActualOutcome.findUniqueOrThrow({
      where: { id: accrual.lesson_actual_outcome_id },
    });
    const lesson = await ctx.tx.lessonOccurrence.findUniqueOrThrow({
      where: { id: outcome.lesson_occurrence_id },
    });
    const en = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: lesson.enrollment_id },
    });
    await this.access.student(ctx, en.student_id);
    return obligation;
  }
  async attempt(ctx: CriticalContext, body: unknown) {
    const input = object(body, ['obligationId', 'amount', 'provider', 'providerRequestId']);
    const obligation = await this.obligation(ctx, uuid(input.obligationId));
    const staff = await this.access.staff(ctx);
    if (!obligation.recognition_entry_id)
      return fail(domainError('PAYROLL_OBLIGATION_NOT_PUBLISHED', 422));
    const pending = await ctx.tx.payoutAttempt.findFirst({
      where: {
        obligation_id: obligation.id,
        OR: [
          { status: { in: ['PENDING', 'UNKNOWN'] } },
          { status: 'SUCCEEDED', t03_confirmedpayout_attempt_id: null },
        ],
      },
    });
    if (pending) return fail(domainError('PAYOUT_RECONCILIATION_REQUIRED', 409));
    const paid = await ctx.tx.$queryRaw<
      { paid: string }[]
    >`SELECT coalesce(sum(p.amount),0)::text AS paid FROM confirmed_payouts p JOIN payout_attempts a ON a.id=p.attempt_id WHERE a.obligation_id=${obligation.id}::uuid`;
    const amount = money(input.amount);
    if (amount.gt(new Decimal(obligation.amount).sub(paid[0]!.paid)))
      return fail(domainError('PAYOUT_EXCEEDS_OBLIGATION', 422));
    return ctx.tx.payoutAttempt.create({
      data: {
        obligation_id: obligation.id,
        amount,
        currency: obligation.currency,
        status: 'PENDING',
        provider: string(input.provider, 1, 100),
        provider_request_id: string(input.providerRequestId, 1, 200),
        attempted_by_id: staff,
        attempted_at: await at(ctx.tx),
        ...operation(ctx.operationId),
      },
    });
  }
  async confirm(ctx: CriticalContext, id: string, body: unknown) {
    const input = object(body, ['providerConfirmationId', 'amount']);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM payout_attempts WHERE id=${id}::uuid FOR UPDATE`;
    const attempt = await ctx.tx.payoutAttempt.findUnique({ where: { id } });
    if (!attempt) return fail(domainError('NOT_FOUND', 404));
    const obligation = await this.obligation(ctx, attempt.obligation_id);
    const staff = await this.access.staff(ctx);
    if (attempt.status !== 'PENDING')
      return fail(domainError('PAYOUT_RECONCILIATION_REQUIRED', 409));
    const paid = await ctx.tx.$queryRaw<
      { paid: string }[]
    >`SELECT coalesce(sum(p.amount),0)::text AS paid FROM confirmed_payouts p JOIN payout_attempts a ON a.id=p.attempt_id WHERE a.obligation_id=${obligation.id}::uuid`;
    const amount = input.amount === undefined ? attempt.amount : money(input.amount);
    if (amount.gt(attempt.amount) || amount.gt(new Decimal(obligation.amount).sub(paid[0]!.paid)))
      return fail(domainError('PAYOUT_EXCEEDS_OBLIGATION', 422));
    const now = await at(ctx.tx);
    await this.ledger.period(ctx.tx, now);
    await ctx.tx.payoutAttempt.update({ where: { id }, data: { status: 'SUCCEEDED' } });
    const payout = await ctx.tx.confirmedPayout.create({
      data: {
        attempt_id: id,
        amount,
        currency: attempt.currency,
        confirmed_at: now,
        confirmed_by_id: staff,
        provider: attempt.provider,
        provider_confirmation_id: string(input.providerConfirmationId, 1, 200),
        ...operation(ctx.operationId),
      },
    });
    const entry = await this.ledger.event(ctx, {
      payout_id: payout.id,
      basis: 'Authorized staff verified payout evidence',
      ...operation(randomUUID()),
    });
    return { ...payout, ledgerEntryId: entry.id };
  }
  async read(actor: AccountContext, id: string) {
    id = uuid(id);
    const teacher = await this.db.client.teacherAccount.findUnique({ where: { id } });
    if (
      !teacher ||
      (!actor.roles.includes('DIRECTOR') &&
        (!actor.roles.includes('TEACHER') || teacher.account_id !== actor.accountId))
    )
      return fail(domainError('FORBIDDEN', 403));
    const accruals = await this.db.client.teacherAccrual.findMany({
      where: { teacher_id: id },
      orderBy: { recognized_at: 'desc' },
      take: 100,
      select: {
        id: true,
        lesson_actual_outcome_id: true,
        rate_snapshot: true,
        points_snapshot: true,
        rate_basis: true,
        amount: true,
        currency: true,
        recognized_at: true,
      },
    });
    const obligations = await this.db.client.payrollObligation.findMany({
      where: { accrual_id: { in: accruals.map((a) => a.id) } },
      select: { id: true, accrual_id: true, amount: true, currency: true, recognized_at: true },
    });
    const payouts = await this.db.client.confirmedPayout.findMany({
      where: { attempt_ref: { obligation_id: { in: obligations.map((o) => o.id) } } },
      select: {
        id: true,
        amount: true,
        currency: true,
        confirmed_at: true,
        attempt_ref: { select: { obligation_id: true } },
      },
    });
    const result = accruals.map((accrual) => {
      const obligation = obligations.find((o) => o.accrual_id === accrual.id);
      return {
        ...accrual,
        obligation: obligation
          ? {
              id: obligation.id,
              amount: obligation.amount,
              currency: obligation.currency,
              recognized_at: obligation.recognized_at,
            }
          : null,
        payouts: payouts
          .filter((p) => p.attempt_ref.obligation_id === obligation?.id)
          .map(({ id, amount, currency, confirmed_at }) => ({
            id,
            amount,
            currency,
            confirmed_at,
          })),
      };
    });
    return { teacherId: id, items: result };
  }
}
