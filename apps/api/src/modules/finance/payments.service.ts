import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { object, string, uuid } from '../identity/input.js';
import { at, count, currency, date, Decimal, money, operation } from './finance-common.js';
import { FinanceAccess } from './finance-access.service.js';
import { FinanceEvents } from './finance-events.service.js';
import { FinanceLedger } from './finance-ledger.service.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly access: FinanceAccess,
    private readonly ledger: FinanceLedger,
    private readonly events: FinanceEvents,
  ) {}
  async register(ctx: CriticalContext, body: unknown) {
    const input = object(body, [
      'studentId',
      'amount',
      'currency',
      'provider',
      'externalReference',
    ]);
    const studentId = uuid(input.studentId);
    await this.access.student(ctx, studentId);
    const staff = await this.access.staff(ctx);
    const now = await at(ctx.tx);
    if ((input.provider === undefined) !== (input.externalReference === undefined))
      return fail(domainError('INVALID_INPUT', 400));
    const receipt = await ctx.tx.paymentReceipt.create({
      data: {
        student_id: studentId,
        amount: money(input.amount),
        currency: currency(input.currency),
        registered_by_manager_id: staff,
        registered_at: now,
        ...operation(ctx.operationId),
        ...(input.provider === undefined
          ? {}
          : {
              provider: string(input.provider, 1, 100),
              external_reference: string(input.externalReference, 1, 200),
            }),
      },
    });
    return { ...receipt, status: 'REGISTERED' as const };
  }
  async confirm(ctx: CriticalContext, id: string, body: unknown) {
    object(body ?? {}, []);
    const staff = await this.access.staff(ctx, true);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM payment_receipts WHERE id=${id}::uuid FOR UPDATE`;
    const receipt = await this.access.payment(ctx, id);
    if (receipt.confirmed_by_director_at)
      return fail(domainError('PAYMENT_ALREADY_CONFIRMED', 409));
    const now = await at(ctx.tx);
    await this.ledger.period(ctx.tx, now);
    const confirmed = await ctx.tx.paymentReceipt.update({
      where: { id },
      data: {
        confirmed_by_director_id: staff,
        confirmed_by_director_at: now,
        confirmation_operation_id: ctx.operationId,
      },
    });
    const entry = await this.ledger.event(ctx, {
      payment_id: id,
      basis: 'Director confirmed payment receipt',
      ...operation(randomUUID()),
    });
    const event = await this.events.record(
      ctx,
      'finance.payment.confirmed',
      'PaymentReceipt',
      id,
      receipt.student_id ? { studentId: receipt.student_id } : {},
    );
    if (receipt.student_id) {
      const assignment = await ctx.tx.assignedManager.findFirst({
        where: {
          student_id: receipt.student_id,
          assigned_at: { lte: now },
          OR: [{ ended_at: null }, { ended_at: { gt: now } }],
        },
      });
      await ctx.tx.crmTask.create({
        data: {
          student_id: receipt.student_id,
          assigned_manager_id: assignment?.manager_id ?? null,
          type: 'PAYMENT_FOLLOW_UP',
          title: 'Поступление подтверждено: проверить распределение и доступ',
          due_at: now,
          source_event_id: event.id,
          idempotency_key: `payment-confirmed:${id}`,
        },
      });
    }
    return {
      ...confirmed,
      status: 'CONFIRMED' as const,
      confirmed_at: confirmed.confirmed_by_director_at,
      ledgerEntryId: entry.id,
    };
  }
  async propose(ctx: CriticalContext, id: string, body: unknown) {
    const input = object(body, ['subscriptionId', 'amount']);
    id = uuid(id);
    const receipt = await this.access.payment(ctx, id);
    const { sub } = await this.access.subscription(ctx, uuid(input.subscriptionId));
    const amount = money(input.amount);
    if (receipt.currency !== sub.currency || amount.gt(receipt.amount))
      return fail(domainError('DISTRIBUTION_AMOUNT_INVALID', 422));
    // A proposal may precede receipt confirmation; approval cannot.
    return ctx.tx.paymentDistribution.create({
      data: {
        payment_id: id,
        subscription_id: sub.id,
        amount,
        currency: sub.currency,
        ...operation(ctx.operationId),
      },
    });
  }
  async approve(ctx: CriticalContext, id: string, body: unknown) {
    object(body ?? {}, []);
    const staff = await this.access.staff(ctx, true);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM payment_distributions WHERE id=${id}::uuid FOR UPDATE`;
    const distribution = await ctx.tx.paymentDistribution.findUnique({ where: { id } });
    if (!distribution) return fail(domainError('NOT_FOUND', 404));
    await ctx.tx
      .$queryRaw`SELECT id FROM payment_receipts WHERE id=${distribution.payment_id}::uuid FOR UPDATE`;
    await ctx.tx
      .$queryRaw`SELECT id FROM subscriptions WHERE id=${distribution.subscription_id}::uuid FOR UPDATE`;
    const payment = await this.access.payment(ctx, distribution.payment_id);
    const { sub } = await this.access.subscription(ctx, distribution.subscription_id);
    if (distribution.approved_at) return fail(domainError('DISTRIBUTION_ALREADY_APPROVED', 409));
    if (!payment.confirmed_by_director_at) return fail(domainError('PAYMENT_NOT_CONFIRMED', 422));
    const allocated = await ctx.tx.paymentDistribution.aggregate({
      where: { payment_id: payment.id, approved_at: { not: null } },
      _sum: { amount: true },
    });
    if (new Decimal(allocated._sum.amount ?? 0).add(distribution.amount).gt(payment.amount))
      return fail(domainError('PAYMENT_OVER_ALLOCATED', 422));
    const paid = await ctx.tx.paymentDistribution.aggregate({
      where: { subscription_id: sub.id, approved_at: { not: null } },
      _sum: { amount: true },
    });
    if (new Decimal(paid._sum.amount ?? 0).add(distribution.amount).gt(sub.full_price))
      return fail(domainError('SUBSCRIPTION_OVER_ALLOCATED', 422));
    const now = await at(ctx.tx);
    const approved = await ctx.tx.paymentDistribution.update({
      where: { id },
      data: {
        approved_by_director_id: staff,
        approved_at: now,
        approval_operation_id: ctx.operationId,
      },
    });
    const entry = await this.ledger.event(ctx, {
      distribution_id: id,
      basis: 'Director approved payment allocation',
      ...operation(randomUUID()),
    });
    return { ...approved, ledgerEntryId: entry.id };
  }
  async subscription(ctx: CriticalContext, body: unknown) {
    const input = object(body, ['enrollmentId', 'saleConditionId']);
    const enrollmentId = uuid(input.enrollmentId);
    const enrollment = await ctx.tx.studentSubjectEnrollment.findUnique({
      where: { id: enrollmentId },
    });
    if (!enrollment) return fail(domainError('NOT_FOUND', 404));
    await this.access.student(ctx, enrollment.student_id);
    const now = await at(ctx.tx);
    if (
      enrollment.status !== 'ACTIVE' ||
      enrollment.valid_from > now ||
      (enrollment.valid_to && enrollment.valid_to <= now)
    )
      return fail(domainError('ENROLLMENT_INACTIVE', 422));
    const sale = await ctx.tx.saleCondition.findUnique({
      where: { id: uuid(input.saleConditionId) },
    });
    if (!sale || sale.valid_from > now || (sale.valid_to && sale.valid_to <= now))
      return fail(domainError('SALE_CONDITION_INACTIVE', 422));
    if (!new Decimal(sale.lesson_unit_price).mul(sale.lesson_count).eq(sale.price))
      return fail(domainError('SALE_PRICE_ALLOCATION_REQUIRES_REVIEW', 422));
    return ctx.tx.subscription.create({
      data: {
        enrollment_id: enrollmentId,
        sale_condition_id: sale.id,
        lesson_count: sale.lesson_count,
        full_price: sale.price,
        initial_discount_amount: sale.discount_amount,
        original_paid_unit_price: sale.lesson_unit_price,
        currency: sale.currency,
        valid_from: now,
        ...operation(ctx.operationId),
      },
    });
  }
  async grant(ctx: CriticalContext, body: unknown) {
    const input = object(body, ['subscriptionId', 'distributionId', 'quantity']);
    const staff = await this.access.staff(ctx);
    const { sub } = await this.access.subscription(ctx, uuid(input.subscriptionId));
    await ctx.tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${sub.id}::uuid FOR UPDATE`;
    const dist = await ctx.tx.paymentDistribution.findUnique({
      where: { id: uuid(input.distributionId) },
    });
    if (!dist || dist.subscription_id !== sub.id || !dist.approved_at)
      return fail(domainError('DISTRIBUTION_NOT_APPROVED', 422));
    const paid = await ctx.tx.paymentDistribution.aggregate({
      where: { subscription_id: sub.id, approved_at: { not: null } },
      _sum: { amount: true },
    });
    if (!new Decimal(paid._sum.amount ?? 0).gte(sub.full_price))
      return fail(domainError('FULL_CONFIRMED_PAYMENT_REQUIRED', 422));
    const grants = await ctx.tx.entitlementGrant.aggregate({
      where: { subscription_id: sub.id },
      _sum: { quantity: true },
    });
    const remaining = sub.lesson_count - (grants._sum.quantity ?? 0);
    if (remaining <= 0) return fail(domainError('RIGHTS_ALREADY_GRANTED', 409));
    const quantity = input.quantity === undefined ? remaining : count(input.quantity, 1, remaining);
    return ctx.tx.entitlementGrant.create({
      data: {
        subscription_id: sub.id,
        payment_distribution_id: dist.id,
        quantity,
        basis: 'CONFIRMED_PAYMENT',
        granted_at: await at(ctx.tx),
        authorized_by_id: staff,
        ...operation(ctx.operationId),
      },
    });
  }
  async temporary(ctx: CriticalContext, body: unknown) {
    const input = object(body, ['subscriptionId', 'grantedLessonsCount', 'expiresAt', 'basis']);
    const staff = await this.access.staff(ctx, true);
    const { sub, enrollment } = await this.access.subscription(ctx, uuid(input.subscriptionId));
    await ctx.tx.$queryRaw`SELECT id FROM subscriptions WHERE id=${sub.id}::uuid FOR UPDATE`;
    const now = await at(ctx.tx);
    const paid = await ctx.tx.paymentDistribution.aggregate({
      where: { subscription_id: sub.id, approved_at: { not: null } },
      _sum: { amount: true },
    });
    if (new Decimal(paid._sum.amount ?? 0).gte(sub.full_price))
      return fail(domainError('FULLY_PAID_USES_NORMAL_ACCESS', 422));
    const expires = date(input.expiresAt);
    if (expires <= now) return fail(domainError('INVALID_ACCESS_EXPIRY', 422));
    const permission = await ctx.tx.temporaryAccessPermission.create({
      data: {
        subscription_id: sub.id,
        approved_by_director_id: staff,
        approved_at: now,
        valid_from: now,
        valid_to: expires,
        max_lessons: count(input.grantedLessonsCount),
        reason: string(input.basis, 5, 500),
        ...operation(ctx.operationId),
      },
    });
    const event = await this.events.record(
      ctx,
      'finance.temporary-access.expiry-scheduled',
      'TemporaryAccessPermission',
      permission.id,
      { studentId: enrollment.student_id },
    );
    await ctx.tx.jobRecord.create({
      data: {
        type: 'finance.temporary-access.expire.v1',
        payload: { permissionId: permission.id },
        source_operation_id: ctx.operationId,
        source_outbox_event_id: event.id,
        deduplication_key: `temporary-access-expire:${permission.id}`,
        retry_policy: 'SAFE_RETRY',
        max_attempts: 3,
        next_run_at: expires,
      },
    });
    return {
      ...permission,
      expires_at: permission.valid_to,
      granted_lessons_count: permission.max_lessons,
      basis: permission.reason,
      director_id: permission.approved_by_director_id,
    };
  }
}
