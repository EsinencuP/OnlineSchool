import { Injectable } from '@nestjs/common';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { DisputeFinanceService } from '../finance/manager-disputes/dispute.service.js';
import { ManagerPaymentWorkflow } from '../finance/manager-payments/workflow.service.js';
import { at, serialize } from '../finance/finance-common.js';
import { PaymentsService } from '../finance/payments.service.js';
import { ManagerScheduleWorkflow } from '../schedule/manager/workflow.service.js';
import type { DecisionResultDto } from './dto/director-commands.dto.js';
import type { DecisionKind } from './dto/director.dto.js';
import { requestView } from '../manager/requests/manager-requests.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (serialize(value) as Record<string, unknown>) : {};

/**
 * Director decisions as thin facades over the existing finance/schedule commands: the same
 * services, rules, audit actions and outbox topics; only the entry point and the result shape differ.
 * Each service re-checks the DIRECTOR role inside the transaction.
 */
@Injectable()
export class DirectorCommandsService {
  constructor(
    private readonly payments: PaymentsService,
    private readonly paymentWorkflow: ManagerPaymentWorkflow,
    private readonly scheduleWorkflow: ManagerScheduleWorkflow,
    private readonly disputes: DisputeFinanceService,
  ) {}

  private async done(
    ctx: CriticalContext,
    kind: DecisionKind,
    id: string,
    outcome: DecisionResultDto['outcome'],
    result: unknown,
  ): Promise<DecisionResultDto> {
    return {
      kind,
      id,
      outcome,
      decidedAt: (await at(ctx.tx)).toISOString(),
      result: asObject(result),
    };
  }

  async confirmPayment(ctx: CriticalContext, id: string): Promise<DecisionResultDto> {
    const result = await this.payments.confirm(ctx, id, {});
    return this.done(ctx, 'PAYMENT', id, 'CONFIRMED', result);
  }

  async rejectPayment(
    ctx: CriticalContext,
    id: string,
    reason: string,
  ): Promise<DecisionResultDto> {
    if (!UUID_RE.test(id)) return fail(domainError('PAYMENT_NOT_FOUND', 404));
    const receipt = await ctx.tx.paymentReceipt.findUnique({
      where: { id },
      select: { student_id: true },
    });
    if (!receipt?.student_id) return fail(domainError('PAYMENT_NOT_FOUND', 404));
    const result = unwrap(
      await this.paymentWorkflow.reject(ctx, receipt.student_id, id, reason, true),
    );
    return this.done(ctx, 'PAYMENT', id, 'REJECTED', result);
  }

  async approveDistribution(ctx: CriticalContext, id: string): Promise<DecisionResultDto> {
    const result = await this.payments.approve(ctx, id, {});
    return this.done(ctx, 'DISTRIBUTION', id, 'APPROVED', result);
  }

  async approveScheduleException(ctx: CriticalContext, id: string): Promise<DecisionResultDto> {
    if (!UUID_RE.test(id)) return fail(domainError('CHANGE_REQUEST_NOT_FOUND', 404));
    const result = unwrap(await this.scheduleWorkflow.approve(ctx, id));
    return this.done(ctx, 'SCHEDULE_EXCEPTION', id, 'APPROVED', result);
  }

  private async pendingRequest(ctx: CriticalContext, id: string) {
    if (!UUID_RE.test(id)) return fail(domainError('REQUEST_NOT_FOUND', 404));
    if (!ctx.actor.roles.includes('DIRECTOR')) return fail(domainError('FORBIDDEN_ROLE', 403));
    const [director] = await ctx.tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM staff_accounts WHERE account_id=${ctx.actor.accountId}::uuid AND deactivated_at IS NULL`;
    if (!director) return fail(domainError('FORBIDDEN_ROLE', 403));
    // The row lock serialises a decision with the manager withdrawing the same request.
    await ctx.tx.$queryRaw`SELECT id FROM manager_requests WHERE id=${id}::uuid FOR UPDATE`;
    const request = await ctx.tx.managerRequest.findUnique({ where: { id } });
    if (!request) return fail(domainError('REQUEST_NOT_FOUND', 404));
    if (request.status !== 'PENDING') return fail(domainError('REQUEST_NOT_PENDING', 409));
    return { director: director.id, request };
  }

  async approveRequest(
    ctx: CriticalContext,
    id: string,
    input: { maxLessons?: number; expiresAt?: string; note?: string },
  ): Promise<DecisionResultDto> {
    const { director, request } = await this.pendingRequest(ctx, id);
    const kind: DecisionKind =
      request.kind === 'TEMPORARY_ACCESS' ? 'TEMPORARY_ACCESS' : 'REFUND_REQUEST';
    let permissionId: string | null = null;
    if (request.kind === 'TEMPORARY_ACCESS') {
      const lessons = input.maxLessons ?? request.proposed_lessons;
      const expires = input.expiresAt ?? request.proposed_until?.toISOString();
      if (!lessons || !expires) return fail(domainError('LIMIT_AND_EXPIRY_REQUIRED', 422));
      const permission = (await this.payments.temporary(ctx, {
        subscriptionId: request.subscription_id,
        grantedLessonsCount: lessons,
        expiresAt: expires,
        basis: (input.note ?? `Family request: ${request.reason}`).slice(0, 500),
      })) as { id: string };
      permissionId = permission.id;
    } else if (input.maxLessons !== undefined || input.expiresAt !== undefined)
      return fail(domainError('INVALID_INPUT', 422));
    const decidedAt = await at(ctx.tx);
    const updated = await ctx.tx.managerRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        decided_by_id: director,
        decided_at: decidedAt,
        decision_note: input.note?.trim() ?? null,
        permission_id: permissionId,
      },
    });
    return this.done(ctx, kind, id, 'APPROVED', requestView(updated));
  }

  async declineRequest(
    ctx: CriticalContext,
    id: string,
    reason: string,
  ): Promise<DecisionResultDto> {
    const { director, request } = await this.pendingRequest(ctx, id);
    const kind: DecisionKind =
      request.kind === 'TEMPORARY_ACCESS' ? 'TEMPORARY_ACCESS' : 'REFUND_REQUEST';
    const updated = await ctx.tx.managerRequest.update({
      where: { id },
      data: {
        status: 'DECLINED',
        decided_by_id: director,
        decided_at: await at(ctx.tx),
        decision_note: reason.trim(),
      },
    });
    return this.done(ctx, kind, id, 'DECLINED', requestView(updated));
  }

  async approveDispute(
    ctx: CriticalContext,
    id: string,
    version: number,
  ): Promise<DecisionResultDto> {
    if (!UUID_RE.test(id)) return fail(domainError('TASK_NOT_FOUND', 404));
    const result = unwrap(await this.disputes.approve(ctx, id, version));
    return this.done(ctx, 'DISPUTE', id, 'APPROVED', result);
  }
}
