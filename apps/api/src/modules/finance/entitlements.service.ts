import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { domainError, fail } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { object, string, uuid } from '../identity/input.js';
import { at, count, operation } from './finance-common.js';
import { FinanceAccess } from './finance-access.service.js';
import { FinanceLedger } from './finance-ledger.service.js';

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly access: FinanceAccess,
    private readonly ledger: FinanceLedger,
  ) {}
  async remaining(ctx: CriticalContext, id: string): Promise<number> {
    const rows = await ctx.tx.$queryRaw<
      { remaining: number }[]
    >`SELECT (g.quantity+coalesce((SELECT sum(delta_quantity) FROM entitlement_adjustments WHERE grant_id=g.id),0)-coalesce((SELECT sum(quantity) FROM entitlement_consumptions WHERE grant_id=g.id AND cancelled_at IS NULL),0))::int AS remaining FROM entitlement_grants g WHERE g.id=${id}::uuid`;
    return rows[0]!.remaining;
  }
  async consume(ctx: CriticalContext, body: unknown) {
    const input = object(body, ['grantId', 'studentId', 'lessonId', 'reason']);
    const grantId = uuid(input.grantId),
      studentId = uuid(input.studentId),
      lessonId = uuid(input.lessonId);
    const staff = await this.access.staff(ctx);
    await this.access.student(ctx, studentId);
    await ctx.tx.$queryRaw`SELECT id FROM entitlement_grants WHERE id=${grantId}::uuid FOR UPDATE`;
    const grant = await ctx.tx.entitlementGrant.findUnique({ where: { id: grantId } });
    if (!grant) return fail(domainError('NOT_FOUND', 404));
    const { sub, enrollment } = await this.access.subscription(ctx, grant.subscription_id);
    if (enrollment.student_id !== studentId) return fail(domainError('FORBIDDEN', 403));
    await ctx.tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${lessonId}::uuid FOR UPDATE`;
    const lesson = await ctx.tx.lessonOccurrence.findUnique({ where: { id: lessonId } });
    const outcome = await ctx.tx.lessonActualOutcome.findUnique({
      where: { lesson_occurrence_id: lessonId },
    });
    const now = await at(ctx.tx);
    if (!lesson || lesson.enrollment_id !== sub.enrollment_id)
      return fail(domainError('LESSON_SUBSCRIPTION_MISMATCH', 422));
    if (lesson.status !== 'CONDUCTED' || !outcome || outcome.confirmed_at > now)
      return fail(domainError('CONFIRMED_LESSON_REQUIRED', 422));
    await this.ledger.period(ctx.tx, lesson.scheduled_at);
    if ((await this.remaining(ctx, grantId)) < 1)
      return fail(domainError('INSUFFICIENT_PAID_RIGHTS', 422));
    const [balance] = await ctx.tx.$queryRaw<{ balance: string }[]>`
      SELECT coalesce(sum(g.quantity
        +coalesce((SELECT sum(a.delta_quantity) FROM entitlement_adjustments a WHERE a.grant_id=g.id AND a.effective_at<=${now}),0)
        -coalesce((SELECT sum(c.quantity) FROM entitlement_consumptions c WHERE c.grant_id=g.id AND c.consumed_at<=${now}
          AND (c.cancelled_at IS NULL OR c.cancelled_at>${now})),0)),0)::numeric::text AS balance
      FROM entitlement_grants g WHERE g.subscription_id=${sub.id}::uuid AND g.granted_at<=${now}`;
    if (!balance) return fail(domainError('ENTITLEMENT_BALANCE_UNAVAILABLE', 503));
    const before = new Prisma.Decimal(balance.balance),
      after = before.minus(1);
    if (after.lt(0)) return fail(domainError('INSUFFICIENT_PAID_RIGHTS', 422));
    let consumed;
    try {
      consumed = await ctx.tx.entitlementConsumption.create({
        data: {
          grant_id: grantId,
          subscription_id: sub.id,
          lesson_occurrence_id: lessonId,
          quantity: 1,
          basis: 'CONFIRMED_LESSON',
          reason:
            input.reason === undefined
              ? 'Confirmed conducted lesson'
              : string(input.reason, 5, 500),
          authorized_by_id: staff,
          consumed_at: now,
          ...operation(ctx.operationId),
        },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const cause = (
          error.meta as
            | {
                driverAdapterError?: {
                  cause?: { originalCode?: string; originalMessage?: string };
                };
              }
            | undefined
        )?.driverAdapterError?.cause;
        // Prisma's pg adapter omits the constraint name for PL/pgSQL RAISE.
        if (
          JSON.stringify(error.meta).includes('ck_entitlement_nonnegative') ||
          (cause?.originalCode === '23514' && cause.originalMessage === 'Insufficient paid rights')
        )
          return fail(domainError('INSUFFICIENT_PAID_RIGHTS', 422));
      }
      return Promise.reject(error);
    }
    const entry = await this.ledger.event(
      ctx,
      {
        consumption_id: consumed.id,
        basis: 'Revenue recognized for confirmed paid lesson',
        ...operation(randomUUID()),
      },
      { before, after },
    );
    return {
      ...consumed,
      remaining_count: await this.remaining(ctx, grantId),
      ledgerEntryId: entry.id,
    };
  }
  async adjust(ctx: CriticalContext, body: unknown) {
    const input = object(body, [
      'grantId',
      'originalConsumptionId',
      'kind',
      'deltaQuantity',
      'reason',
    ]);
    const staff = await this.access.staff(ctx, true);
    const grantId = uuid(input.grantId);
    await ctx.tx.$queryRaw`SELECT id FROM entitlement_grants WHERE id=${grantId}::uuid FOR UPDATE`;
    const grant = await ctx.tx.entitlementGrant.findUnique({ where: { id: grantId } });
    if (!grant) return fail(domainError('NOT_FOUND', 404));
    await this.access.subscription(ctx, grant.subscription_id);
    const reason = string(input.reason, 5, 500);
    const now = await at(ctx.tx);
    const periodId = await this.ledger.period(ctx.tx, now);
    const originalId =
      input.originalConsumptionId === undefined ? null : uuid(input.originalConsumptionId);
    const original = originalId
      ? await ctx.tx.entitlementConsumption.findUnique({ where: { id: originalId } })
      : null;
    if (originalId && (!original || original.grant_id !== grantId))
      return fail(domainError('ADJUSTMENT_SOURCE_MISMATCH', 422));
    if (!['GRANT_DELTA', 'CONSUMPTION_CANCELLATION'].includes(input.kind as string))
      return fail(domainError('INVALID_ADJUSTMENT_KIND', 422));
    let delta = 0;
    if (input.kind === 'GRANT_DELTA') {
      delta = count(input.deltaQuantity, -10000, 10000);
      if (!delta || (delta > 0 && !original))
        return fail(domainError('ADJUSTMENT_SOURCE_REQUIRED', 422));
      if ((await this.remaining(ctx, grantId)) + delta < 0)
        return fail(domainError('INSUFFICIENT_PAID_RIGHTS', 422));
    } else {
      if (
        !original ||
        original.cancelled_at ||
        (input.deltaQuantity !== undefined && input.deltaQuantity !== 0)
      )
        return fail(domainError('ACTIVE_CONSUMPTION_REQUIRED', 422));
      const lesson = await ctx.tx.lessonOccurrence.findUniqueOrThrow({
        where: { id: original.lesson_occurrence_id },
      });
      await this.ledger.period(ctx.tx, lesson.scheduled_at);
    }
    const adjustment = await ctx.tx.entitlementAdjustment.create({
      data: {
        grant_id: grantId,
        original_consumption_id: originalId,
        kind: input.kind as 'GRANT_DELTA' | 'CONSUMPTION_CANCELLATION',
        delta_quantity: delta,
        author_id: staff,
        reason,
        effective_at: now,
        financial_period_id: periodId,
        ...operation(ctx.operationId),
      },
    });
    if (input.kind === 'CONSUMPTION_CANCELLATION' && original) {
      await ctx.tx.entitlementConsumption.update({
        where: { id: original.id },
        data: { cancelled_at: now, cancellation_adjustment_id: adjustment.id },
      });
      await this.ledger.reverseConsumption(ctx, original.id, reason);
    }
    return { ...adjustment, remaining_count: await this.remaining(ctx, grantId) };
  }
}
