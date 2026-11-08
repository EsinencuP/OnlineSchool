import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { NotificationOutboxPublisher } from '../../notifications/notification-outbox.publisher.js';
import { unwrap } from '../../../core/errors/domain-error.js';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { CriticalContext } from '../../../core/http.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { at } from '../finance-common.js';
import { FinanceAccess } from '../finance-access.service.js';
import { EntitlementsService } from '../entitlements.service.js';
import { subscriptionFailure } from '../manager-subscriptions/finance-facade.js';
import { redactMeet } from '../../schedule/meet-link.js';
export type DisputeSource = {
  consumptionId: string;
  entryId: string;
  grantId: string;
  amount: string;
  quantity: number;
  currency: string;
  cancelled: boolean;
  requiresManualReview: boolean;
};
export type DisputeProposal = {
  kind: 'DISPUTE';
  decision: 'ACCEPT' | 'REJECT' | 'ESCALATE';
  reason: string;
  mode: 'FULL_REVERSAL' | 'MANUAL_REVIEW';
  requestedAmount: string | null;
  requestedLessons: number | null;
  amount: string;
  lessons: number;
  consumptionId: string;
  sourceEntryId: string;
};
export type DisputeResolution = {
  taskId: string;
  version: number;
  status: 'RESOLVED';
  ledgerPublicationId: string;
  refundAmount: string;
  refundLessons: number;
  currency: string;
};
export function disputeOperationId(taskId: string): string {
  const h = createHash('sha256').update(`dispute:${taskId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
@Injectable()
export class DisputeFinanceService {
  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly access: FinanceAccess,
    private readonly audit: AuditService,
  ) {}
  async source(
    tx: Prisma.TransactionClient,
    studentId: string,
    lessonId: string,
    createdAt: Date,
    consumptionId?: string | null,
  ): Promise<Result<DisputeSource, DomainError>> {
    try {
      const rows = await tx.entitlementConsumption.findMany({
        where: {
          ...(consumptionId ? { id: consumptionId } : {}),
          lesson_occurrence_id: lessonId,
          consumed_at: { lte: createdAt },
          OR: [{ cancelled_at: null }, { cancelled_at: { gte: createdAt } }],
          subscription_ref: { enrollment_ref: { student_id: studentId } },
        },
        include: {
          subscription_ref: true,
          ledger_document: { include: { t03_ledgerentry_document_id: true } },
        },
        take: 2,
      });
      if (rows.length !== 1) return err(domainError('DISPUTE_SOURCE_UNAVAILABLE', 409));
      const row = rows[0]!,
        entry = row.ledger_document?.t03_ledgerentry_document_id;
      if (!entry?.published_at || entry.published_at > createdAt || entry.reverses_entry_id)
        return err(domainError('DISPUTE_SOURCE_UNAVAILABLE', 409));
      const reversal = await tx.ledgerEntry.findFirst({
        where: { reverses_entry_id: entry.id, published_at: { not: null } },
        select: { id: true },
      });
      const changed = await tx.entitlementAdjustment.findFirst({
        where: { original_consumption_id: row.id },
        select: { id: true },
      });
      return ok({
        consumptionId: row.id,
        entryId: entry.id,
        grantId: row.grant_id,
        amount: row.subscription_ref.original_paid_unit_price.mul(row.quantity).toFixed(4),
        quantity: row.quantity,
        currency: row.subscription_ref.currency,
        cancelled: row.cancelled_at !== null,
        requiresManualReview: !!reversal || !!changed,
      });
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async approve(
    ctx: CriticalContext,
    id: string,
    version: number,
  ): Promise<Result<DisputeResolution, DomainError>> {
    try {
      await this.access.staff(ctx, true);
      const task = await ctx.tx.crmTask.findUnique({ where: { id } });
      if (!task || task.type !== 'ATTENDANCE_DISPUTE' || !task.student_id || !task.lesson_id)
        return err(domainError('TASK_NOT_FOUND', 404));
      id = task.id;
      if (['RESOLVED', 'REJECTED', 'CANCELLED'].includes(task.status))
        return err(domainError('TASK_ALREADY_RESOLVED', 409));
      if (task.version !== version) return err(domainError('TASK_VERSION_CONFLICT', 409));
      const proposal = task.decision as DisputeProposal | null;
      if (
        task.status !== 'IN_PROGRESS' ||
        !task.escalated_at ||
        proposal?.kind !== 'DISPUTE' ||
        proposal.decision !== 'ACCEPT'
      )
        return err(domainError('APPROVAL_REQUIRED', 409));
      const source = await this.source(
        ctx.tx,
        task.student_id,
        task.lesson_id,
        task.created_at,
        task.original_consumption_id,
      );
      if (!source.ok) return source;
      if (source.value.cancelled) return err(domainError('CHARGE_ALREADY_REVERSED', 409));
      if (proposal.mode !== 'FULL_REVERSAL' || source.value.requiresManualReview)
        return err(domainError('MANUAL_FINANCE_REVIEW_REQUIRED', 409));
      if (
        typeof proposal.amount !== 'string' ||
        !/^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$/.test(proposal.amount) ||
        !new Prisma.Decimal(proposal.amount).eq(source.value.amount) ||
        proposal.lessons !== source.value.quantity ||
        proposal.consumptionId !== source.value.consumptionId ||
        proposal.sourceEntryId !== source.value.entryId
      )
        return err(domainError('DISPUTE_REFUND_EXCEEDS_CHARGE', 409));
      let publication: string | undefined;
      try {
        await this.entitlements.adjust(
          { ...ctx, operationId: disputeOperationId(id) },
          {
            grantId: source.value.grantId,
            originalConsumptionId: source.value.consumptionId,
            kind: 'CONSUMPTION_CANCELLATION',
            reason: `Approved CRM dispute:${id}`,
          },
          (entryId) => {
            publication = entryId;
          },
        );
      } catch (error: unknown) {
        const failure = subscriptionFailure(error);
        return err(failure.retryable ? failure : domainError('LEDGER_PUBLICATION_FAILED', 503));
      }
      if (!publication) return err(domainError('LEDGER_PUBLICATION_FAILED', 503));
      const now = await at(ctx.tx),
        staff = await this.access.staff(ctx, true);
      const changed = await ctx.tx.crmTask.updateMany({
        where: { id, version, status: 'IN_PROGRESS', ledger_publication_id: null },
        data: {
          status: 'RESOLVED',
          version: { increment: 1 },
          resolved_at: now,
          resolved_by_staff_id: staff,
          ledger_publication_id: publication,
          dispute_resolution_key: `dispute:${id}`,
          original_consumption_id: source.value.consumptionId,
        },
      });
      if (changed.count !== 1) return err(domainError('TASK_VERSION_CONFLICT', 409));
      const auditId = randomUUID();
      await this.audit.record(
        {
          id: auditId,
          actor_kind: 'ACCOUNT',
          actor_id: ctx.actor.accountId,
          action: 'TASK_DISPUTE_ACCEPTED',
          resource_type: 'CrmTask',
          resource_id: id,
          result: 'SUCCESS',
          request_id: ctx.requestId,
          source_operation_id: ctx.operationId,
          event_key: `TASK_DISPUTE_ACCEPTED:${id}:${ctx.operationId}`,
          metadata: {
            studentId: task.student_id,
            lessonId: task.lesson_id,
            ledgerPublicationId: publication,
            disputeKey: `dispute:${id}`,
            reason: redactMeet(proposal.reason) as string,
          },
        },
        ctx.tx,
      );
      await ctx.tx.outboxEvent.create({
        data: {
          topic: 'manager.task.decision.v1',
          aggregate_type: 'CrmTask',
          aggregate_id: id,
          audit_event_id: auditId,
          source_operation_id: ctx.operationId,
          event_key: `TASK_DISPUTE_ACCEPTED:${id}:${ctx.operationId}`,
          payload: {
            schemaVersion: 1,
            taskId: id,
            studentId: task.student_id,
            lessonId: task.lesson_id,
            decision: 'ACCEPT',
            status: 'RESOLVED',
            ledgerPublicationId: publication,
          },
        },
      });
      unwrap(
        await new NotificationOutboxPublisher().enqueue(ctx.tx, {
          studentId: task.student_id,
          templateCode: 'DISPUTE_ACCEPTED',
          variables: { taskId: id, lessonId: task.lesson_id },
          dedupeKey: `task:${id}:DISPUTE_ACCEPTED`,
          operationId: ctx.operationId,
          actorId: ctx.actor.accountId,
          requestId: ctx.requestId,
        }),
      );
      return ok({
        taskId: id,
        version: version + 1,
        status: 'RESOLVED',
        ledgerPublicationId: publication,
        refundAmount: source.value.amount,
        refundLessons: source.value.quantity,
        currency: source.value.currency,
      });
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
}
