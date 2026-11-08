import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { CriticalContext } from '../../../core/http.js';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { at } from '../finance-common.js';
import { subscriptionFacts } from '../../../student/subscription/subscription.sql.js';
import { EntitlementsService } from '../entitlements.service.js';
import { subscriptionFailure } from '../manager-subscriptions/finance-facade.js';
import type { DeductLesson } from '../../schedule/manager/contracts.js';
export type LessonRights = {
  subscriptionId: string;
  enrollmentId: string;
  grantId: string;
  financialSubscriptionId: string;
  remaining: number;
};
@Injectable()
export class ManagerLessonRights {
  constructor(private readonly entitlements: EntitlementsService) {}
  async resolve(
    ctx: CriticalContext,
    studentId: string,
    start: Date,
    end: Date,
    subscriptionId?: string,
    enrollmentId?: string,
  ): Promise<Result<LessonRights, DomainError>> {
    try {
      const now = await at(ctx.tx);
      const roots = await ctx.tx.managerSubscription.findMany({
        where: {
          ...(subscriptionId ? { id: subscriptionId } : {}),
          ...(enrollmentId ? { enrollment_id: enrollmentId } : {}),
          enrollment_ref: { student_id: studentId },
        },
        orderBy: [{ starts_at: 'desc' }, { id: 'asc' }],
      });
      const active = roots.filter(
        (r) =>
          r.starts_at <= now &&
          r.ends_at > now &&
          r.starts_at <= start &&
          r.ends_at >= end &&
          r.status === 'ACTIVE',
      );
      if (!active.length) return err(domainError('SUBSCRIPTION_NOT_ACTIVE', 409));
      if (active.length > 1) return err(domainError('SUBSCRIPTION_REQUIRED', 422));
      const root = active[0]!;
      await ctx.tx
        .$queryRaw`SELECT id FROM manager_subscriptions WHERE id=${root.id}::uuid FOR UPDATE`;
      const freeze = await ctx.tx.subscriptionFreeze.findFirst({
        where: {
          subscription_id: root.id,
          actual_ends_on: null,
          starts_at: { lt: end },
          ends_at: { gt: start },
        },
      });
      if (freeze) return err(domainError('SUBSCRIPTION_NOT_ACTIVE', 409));
      const periods = await ctx.tx.managerSubscriptionPeriod.findMany({
        where: { manager_subscription_id: root.id },
        orderBy: { financial_subscription_id: 'asc' },
      });
      for (const period of periods) {
        const [facts] = await ctx.tx.$queryRaw<
          { paid: string; price: string; remaining: number }[]
        >(Prisma.sql`
          ${subscriptionFacts(studentId, { subscriptionId: period.financial_subscription_id }, now, { financialOnly: true })}
          SELECT coalesce((SELECT sum(amount) FROM allocations),0)::text AS paid,
            (SELECT full_price::text FROM selected) AS price,(SELECT coalesce(sum(delta),0)::int FROM events) AS remaining`);
        if (!facts?.price || new Prisma.Decimal(facts.paid).lt(facts.price) || facts.remaining < 1)
          continue;
        const grants = await ctx.tx.entitlementGrant.findMany({
          where: { subscription_id: period.financial_subscription_id, granted_at: { lte: now } },
          orderBy: [{ granted_at: 'asc' }, { id: 'asc' }],
        });
        for (const grant of grants) {
          if ((await this.entitlements.remaining(ctx, grant.id)) < 1) continue;
          return ok({
            subscriptionId: root.id,
            enrollmentId: root.enrollment_id,
            grantId: grant.id,
            financialSubscriptionId: period.financial_subscription_id,
            remaining: facts.remaining,
          });
        }
      }
      return err(domainError('NO_LESSONS_REMAINING', 409));
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async deduct(
    ctx: CriticalContext,
    input: DeductLesson,
  ): Promise<Result<{ ledgerPublicationId: string }, DomainError>> {
    try {
      const lesson = await ctx.tx.lessonOccurrence.findUnique({ where: { id: input.lessonId } });
      if (!lesson || lesson.status !== 'CANCELLED')
        return err(domainError('LESSON_IMMUTABLE_STATE', 409));
      const rights = await this.resolve(
        ctx,
        input.studentId,
        lesson.scheduled_at,
        lesson.scheduled_end_at,
        input.subscriptionId,
        lesson.enrollment_id,
      );
      if (!rights.ok) return rights;
      const result = await this.entitlements.consume(
        ctx,
        {
          grantId: rights.value.grantId,
          studentId: input.studentId,
          lessonId: lesson.id,
          reason: input.reason,
        },
        'APPROVED_CANCELLATION',
      );
      return ok({ ledgerPublicationId: result.ledgerEntryId });
    } catch (error: unknown) {
      const failure = subscriptionFailure(error);
      return err(failure.retryable ? failure : domainError('LEDGER_PUBLICATION_FAILED', 503));
    }
  }
}
