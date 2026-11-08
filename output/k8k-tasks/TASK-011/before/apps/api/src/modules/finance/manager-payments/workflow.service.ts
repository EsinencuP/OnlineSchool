import { statusWhere, receiptStatus } from './receipt-read.spec.js';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { domainError } from '../../../core/errors/domain-error.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import { PolicyService } from '../../../core/policy/policy.service.js';
import type { CriticalContext } from '../../../core/http.js';
import { at } from '../finance-common.js';
import { PaymentsService } from '../payments.service.js';
import { positiveReceiptAmount, receiptCurrency } from '../receipt-policy.js';
import { subscriptionFailure } from '../manager-subscriptions/finance-facade.js';
import { ManagerPaymentStatus } from './contracts.js';
import type {
  CreateReceipt,
  ReceiptView,
  ReceiptPage,
  ReceiptQuery,
  PrepareDistribution,
  AllocateReceipt,
  DistributionView,
  DistributionPage,
  ManagerAdjustmentCommand,
} from './contracts.js';
const includeReceipt = {
  t03_ledgerdocument_payment_id: { include: { t03_ledgerentry_document_id: true } },
} as const;
type ReceiptRow = Prisma.PaymentReceiptGetPayload<{ include: typeof includeReceipt }>;
@Injectable()
export class ManagerPaymentWorkflow {
  constructor(
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly policy: PolicyService,
  ) {}
  private project(row: ReceiptRow): ReceiptView {
    const entry = row.t03_ledgerdocument_payment_id?.t03_ledgerentry_document_id;
    const status = receiptStatus(row);
    return {
      id: row.id,
      studentId: row.student_id!,
      amount: row.amount.toFixed(4),
      currency: row.currency,
      method: row.method,
      purpose: row.purpose,
      status,
      receivedAt: (row.received_at ?? row.registered_at).toISOString(),
      externalRef: row.external_reference,
      ledgerPublicationId: status === 'CONFIRMED' ? entry!.id : null,
      createdAt: row.created_at.toISOString(),
      rejectionReason: row.rejection_reason,
    };
  }
  async contact(tx: Prisma.TransactionClient, id: string): Promise<Result<string, DomainError>> {
    try {
      const r = await tx.paymentReceipt.findUnique({ where: { id }, select: { student_id: true } });
      return r?.student_id ? ok(r.student_id) : err(domainError('PAYMENT_NOT_FOUND', 404));
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async get(
    tx: Prisma.TransactionClient,
    studentId: string,
    id: string,
  ): Promise<Result<ReceiptView, DomainError>> {
    try {
      const row = await tx.paymentReceipt.findFirst({
        where: { id, student_id: studentId },
        include: includeReceipt,
      });
      return row ? ok(this.project(row)) : err(domainError('PAYMENT_NOT_FOUND', 404));
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async list(
    tx: Prisma.TransactionClient,
    studentId: string,
    q: ReceiptQuery,
  ): Promise<Result<ReceiptPage, DomainError>> {
    try {
      const where: Prisma.PaymentReceiptWhereInput = {
        AND: [{ student_id: studentId }, statusWhere(q.status)],
      };
      const total = await tx.paymentReceipt.count({ where });
      const rows = await tx.paymentReceipt.findMany({
        where,
        include: includeReceipt,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      });
      return ok({
        items: rows.map((r) => this.project(r)),
        total,
        page: q.page,
        pageSize: q.pageSize,
      });
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  private async record(
    ctx: CriticalContext,
    action: string,
    topic: string,
    paymentId: string,
    studentId: string,
    metadata: Prisma.InputJsonObject = {},
  ): Promise<void> {
    const id = randomUUID();
    await this.audit.record(
      {
        id,
        actor_kind: 'ACCOUNT',
        actor_id: ctx.actor.accountId,
        action,
        resource_type: 'PaymentReceipt',
        resource_id: paymentId,
        request_id: ctx.requestId,
        result: 'SUCCESS',
        source_operation_id: ctx.operationId,
        event_key: `${action}:${ctx.operationId}:${paymentId}`,
        metadata: { studentId, ...metadata },
      },
      ctx.tx,
    );
    await ctx.tx.outboxEvent.create({
      data: {
        topic,
        aggregate_type: 'PaymentReceipt',
        aggregate_id: paymentId,
        audit_event_id: id,
        source_operation_id: ctx.operationId,
        event_key: `${action}:${ctx.operationId}:${paymentId}`,
        payload: { schemaVersion: 1, paymentId, studentId },
      },
    });
  }
  async create(
    ctx: CriticalContext,
    studentId: string,
    input: CreateReceipt,
  ): Promise<Result<ReceiptView, DomainError>> {
    try {
      if (!positiveReceiptAmount(input.amount)) return err(domainError('INVALID_MONEY', 422));
      const currency = receiptCurrency(input.currency),
        now = await at(ctx.tx),
        received = new Date(input.receivedAt);
      if (!Number.isFinite(+received) || received > now)
        return err(domainError('INVALID_RECEIVED_AT', 422));
      const ref = input.externalRef?.trim();
      if (input.externalRef !== undefined && !ref) return err(domainError('INVALID_INPUT', 422));
      const row = await this.payments.register(
        { ...ctx, operationId: randomUUID() },
        {
          studentId,
          amount: input.amount,
          currency,
          ...(ref ? { provider: input.method, externalReference: ref } : {}),
        },
        {
          method: input.method,
          purpose: input.purpose,
          received_at: received,
          manager_note: input.note ?? null,
        },
      );
      await this.record(ctx, 'PAYMENT_CREATED', 'manager.payment.created.v1', row.id, studentId);
      return this.get(ctx.tx, studentId, row.id);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return err(domainError('PAYMENT_DUPLICATE', 409));
      return err(subscriptionFailure(error));
    }
  }
  async publishPayment(
    ctx: CriticalContext,
    studentId: string,
    id: string,
  ): Promise<Result<ReceiptView, DomainError>> {
    try {
      await ctx.tx.$queryRaw`SELECT id FROM payment_receipts WHERE id=${id}::uuid FOR UPDATE`;
      const row = await ctx.tx.paymentReceipt.findFirst({
        where: { id, student_id: studentId },
        include: includeReceipt,
      });
      if (!row) return err(domainError('PAYMENT_NOT_FOUND', 404));
      if (row.confirmed_by_director_at) return err(domainError('PAYMENT_IMMUTABLE', 409));
      if (this.project(row).status !== 'PENDING')
        return err(domainError('PAYMENT_NOT_PENDING', 409));
      const decision = await this.policy.managerPaymentPublication(ctx.actor, studentId, ctx.tx);
      if (decision.ok) return err(domainError('FINANCE_POLICY_CONFIGURATION_ERROR', 503));
      if (decision.error.code !== 'APPROVAL_REQUIRED') return decision;
      await ctx.tx.paymentReceipt.update({
        where: { id },
        data: { approval_requested_at: await at(ctx.tx) },
      });
      await this.record(
        ctx,
        'PAYMENT_SENT_FOR_APPROVAL',
        'manager.payment.approval-requested.v1',
        id,
        studentId,
      );
      return this.get(ctx.tx, studentId, id);
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async reject(
    ctx: CriticalContext,
    studentId: string,
    id: string,
    reason: string,
  ): Promise<Result<ReceiptView, DomainError>> {
    try {
      await ctx.tx.$queryRaw`SELECT id FROM payment_receipts WHERE id=${id}::uuid FOR UPDATE`;
      const row = await ctx.tx.paymentReceipt.findFirst({
        where: { id, student_id: studentId },
        include: includeReceipt,
      });
      if (!row) return err(domainError('PAYMENT_NOT_FOUND', 404));
      if (row.confirmed_by_director_at) return err(domainError('PAYMENT_IMMUTABLE', 409));
      if (this.project(row).status !== 'PENDING')
        return err(domainError('PAYMENT_NOT_PENDING', 409));
      if (reason.trim().length < 3 || reason.length > 500)
        return err(domainError('INVALID_INPUT', 422));
      const staff = await ctx.tx.staffAccount.findFirst({
        where: { account_id: ctx.actor.accountId, deactivated_at: null },
        select: { id: true },
      });
      if (!staff) return err(domainError('FORBIDDEN_ROLE', 403));
      await ctx.tx.paymentReceipt.update({
        where: { id },
        data: {
          rejected_at: await at(ctx.tx),
          rejection_reason: reason.trim(),
          rejected_by_staff_id: staff.id,
        },
      });
      await this.record(ctx, 'PAYMENT_REJECTED', 'manager.payment.rejected.v1', id, studentId, {
        reason: reason.trim(),
      });
      return this.get(ctx.tx, studentId, id);
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async prepare(
    ctx: CriticalContext,
    contactStudentId: string,
    recipientId: string,
    paymentId: string,
    input: PrepareDistribution,
  ): Promise<Result<DistributionView, DomainError>> {
    try {
      if (!positiveReceiptAmount(input.amount)) return err(domainError('INVALID_MONEY', 422));
      const receipt = await ctx.tx.paymentReceipt.findFirst({
        where: { id: paymentId, student_id: contactStudentId },
      });
      if (!receipt) return err(domainError('PAYMENT_NOT_FOUND', 404));
      if (receipt.rejected_at) return err(domainError('PAYMENT_NOT_PENDING', 409));
      const subscription = await this.payments.subscription(
        { ...ctx, operationId: randomUUID() },
        { enrollmentId: input.enrollmentId, saleConditionId: input.planId },
        input.startsAt ? new Date(input.startsAt) : undefined,
      );
      const enrollment = await ctx.tx.studentSubjectEnrollment.findUnique({
        where: { id: subscription.enrollment_id },
        select: { student_id: true },
      });
      if (enrollment?.student_id !== recipientId) return err(domainError('STUDENT_NOT_FOUND', 404));
      const dist = await this.payments.propose(
        { ...ctx, operationId: randomUUID() },
        paymentId,
        { subscriptionId: subscription.id, amount: input.amount },
        true,
      );
      await this.record(
        ctx,
        'PAYMENT_DISTRIBUTION_PROPOSED',
        'manager.payment.distribution-proposed.v1',
        paymentId,
        contactStudentId,
        { distributionId: dist.id, recipientId },
      );
      return ok({
        id: dist.id,
        paymentId,
        studentId: recipientId,
        subscriptionId: subscription.id,
        enrollmentId: subscription.enrollment_id,
        planId: subscription.sale_condition_id,
        amount: dist.amount.toFixed(4),
        currency: dist.currency,
        status: ManagerPaymentStatus.AWAITING_APPROVAL,
        consumed: false,
        ledgerPublicationId: null,
      });
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async distributions(
    tx: Prisma.TransactionClient,
    studentId: string,
    q: ReceiptQuery,
  ): Promise<Result<DistributionPage, DomainError>> {
    try {
      // Only the recipient's allocation is projected, never the contact receipt's total or family balance.
      const confirmed: Prisma.PaymentDistributionWhereInput = {
        approved_at: { not: null },
        payment_ref: { confirmed_by_director_at: { not: null }, rejected_at: null },
        ledger_document: {
          is: { t03_ledgerentry_document_id: { is: { published_at: { not: null } } } },
        },
      };
      const where: Prisma.PaymentDistributionWhereInput = {
        AND: [
          { subscription_ref: { enrollment_ref: { student_id: studentId } } },
          q.status === 'CONFIRMED'
            ? confirmed
            : q.status === 'REJECTED'
              ? { payment_ref: { rejected_at: { not: null } } }
              : q.status === 'PENDING'
                ? { id: { in: [] } }
                : q.status === 'AWAITING_APPROVAL'
                  ? { payment_ref: { rejected_at: null }, NOT: confirmed }
                  : {},
        ],
      };
      const total = await tx.paymentDistribution.count({ where });
      const rows = await tx.paymentDistribution.findMany({
        where,
        include: {
          subscription_ref: true,
          manager_operation: { select: { id: true } },
          ledger_document: { include: { t03_ledgerentry_document_id: true } },
          payment_ref: { select: { confirmed_by_director_at: true, rejected_at: true } },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      });
      const items = rows.map((d) => {
        const entry = d.ledger_document?.t03_ledgerentry_document_id;
        const status = d.payment_ref.rejected_at
          ? ManagerPaymentStatus.REJECTED
          : d.approved_at && d.payment_ref.confirmed_by_director_at && entry?.published_at
            ? ManagerPaymentStatus.CONFIRMED
            : ManagerPaymentStatus.AWAITING_APPROVAL;
        return {
          id: d.id,
          paymentId: d.payment_id,
          studentId,
          subscriptionId: d.subscription_id,
          enrollmentId: d.subscription_ref.enrollment_id,
          planId: d.subscription_ref.sale_condition_id,
          amount: d.amount.toFixed(4),
          currency: d.currency,
          status,
          consumed: !!d.manager_operation,
          ledgerPublicationId: status === 'CONFIRMED' ? entry!.id : null,
        };
      });
      return ok({ items, total, page: q.page, pageSize: q.pageSize });
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async allocate(
    ctx: CriticalContext,
    contactId: string,
    recipientId: string,
    paymentId: string,
    input: AllocateReceipt,
  ): Promise<Result<DistributionView, DomainError>> {
    try {
      if (!positiveReceiptAmount(input.amount)) return err(domainError('INVALID_MONEY', 422));
      const receipt = await ctx.tx.paymentReceipt.findFirst({
        where: { id: paymentId, student_id: contactId },
      });
      if (!receipt) return err(domainError('PAYMENT_NOT_FOUND', 404));
      if (receipt.rejected_at) return err(domainError('PAYMENT_NOT_PENDING', 409));
      const sub = await ctx.tx.subscription.findUnique({
        where: { id: input.subscriptionId },
        include: { enrollment_ref: { select: { student_id: true } } },
      });
      if (!sub || sub.enrollment_ref.student_id !== recipientId)
        return err(domainError('SUBSCRIPTION_NOT_FOUND', 404));
      const dist = await this.payments.propose(
        { ...ctx, operationId: randomUUID() },
        paymentId,
        { subscriptionId: sub.id, amount: input.amount },
        true,
      );
      await this.record(
        ctx,
        'PAYMENT_DISTRIBUTION_PROPOSED',
        'manager.payment.distribution-proposed.v1',
        paymentId,
        contactId,
        { distributionId: dist.id, recipientId },
      );
      return ok({
        id: dist.id,
        paymentId,
        studentId: recipientId,
        subscriptionId: sub.id,
        enrollmentId: sub.enrollment_id,
        planId: sub.sale_condition_id,
        amount: dist.amount.toFixed(4),
        currency: dist.currency,
        status: ManagerPaymentStatus.AWAITING_APPROVAL,
        consumed: false,
        ledgerPublicationId: null,
      });
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async adjustment(
    ctx: CriticalContext,
    input: ManagerAdjustmentCommand,
  ): Promise<Result<{ ledgerPublicationId: string }, DomainError>> {
    try {
      const source = await ctx.tx.entitlementConsumption.findFirst({
        where: {
          id: input.originalConsumptionId,
          subscription_ref: { enrollment_ref: { student_id: input.studentId } },
        },
        include: { subscription_ref: true },
      });
      if (!source) return err(domainError('CHARGE_NOT_FOUND', 404));
      if (source.cancelled_at) return err(domainError('CHARGE_ALREADY_REVERSED', 409));
      const maximum = source.subscription_ref.original_paid_unit_price.mul(source.quantity);
      if (
        (input.amount !== undefined &&
          (!positiveReceiptAmount(input.amount) || new Prisma.Decimal(input.amount).gt(maximum))) ||
        (input.lessons !== undefined &&
          (!Number.isInteger(input.lessons) ||
            (input.lessons < 1 && !(input.lessons === 0 && input.amount !== undefined)) ||
            input.lessons > source.quantity))
      )
        return err(domainError('DISPUTE_REFUND_EXCEEDS_CHARGE', 409));
      // Finance adjustment authority remains DIRECTOR. MGR07 will persist escalation in its task transaction.
      return err(domainError('APPROVAL_REQUIRED', 409));
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
}
