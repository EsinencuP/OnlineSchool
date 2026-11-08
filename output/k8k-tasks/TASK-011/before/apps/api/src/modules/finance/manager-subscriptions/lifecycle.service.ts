import { managedSubscriptionTotalsSql } from './read-spec.js';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NotificationOutboxPublisher } from '../../notifications/notification-outbox.publisher.js';
import type { ManagerTemplateCode } from '../../notifications/templates.js';
import { Prisma } from '@online-school/db';
import type {
  ManagerSubscription,
  ManagerSubscriptionOperationType,
  SubscriptionFreeze,
} from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { AuditService } from '../../../core/audit/audit.service.js';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { at } from '../finance-common.js';
import { ManagerAllocationFinance, subscriptionFailure } from './finance-facade.js';
import { LessonCancellationPort } from './contracts.js';
import type {
  CreateSubscription,
  RenewSubscription,
  FreezeSubscription,
  SubscriptionActor,
  SubscriptionView,
  Funding,
  ManagerFinancePort,
} from './contracts.js';
import {
  addSchoolDays,
  daysBetween,
  freezeDates,
  freezePolicy,
  localDay,
  schoolMidnight,
} from './time.js';
type Tx = Prisma.TransactionClient;
@Injectable()
export class ManagerSubscriptionLifecycle {
  constructor(
    @Inject(ManagerAllocationFinance) private readonly finance: ManagerFinancePort,
    private readonly audit: AuditService,
    private readonly lessons: LessonCancellationPort,
  ) {}
  private async lock(tx: Tx, id: string): Promise<ManagerSubscription> {
    await tx.$queryRaw`SELECT id FROM manager_subscriptions WHERE id=${id}::uuid FOR UPDATE`;
    const root = await tx.managerSubscription.findUnique({ where: { id } });
    return root ?? unwrap(err(domainError('SUBSCRIPTION_NOT_FOUND', 404)));
  }
  private async enrollmentLock(tx: Tx, id: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM student_subject_enrollments WHERE id=${id}::uuid FOR UPDATE`;
  }
  private async view(tx: Tx, root: ManagerSubscription, now: Date): Promise<SubscriptionView> {
    const enrollment = await tx.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: root.enrollment_id },
      select: { student_id: true },
    });
    const plan = await tx.saleCondition.findUniqueOrThrow({ where: { id: root.current_plan_id } });
    const [totals] = await tx.$queryRaw<{ total: number; remaining: number }[]>(
      managedSubscriptionTotalsSql(root.id, now),
    );
    const frozen = await tx.subscriptionFreeze.findFirst({
      where: { subscription_id: root.id, actual_ends_on: null },
    });
    return {
      id: root.id,
      studentId: enrollment.student_id,
      enrollmentId: root.enrollment_id,
      planId: root.current_plan_id,
      status: root.status === 'ACTIVE' && root.ends_at <= now ? 'EXPIRED' : root.status,
      startsAt: root.starts_at.toISOString(),
      endsAt: root.ends_at.toISOString(),
      frozenUntil: frozen?.ends_at.toISOString() ?? null,
      totalLessons: totals?.total ?? 0,
      remainingLessons: totals?.remaining ?? 0,
      freezeDaysUsed: root.freeze_days_used,
      price: plan.price.toFixed(4),
      currency: plan.currency,
    };
  }
  async list(tx: Tx, studentId: string): Promise<Result<SubscriptionView[], DomainError>> {
    try {
      const now = await at(tx),
        rows = await tx.managerSubscription.findMany({
          where: { enrollment_ref: { student_id: studentId } },
          orderBy: [{ starts_at: 'desc' }, { id: 'asc' }],
        });
      const views = [];
      for (const row of rows) views.push(await this.view(tx, row, now));
      return ok(views);
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  private async window(
    tx: Tx,
    root: ManagerSubscription,
    freeze?: { from: Date; until: Date },
  ): Promise<void> {
    const periods = await tx.managerSubscriptionPeriod.findMany({
      where: { manager_subscription_id: root.id },
      select: { financial_subscription_id: true },
    });
    await tx.subscription.updateMany({
      where: { id: { in: periods.map((p) => p.financial_subscription_id) } },
      data: {
        valid_to: root.ends_at,
        frozen_from: freeze?.from ?? null,
        frozen_until: freeze?.until ?? null,
      },
    });
  }
  private async record(
    tx: Tx,
    root: ManagerSubscription,
    type: ManagerSubscriptionOperationType,
    now: Date,
    actor: SubscriptionActor | null,
    key: string,
    funding?: Funding,
  ): Promise<void> {
    const operationId = randomUUID(),
      auditId = randomUUID(),
      action = `SUBSCRIPTION_${{ CREATE: 'CREATED', RENEW: 'RENEWED', FREEZE: 'FROZEN', UNFREEZE: 'UNFROZEN', EXPIRE: 'EXPIRED' }[type]}`;
    const student = await tx.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: root.enrollment_id },
      select: { student_id: true },
    });
    const payload = {
      schemaVersion: 1,
      studentId: student.student_id,
      subscriptionId: root.id,
      operationId,
    };
    await tx.managerSubscriptionOperation.create({
      data: {
        id: operationId,
        subscription_id: root.id,
        type,
        distribution_id: funding?.distributionId ?? null,
        ledger_publication_id: funding?.publicationId ?? null,
        created_by_manager_id: actor?.managerId ?? null,
        source_operation_id: key,
        payload: { ...payload, endsAt: root.ends_at.toISOString() },
        created_at: now,
      },
    });
    await this.audit.record(
      {
        id: auditId,
        ...(actor
          ? { actor_kind: 'ACCOUNT' as const, actor_id: actor.accountId }
          : { actor_kind: 'SYSTEM' as const, system_actor_ref: 'manager-subscription-expiry' }),
        action,
        resource_type: 'ManagerSubscription',
        resource_id: root.id,
        result: 'SUCCESS',
        request_id: actor?.requestId ?? randomUUID(),
        source_operation_id: key,
        event_key: `manager-subscription:${operationId}`,
        recorded_at: now,
        metadata: { studentId: student.student_id, operationId },
      },
      tx,
    );
    await tx.outboxEvent.create({
      data: {
        topic: `manager.subscription.${{ CREATE: 'created', RENEW: 'renewed', FREEZE: 'frozen', UNFREEZE: 'unfrozen', EXPIRE: 'expired' }[type]}.v1`,
        aggregate_type: 'ManagerSubscription',
        aggregate_id: root.id,
        audit_event_id: auditId,
        source_operation_id: key,
        event_key: `manager-subscription:${operationId}`,
        payload,
        created_at: now,
      },
    });
    unwrap(
      await new NotificationOutboxPublisher().enqueue(tx, {
        studentId: student.student_id,
        templateCode: action as ManagerTemplateCode,
        variables: { subscriptionId: root.id, operationId },
        dedupeKey: `manager-subscription:${operationId}`,
        operationId: key,
        ...(actor ? { actorId: actor.accountId, requestId: actor.requestId } : {}),
      }),
    );
  }
  async create(
    ctx: CriticalContext,
    actor: SubscriptionActor,
    studentId: string,
    input: CreateSubscription,
  ): Promise<Result<SubscriptionView, DomainError>> {
    try {
      const funding = unwrap(
        await this.finance.resolveFunding(ctx, studentId, input.distributionId, input.planId),
      );
      const policy = unwrap(freezePolicy()),
        now = await at(ctx.tx);
      await this.enrollmentLock(ctx.tx, funding.sub.enrollment_id);
      if (input.startsAt && +new Date(input.startsAt) !== +funding.sub.valid_from)
        return err(domainError('INVALID_STARTS_AT', 422));
      const endsAt = addSchoolDays(
        funding.sub.valid_from,
        funding.plan.duration_days!,
        policy.zone,
      );
      if (funding.sub.valid_to && +funding.sub.valid_to !== +endsAt)
        return err(domainError('PREPARED_TERM_MISMATCH', 409));
      const active = await ctx.tx.managerSubscription.findFirst({
        where: { enrollment_id: funding.sub.enrollment_id, status: { in: ['ACTIVE', 'FROZEN'] } },
        select: { id: true },
      });
      if (active) return err(domainError('ACTIVE_SUBSCRIPTION_EXISTS', 409));
      const [legacy] = await ctx.tx.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM subscriptions s WHERE s.enrollment_id=${funding.sub.enrollment_id}::uuid AND s.id<>${funding.sub.id}::uuid
          AND s.valid_from<=${now} AND (s.valid_to IS NULL OR s.valid_to>${now})
          AND NOT EXISTS(SELECT 1 FROM manager_subscription_periods mp WHERE mp.financial_subscription_id=s.id)
          AND EXISTS(SELECT 1 FROM entitlement_grants g WHERE g.subscription_id=s.id)) AS exists`;
      if (legacy?.exists) return err(domainError('ACTIVE_SUBSCRIPTION_EXISTS', 409));
      const root = await ctx.tx.managerSubscription.create({
        data: {
          id: funding.sub.id,
          enrollment_id: funding.sub.enrollment_id,
          current_plan_id: funding.plan.id,
          starts_at: funding.sub.valid_from,
          ends_at: endsAt,
          timezone: policy.zone,
        },
      });
      unwrap(await this.finance.attach(ctx, root.id, funding));
      await this.window(ctx.tx, root);
      await this.record(ctx.tx, root, 'CREATE', now, actor, ctx.operationId, funding);
      return ok(await this.view(ctx.tx, root, now));
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async renew(
    ctx: CriticalContext,
    actor: SubscriptionActor,
    id: string,
    input: RenewSubscription,
  ): Promise<Result<SubscriptionView, DomainError>> {
    try {
      let root = await this.lock(ctx.tx, id);
      const now = await at(ctx.tx);
      if (!['ACTIVE', 'EXPIRED'].includes(root.status))
        return err(domainError('INVALID_STATE_TRANSITION', 409));
      await this.enrollmentLock(ctx.tx, root.enrollment_id);
      const enrollment = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
        where: { id: root.enrollment_id },
        select: { student_id: true },
      });
      const funding = unwrap(
        await this.finance.resolveFunding(
          ctx,
          enrollment.student_id,
          input.distributionId,
          input.planId ?? root.current_plan_id,
        ),
      );
      if (funding.sub.enrollment_id !== root.enrollment_id)
        return err(domainError('DISTRIBUTION_NOT_FOUND', 404));
      const active = await ctx.tx.managerSubscription.findFirst({
        where: {
          enrollment_id: root.enrollment_id,
          id: { not: id },
          status: { in: ['ACTIVE', 'FROZEN'] },
        },
        select: { id: true },
      });
      if (active) return err(domainError('ACTIVE_SUBSCRIPTION_EXISTS', 409));
      unwrap(await this.finance.attach(ctx, id, funding));
      root = await ctx.tx.managerSubscription.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          current_plan_id: funding.plan.id,
          ends_at: addSchoolDays(
            root.ends_at > now ? root.ends_at : now,
            funding.plan.duration_days!,
            root.timezone,
          ),
        },
      });
      await this.window(ctx.tx, root);
      await this.record(ctx.tx, root, 'RENEW', now, actor, ctx.operationId, funding);
      return ok(await this.view(ctx.tx, root, now));
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async freeze(
    ctx: CriticalContext,
    actor: SubscriptionActor,
    id: string,
    input: FreezeSubscription,
  ): Promise<Result<SubscriptionView, DomainError>> {
    try {
      let root = await this.lock(ctx.tx, id);
      const now = await at(ctx.tx);
      if (root.status !== 'ACTIVE' || root.ends_at <= now)
        return err(domainError('INVALID_STATE_TRANSITION', 409));
      const configured = unwrap(freezePolicy()),
        policy = { ...configured, zone: root.timezone };
      const dates = unwrap(
        freezeDates(input.startsOn, input.endsOn, now, root.freeze_days_used, policy),
      );
      if (input.startsOn < localDay(root.starts_at, root.timezone) || dates.from >= root.ends_at)
        return err(domainError('INVALID_FREEZE_DATES', 422));
      const conflicts = await ctx.tx.lessonOccurrence.findMany({
        where: {
          enrollment_id: root.enrollment_id,
          status: { in: ['SCHEDULED', 'STAR_PENDING'] },
          scheduled_at: { lt: dates.until },
          scheduled_end_at: { gt: dates.from },
        },
        orderBy: [{ scheduled_at: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (conflicts.length) {
        if (!input.cancelConflictingLessons)
          return err({
            ...domainError('FREEZE_HAS_LESSONS', 409),
            details: { lessonIds: conflicts.map((l) => l.id) },
          });
        unwrap(
          await this.lessons.cancelWithoutCharge(
            actor,
            conflicts.map((l) => l.id),
            input.reason,
            ctx.tx,
            ctx,
          ),
        );
        const remaining = await ctx.tx.lessonOccurrence.count({
          where: {
            id: { in: conflicts.map((l) => l.id) },
            status: { in: ['SCHEDULED', 'STAR_PENDING'] },
          },
        });
        if (remaining) return err(domainError('LESSON_CANCELLATION_NOT_COMPLETED', 409));
      }
      await ctx.tx.subscriptionFreeze.create({
        data: {
          subscription_id: id,
          starts_on: new Date(input.startsOn),
          ends_on: new Date(input.endsOn),
          starts_at: dates.from,
          ends_at: dates.until,
          reason: input.reason,
          comment: input.comment ?? null,
        },
      });
      root = await ctx.tx.managerSubscription.update({ where: { id }, data: { status: 'FROZEN' } });
      await this.window(ctx.tx, root, dates);
      await this.record(ctx.tx, root, 'FREEZE', now, actor, ctx.operationId);
      return ok(await this.view(ctx.tx, root, now));
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  private async closeFreeze(
    tx: Tx,
    root: ManagerSubscription,
    freeze: SubscriptionFreeze,
    now: Date,
    actor: SubscriptionActor | null,
    key: string,
  ): Promise<ManagerSubscription> {
    const starts = freeze.starts_on.toISOString().slice(0, 10),
      planned = freeze.ends_on.toISOString().slice(0, 10);
    const day = localDay(now, root.timezone),
      actual = day < starts ? starts : day > planned ? planned : day;
    const days = daysBetween(starts, actual);
    await tx.subscriptionFreeze.update({
      where: { id: freeze.id },
      data: {
        actual_ends_on: new Date(actual),
        actual_ends_at: schoolMidnight(actual, root.timezone),
      },
    });
    root = await tx.managerSubscription.update({
      where: { id: root.id },
      data: {
        status: 'ACTIVE',
        freeze_days_used: { increment: days },
        ends_at: addSchoolDays(root.ends_at, days, root.timezone),
      },
    });
    await this.window(tx, root);
    await this.record(tx, root, 'UNFREEZE', now, actor, key);
    return root;
  }
  async unfreeze(
    ctx: CriticalContext,
    actor: SubscriptionActor,
    id: string,
  ): Promise<Result<SubscriptionView, DomainError>> {
    try {
      let root = await this.lock(ctx.tx, id);
      const now = await at(ctx.tx);
      const freeze = await ctx.tx.subscriptionFreeze.findFirst({
        where: { subscription_id: id, actual_ends_on: null },
      });
      if (root.status !== 'FROZEN' || !freeze)
        return err(domainError('INVALID_STATE_TRANSITION', 409));
      root = await this.closeFreeze(ctx.tx, root, freeze, now, actor, ctx.operationId);
      return ok(await this.view(ctx.tx, root, now));
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async processDue(tx: Tx, id: string, now: Date): Promise<Result<boolean, DomainError>> {
    try {
      let root = await this.lock(tx, id);
      let changed = false;
      if (root.status === 'FROZEN') {
        const freeze = await tx.subscriptionFreeze.findFirst({
          where: { subscription_id: id, actual_ends_on: null },
        });
        if (freeze && freeze.ends_at <= now) {
          root = await this.closeFreeze(tx, root, freeze, now, null, randomUUID());
          changed = true;
        }
      }
      if (root.status === 'ACTIVE' && root.ends_at <= now) {
        root = await tx.managerSubscription.update({ where: { id }, data: { status: 'EXPIRED' } });
        await this.record(tx, root, 'EXPIRE', now, null, randomUUID());
        changed = true;
      }
      return ok(changed);
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
}
