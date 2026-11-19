import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PaymentAllocationCorrection, Prisma } from '@online-school/db';
import { ok } from '@online-school/shared';
import { domainError, fail, unwrap } from '../../../core/errors/domain-error.js';
import type { AccountContext, CriticalContext } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { object, string, uuid } from '../../identity/input.js';
import { FinanceAccess } from '../finance-access.service.js';
import { at, money } from '../finance-common.js';
import { allocationCorrectionFactsSql } from './allocation-correction-facts.sql.js';
import type { AllocationCorrectionFactsDto } from './allocation-corrections.dto.js';

export function allocationCorrectionView(row: PaymentAllocationCorrection) {
  return {
    id: row.id,
    sourceDistributionId: row.source_distribution_id,
    targetSubscriptionId: row.target_subscription_id,
    status: row.status,
    amount: row.amount.toFixed(4),
    reason: row.reason,
    proposedById: row.proposed_by_id,
    proposedAt: row.proposed_at.toISOString(),
    decidedById: row.decided_by_id,
    decidedAt: row.decided_at?.toISOString() ?? null,
    decisionReason: row.decision_reason,
  };
}

type Facts = {
  payment_id: string;
  subscription_id: string;
  entry_id: string;
  period_id: string;
  currency: string;
  amount: Prisma.Decimal;
  receipt_amount: Prisma.Decimal;
  receipt_unallocated: Prisma.Decimal;
  source_advance_balance: Prisma.Decimal;
  target_available: Prisma.Decimal | null;
  granted_lessons: number;
  used_lessons: number;
  started_lessons: number;
  closed_at: Date | null;
  source_reversed: boolean;
  refund_history: boolean;
  open_current_period: boolean;
};

@Injectable()
export class AllocationCorrectionsService {
  constructor(
    private readonly access: FinanceAccess,
    private readonly tx: TransactionService,
  ) {}

  async propose(ctx: CriticalContext, id: string, body: unknown) {
    if (!ctx.actor.roles.includes('MANAGER')) return fail(domainError('FORBIDDEN', 403));
    const proposal = object(body, ['amount', 'targetSubscriptionId', 'reason']);
    const amount = money(proposal.amount);
    const reason = string(proposal.reason, 5, 500);
    const staffId = await this.access.staff(ctx);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM payment_distributions WHERE id=${id}::uuid FOR UPDATE`;
    const { source, target } = await this.access.allocationCorrectionScope(
      ctx,
      id,
      proposal.targetSubscriptionId === undefined ? null : uuid(proposal.targetSubscriptionId),
    );
    if (!source.approved_at) return fail(domainError('PUBLISHED_SOURCE_REQUIRED', 422));
    if (amount.gt(source.amount)) return fail(domainError('CORRECTION_EXCEEDS_ALLOCATION', 422));
    if (target && (target.id === source.subscription_id || target.currency !== source.currency))
      return fail(domainError('INVALID_CORRECTION_TARGET', 422));
    if (
      await ctx.tx.paymentAllocationCorrection.findFirst({
        where: { source_distribution_id: id, status: { in: ['PENDING', 'MANUAL_REVIEW'] } },
        select: { id: true },
      })
    )
      return fail(domainError('ALLOCATION_CORRECTION_ALREADY_OPEN', 409));
    const now = await at(ctx.tx);
    const facts = await this.facts(ctx, id, target?.id ?? null, amount, now);
    const row = await ctx.tx.paymentAllocationCorrection.create({
      data: {
        source_distribution_id: id,
        target_subscription_id: target?.id ?? null,
        amount,
        reason,
        proposed_by_id: staffId,
        proposed_at: now,
        source_operation_id: ctx.operationId,
      },
    });
    return { ...allocationCorrectionView(row), facts };
  }

  async view(actor: AccountContext, id: string) {
    return unwrap(
      await this.tx.runReadOnly(async (tx) => {
        const ctx = this.readContext(actor, tx);
        const row = await tx.paymentAllocationCorrection.findUnique({ where: { id: uuid(id) } });
        if (!row) return fail(domainError('NOT_FOUND', 404));
        await this.access.allocationCorrectionScope(
          ctx,
          row.source_distribution_id,
          row.target_subscription_id,
        );
        const facts = await this.facts(
          ctx,
          row.source_distribution_id,
          row.target_subscription_id,
          row.amount,
          await at(tx),
        );
        return ok({ ...allocationCorrectionView(row), facts });
      }),
    );
  }

  async queue(actor: AccountContext, after?: string) {
    return unwrap(
      await this.tx.runReadOnly(async (tx) => {
        await this.director(this.readContext(actor, tx));
        const rows = await tx.paymentAllocationCorrection.findMany({
          where: {
            status: { in: ['PENDING', 'MANUAL_REVIEW'] },
            ...(after ? { id: { gt: uuid(after) } } : {}),
          },
          orderBy: { id: 'asc' },
          take: 51,
        });
        const page = rows.slice(0, 50);
        return ok({
          items: page.map(allocationCorrectionView),
          nextCursor: rows.length > 50 ? page.at(-1)!.id : null,
        });
      }),
    );
  }

  async review(ctx: CriticalContext, id: string, body: unknown) {
    const staffId = await this.director(ctx);
    const review = object(body, ['decision', 'reason']);
    const { decision } = review;
    if (decision !== 'REJECTED' && decision !== 'MANUAL_REVIEW')
      return fail(domainError('INVALID_CORRECTION_DECISION', 422));
    const reason = string(review.reason, 5, 500);
    id = uuid(id);
    await ctx.tx
      .$queryRaw`SELECT id FROM payment_allocation_corrections WHERE id=${id}::uuid FOR UPDATE`;
    const row = await ctx.tx.paymentAllocationCorrection.findUnique({ where: { id } });
    if (!row) return fail(domainError('NOT_FOUND', 404));
    if (row.status !== 'PENDING')
      return fail(domainError('ALLOCATION_CORRECTION_ALREADY_REVIEWED', 409));
    const reviewed = await ctx.tx.paymentAllocationCorrection.update({
      where: { id },
      data: {
        status: decision,
        decided_by_id: staffId,
        decided_at: await at(ctx.tx),
        decision_reason: reason,
        decision_operation_id: ctx.operationId,
      },
    });
    return allocationCorrectionView(reviewed);
  }

  private director(ctx: CriticalContext) {
    if (!ctx.actor.mfaCompleted) return fail(domainError('MFA_REQUIRED', 403));
    return this.access.staff(ctx, true);
  }

  private readContext(actor: AccountContext, tx: Prisma.TransactionClient): CriticalContext {
    return { actor, tx, requestId: randomUUID(), operationId: randomUUID() };
  }

  private async facts(
    ctx: CriticalContext,
    sourceId: string,
    targetId: string | null,
    amount: Prisma.Decimal,
    now: Date,
  ): Promise<AllocationCorrectionFactsDto> {
    const [row] = await ctx.tx.$queryRaw<Facts[]>(
      allocationCorrectionFactsSql(sourceId, targetId, now),
    );
    if (!row) return fail(domainError('PUBLISHED_SOURCE_REQUIRED', 422));
    const reviewReasons = [
      ...(row.source_reversed ? ['SOURCE_ENTRY_REVERSED'] : []),
      ...(row.closed_at ? ['ORIGIN_PERIOD_CLOSED'] : []),
      ...(!row.open_current_period ? ['CURRENT_PERIOD_UNAVAILABLE'] : []),
      ...(row.used_lessons || row.started_lessons ? ['LESSON_ACTIVITY_RECORDED'] : []),
      ...(row.refund_history ? ['REFUND_HISTORY'] : []),
      ...(amount.gt(row.source_advance_balance) ? ['INSUFFICIENT_SOURCE_ADVANCE'] : []),
      ...(row.target_available?.lt(amount) ? ['TARGET_PRICE_LIMIT'] : []),
    ];
    return {
      receiptId: row.payment_id,
      sourceSubscriptionId: row.subscription_id,
      sourceEntryId: row.entry_id,
      originPeriodId: row.period_id,
      currency: row.currency,
      originalAmount: row.amount.toFixed(4),
      receiptAmount: row.receipt_amount.toFixed(4),
      receiptUnallocated: ctx.actor.roles.includes('DIRECTOR')
        ? row.receipt_unallocated.toFixed(4)
        : null,
      sourceAdvanceBalance: row.source_advance_balance.toFixed(4),
      targetAvailableAmount: row.target_available?.toFixed(4) ?? null,
      sourceGrantedLessons: row.granted_lessons,
      sourceUsedLessons: row.used_lessons,
      sourceStartedLessons: row.started_lessons,
      reviewReasons,
      asOf: now.toISOString(),
    };
  }
}
