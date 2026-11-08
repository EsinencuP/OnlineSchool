import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@online-school/db';
import type { Funding } from './contracts.js';
export type { Funding } from './contracts.js';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { AppException, domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { databaseError } from '../../../core/errors/database-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { subscriptionFacts } from '../../../student/subscription/subscription.sql.js';
import { LedgerPublicationService } from '../ledger-publication.service.js';
import { PaymentsService } from '../payments.service.js';
export const subscriptionFailure = (error: unknown): DomainError => {
  if (error instanceof AppException) return error.domain;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = JSON.stringify(error.meta ?? {});
    return domainError(
      /distribution/i.test(target)
        ? 'DISTRIBUTION_ALREADY_USED'
        : /enrollment|active/i.test(target)
          ? 'ACTIVE_SUBSCRIPTION_EXISTS'
          : 'CONFLICT',
      409,
    );
  }
  return databaseError(error);
};
@Injectable()
export class ManagerAllocationFinance {
  constructor(
    private readonly publisher: LedgerPublicationService,
    private readonly payments: PaymentsService,
  ) {}
  async resolveFunding(
    ctx: CriticalContext,
    studentId: string,
    distributionId: string,
    planId?: string,
  ): Promise<Result<Funding, DomainError>> {
    try {
      const distribution = await ctx.tx.paymentDistribution.findFirst({
        where: {
          id: distributionId,
          subscription_ref: { enrollment_ref: { student_id: studentId } },
        },
        include: { subscription_ref: { include: { sale_condition_ref: true } } },
      });
      if (!distribution) return err(domainError('DISTRIBUTION_NOT_FOUND', 404));
      const sub = distribution.subscription_ref,
        plan = sub.sale_condition_ref;
      if (sub.frozen_from || sub.frozen_until)
        return err(domainError('INVALID_STATE_TRANSITION', 409));
      if (
        sub.lesson_count !== plan.lesson_count ||
        sub.currency !== plan.currency ||
        !sub.full_price.eq(plan.price) ||
        !sub.original_paid_unit_price.eq(plan.lesson_unit_price) ||
        !sub.original_paid_unit_price.mul(sub.lesson_count).eq(sub.full_price)
      )
        return err(domainError('DISTRIBUTION_PLAN_MISMATCH', 409));
      await ctx.tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${sub.id}::uuid FOR UPDATE`;
      await ctx.tx
        .$queryRaw`SELECT id FROM payment_distributions WHERE id=${distributionId}::uuid FOR UPDATE`;
      if (
        await ctx.tx.managerSubscriptionOperation.findUnique({
          where: { distribution_id: distributionId },
          select: { id: true },
        })
      )
        return err(domainError('DISTRIBUTION_ALREADY_USED', 409));
      if (
        await ctx.tx.managerSubscriptionPeriod.findUnique({
          where: { financial_subscription_id: sub.id },
          select: { financial_subscription_id: true },
        })
      )
        return err(domainError('FINANCIAL_PACKAGE_ALREADY_ATTACHED', 409));
      if (planId && planId !== plan.id) {
        const requested = await ctx.tx.saleCondition.findUnique({
          where: { id: planId },
          select: { id: true },
        });
        return err(
          domainError(
            requested ? 'DISTRIBUTION_PLAN_MISMATCH' : 'PLAN_NOT_FOUND',
            requested ? 409 : 404,
          ),
        );
      }
      if (!plan.duration_days || plan.duration_days < 1)
        return err(domainError('PLAN_DURATION_REQUIRED', 409));
      const now = (await ctx.tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!
        .now;
      const proof = await this.publisher.requirePublishedDistribution(ctx.tx, distributionId, now);
      if (!proof.ok && proof.error.code === 'RETRYABLE')
        return err({ ...domainError('TRANSACTION_CONFLICT', 503), retryable: true });
      if (!proof.ok)
        return err(
          domainError(
            proof.error.code === 'DATABASE_ERROR' ? 'DATABASE_ERROR' : 'PAYMENT_NOT_CONFIRMED',
            proof.error.code === 'DATABASE_ERROR' ? 503 : 409,
          ),
        );
      const [facts] = await ctx.tx.$queryRaw<
        { paid: string; latest: Date; eligible: boolean }[]
      >(Prisma.sql`
        ${subscriptionFacts(studentId, { subscriptionId: sub.id }, now, { financialOnly: true })}
        SELECT coalesce(sum(amount),0)::text AS paid,max(greatest(approved_at,confirmed_at)) AS latest,
          coalesce(bool_or(id=${distributionId}::uuid),false) AS eligible FROM allocations WHERE currency=${sub.currency}`);
      if (!facts?.eligible) return err(domainError('PAYMENT_NOT_CONFIRMED', 409));
      const fullyPaid = new Prisma.Decimal(facts.paid).gte(sub.full_price);
      if (!fullyPaid) {
        const permissions = await ctx.tx.$queryRaw<{ id: string }[]>`
          SELECT p.id FROM temporary_access_permissions p WHERE p.subscription_id=${sub.id}::uuid
            AND p.approved_at>=${facts.latest} AND p.approved_at<=${now} AND p.valid_from<=${now} AND p.valid_to>${now}
            AND (p.revoked_at IS NULL OR p.revoked_at>${now})
            AND (SELECT count(*) FROM lesson_actual_outcomes o WHERE o.temporary_access_permission_id=p.id AND o.confirmed_at<=${now})<p.max_lessons
          ORDER BY p.approved_at DESC,p.id LIMIT 1`;
        if (!permissions.length) return err(domainError('PAYMENT_NOT_CONFIRMED', 409));
      }
      return ok({ sub, plan, distributionId, publicationId: proof.value, fullyPaid });
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async attach(
    ctx: CriticalContext,
    subscriptionId: string,
    funding: Funding,
  ): Promise<Result<void, DomainError>> {
    try {
      await ctx.tx.managerSubscriptionPeriod.create({
        data: {
          manager_subscription_id: subscriptionId,
          financial_subscription_id: funding.sub.id,
        },
      });
      if (funding.fullyPaid) {
        const issued = await ctx.tx.entitlementGrant.aggregate({
          where: { subscription_id: funding.sub.id },
          _sum: { quantity: true },
        });
        if ((issued._sum.quantity ?? 0) < funding.sub.lesson_count)
          await this.payments.grant(
            { ...ctx, operationId: randomUUID() },
            { subscriptionId: funding.sub.id, distributionId: funding.distributionId },
          );
      }
      return ok(undefined);
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
}
