import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { err } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { ManagerPaymentWorkflow } from '../../finance/manager-payments/workflow.service.js';
import { ManagerLessonRights } from '../../finance/manager-payments/lesson-rights.service.js';
import { DisputeFinanceService } from '../../finance/manager-disputes/dispute.service.js';
import type { DisputeSource } from '../../finance/manager-disputes/dispute.service.js';
import type { DeductLesson } from '../../schedule/manager/contracts.js';
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
} from '../../finance/manager-payments/contracts.js';
import { ManagerSubscriptionLifecycle } from '../../finance/manager-subscriptions/lifecycle.service.js';
import type {
  SubscriptionView,
  CreateSubscription,
  RenewSubscription,
  FreezeSubscription,
} from '../../finance/manager-subscriptions/contracts.js';
import { subscriptionFailure } from '../../finance/manager-subscriptions/finance-facade.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerContext } from '../context/manager-context.js';
@Injectable()
export class ManagerFinanceFacade {
  constructor(
    private readonly payments: ManagerPaymentWorkflow,
    private readonly lifecycle: ManagerSubscriptionLifecycle,
    private readonly scope: ManagerScopeService,
    private readonly lessonRights: ManagerLessonRights,
    private readonly disputes: DisputeFinanceService,
  ) {}
  private async authorize(
    ctx: ManagerContext,
    studentId: string,
    command: CriticalContext,
  ): Promise<Result<void, DomainError>> {
    const current = await this.scope.resolveContext(
      { ...command.actor, requestId: command.requestId },
      command.tx,
    );
    if (!current.ok) return current;
    if (current.value.accountId !== ctx.accountId || current.value.managerId !== ctx.managerId)
      return err(domainError('FORBIDDEN_ROLE', 403));
    return this.scope.assertStudentInPortfolio(current.value, studentId, command.tx);
  }
  private async receiptScope(
    ctx: ManagerContext,
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Result<string, DomainError>> {
    const contact = await this.payments.contact(tx, id);
    if (!contact.ok) return contact;
    const allowed = await this.scope.assertStudentInPortfolio(ctx, contact.value, tx);
    return allowed.ok
      ? contact
      : err(
          allowed.error.code === 'STUDENT_NOT_FOUND'
            ? domainError('PAYMENT_NOT_FOUND', 404)
            : allowed.error,
        );
  }
  async getPayment(
    ctx: ManagerContext,
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Result<ReceiptView, DomainError>> {
    const c = await this.receiptScope(ctx, id, tx);
    return c.ok ? this.payments.get(tx, c.value, id) : c;
  }
  async listPayments(
    ctx: ManagerContext,
    studentId: string,
    q: ReceiptQuery,
    tx: Prisma.TransactionClient,
  ): Promise<Result<ReceiptPage, DomainError>> {
    const s = await this.scope.assertStudentInPortfolio(ctx, studentId, tx);
    return s.ok ? this.payments.list(tx, studentId, q) : s;
  }
  async createPayment(
    ctx: ManagerContext,
    studentId: string,
    input: CreateReceipt,
    command: CriticalContext,
  ): Promise<Result<ReceiptView, DomainError>> {
    const s = await this.authorize(ctx, studentId, command);
    return s.ok ? this.payments.create(command, studentId, input) : s;
  }
  async publishPayment(
    ctx: ManagerContext,
    id: string,
    command: CriticalContext,
  ): Promise<Result<ReceiptView, DomainError>> {
    const c = await this.receiptScope(ctx, id, command.tx);
    if (!c.ok) return c;
    const s = await this.authorize(ctx, c.value, command);
    return s.ok ? this.payments.publishPayment(command, c.value, id) : s;
  }
  async rejectPayment(
    ctx: ManagerContext,
    id: string,
    reason: string,
    command: CriticalContext,
  ): Promise<Result<ReceiptView, DomainError>> {
    const c = await this.receiptScope(ctx, id, command.tx);
    if (!c.ok) return c;
    const s = await this.authorize(ctx, c.value, command);
    return s.ok ? this.payments.reject(command, c.value, id, reason) : s;
  }
  async prepareDistribution(
    ctx: ManagerContext,
    id: string,
    input: PrepareDistribution,
    command: CriticalContext,
  ): Promise<Result<DistributionView, DomainError>> {
    try {
      const c = await this.receiptScope(ctx, id, command.tx);
      if (!c.ok) return c;
      const target = await command.tx.studentSubjectEnrollment.findUnique({
        where: { id: input.enrollmentId },
        select: { student_id: true },
      });
      if (!target) return err(domainError('STUDENT_NOT_FOUND', 404));
      const allowed = await this.authorize(ctx, target.student_id, command);
      return allowed.ok
        ? this.payments.prepare(command, c.value, target.student_id, id, input)
        : allowed;
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async allocatePayment(
    ctx: ManagerContext,
    id: string,
    input: AllocateReceipt,
    command: CriticalContext,
  ): Promise<Result<DistributionView, DomainError>> {
    try {
      const c = await this.receiptScope(ctx, id, command.tx);
      if (!c.ok) return c;
      const target = await command.tx.subscription.findUnique({
        where: { id: input.subscriptionId },
        select: { enrollment_ref: { select: { student_id: true } } },
      });
      if (!target) return err(domainError('SUBSCRIPTION_NOT_FOUND', 404));
      const allowed = await this.authorize(ctx, target.enrollment_ref.student_id, command);
      return allowed.ok
        ? this.payments.allocate(command, c.value, target.enrollment_ref.student_id, id, input)
        : allowed;
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async listDistributions(
    ctx: ManagerContext,
    studentId: string,
    q: ReceiptQuery,
    tx: Prisma.TransactionClient,
  ): Promise<Result<DistributionPage, DomainError>> {
    const s = await this.scope.assertStudentInPortfolio(ctx, studentId, tx);
    return s.ok ? this.payments.distributions(tx, studentId, q) : s;
  }
  async publishAdjustment(
    ctx: ManagerContext,
    cmd: ManagerAdjustmentCommand,
    command: CriticalContext,
  ): Promise<Result<{ ledgerPublicationId: string }, DomainError>> {
    const s = await this.authorize(ctx, cmd.studentId, command);
    return s.ok ? this.payments.adjustment(command, cmd) : s;
  }
  async disputeSource(
    ctx: ManagerContext,
    studentId: string,
    lessonId: string,
    createdAt: Date,
    consumptionId: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<Result<DisputeSource, DomainError>> {
    const s = await this.scope.assertStudentInPortfolio(ctx, studentId, tx);
    return s.ok ? this.disputes.source(tx, studentId, lessonId, createdAt, consumptionId) : s;
  }
  async publishDeduction(
    ctx: ManagerContext,
    cmd: DeductLesson,
    command: CriticalContext,
  ): Promise<Result<{ ledgerPublicationId: string }, DomainError>> {
    const allowed = await this.authorize(ctx, cmd.studentId, command);
    return allowed.ok ? this.lessonRights.deduct(command, cmd) : allowed;
  }
  async subscriptionCreate(
    ctx: ManagerContext,
    studentId: string,
    input: CreateSubscription,
    command: CriticalContext,
  ): Promise<Result<SubscriptionView, DomainError>> {
    const s = await this.authorize(ctx, studentId, command);
    return s.ok ? this.lifecycle.create(command, ctx, studentId, input) : s;
  }
  private async subscriptionScope(
    ctx: ManagerContext,
    id: string,
    command: CriticalContext,
  ): Promise<Result<void, DomainError>> {
    try {
      const row = await command.tx.managerSubscription.findUnique({
        where: { id },
        select: { enrollment_ref: { select: { student_id: true } } },
      });
      if (!row) return err(domainError('SUBSCRIPTION_NOT_FOUND', 404));
      const s = await this.authorize(ctx, row.enrollment_ref.student_id, command);
      return !s.ok && s.error.code === 'STUDENT_NOT_FOUND'
        ? err(domainError('SUBSCRIPTION_NOT_FOUND', 404))
        : s;
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async subscriptionRenew(
    ctx: ManagerContext,
    id: string,
    input: RenewSubscription,
    command: CriticalContext,
  ): Promise<Result<SubscriptionView, DomainError>> {
    const s = await this.subscriptionScope(ctx, id, command);
    return s.ok ? this.lifecycle.renew(command, ctx, id, input) : s;
  }
  async subscriptionFreeze(
    ctx: ManagerContext,
    id: string,
    input: FreezeSubscription,
    command: CriticalContext,
  ): Promise<Result<SubscriptionView, DomainError>> {
    const s = await this.subscriptionScope(ctx, id, command);
    return s.ok ? this.lifecycle.freeze(command, ctx, id, input) : s;
  }
  async subscriptionUnfreeze(
    ctx: ManagerContext,
    id: string,
    command: CriticalContext,
  ): Promise<Result<SubscriptionView, DomainError>> {
    const s = await this.subscriptionScope(ctx, id, command);
    return s.ok ? this.lifecycle.unfreeze(command, ctx, id) : s;
  }
  async listSubscriptions(
    ctx: ManagerContext,
    studentId: string,
    tx: Prisma.TransactionClient,
  ): Promise<Result<SubscriptionView[], DomainError>> {
    const s = await this.scope.assertStudentInPortfolio(ctx, studentId, tx);
    return s.ok ? this.lifecycle.list(tx, studentId) : s;
  }
}
