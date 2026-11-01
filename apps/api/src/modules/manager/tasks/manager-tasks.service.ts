import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NotificationOutboxPublisher } from '../../notifications/notification-outbox.publisher.js';
import { isISO8601 } from 'class-validator';
import { Prisma } from '@online-school/db';
import type { CrmTaskStatus as StoredStatus } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { UUID } from '../../../core/http.js';
import { INSTANT } from '../../schedule/manager/policy.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import { at } from '../../finance/finance-common.js';
import { subscriptionFailure } from '../../finance/manager-subscriptions/finance-facade.js';
import { redactMeet } from '../../schedule/meet-link.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerContext } from '../context/manager-context.js';
import { ManagerFinanceFacade } from '../finance/manager-finance.facade.js';
import { ManagerScheduleService } from '../schedule/manager-schedule.service.js';
import type { DisputeProposal } from '../../finance/manager-disputes/dispute.service.js';
import { positiveReceiptAmount } from '../../finance/receipt-policy.js';
import { TYPE_STORAGE } from './contracts.js';
import type {
  TaskView,
  TaskPayload,
  TaskQuery,
  TaskDetail,
  TaskPage,
  ResolveTaskDispute,
  ResolveTaskReschedule,
} from './contracts.js';
import { readTaskCursor, writeTaskCursor } from './task-cursor.js';
import { taskPortfolioWhere, taskOverdueWhere } from './task-read.spec.js';
const include = {
  lead: { select: { id: true, full_name: true } },
  student: { select: { full_name: true } },
  lesson: {
    select: { id: true, scheduled_at: true, enrollment_ref: { select: { student_id: true } } },
  },
} as const;
type Row = Prisma.CrmTaskGetPayload<{ include: typeof include }>;
const closed = (status: string) => ['RESOLVED', 'REJECTED', 'CANCELLED'].includes(status);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (v: unknown, max = 1000) => (typeof v === 'string' ? v.slice(0, max) : '');
const windows = (value: unknown): { from: string; to: string }[] =>
  Array.isArray(value)
    ? value.flatMap((v) => {
        const p = obj(v);
        return typeof p.from === 'string' &&
          typeof p.to === 'string' &&
          INSTANT.test(p.from) &&
          INSTANT.test(p.to) &&
          isISO8601(p.from, { strict: true }) &&
          isISO8601(p.to, { strict: true }) &&
          new Date(p.from) < new Date(p.to)
          ? [{ from: new Date(p.from).toISOString(), to: new Date(p.to).toISOString() }]
          : [];
      })
    : [];
@Injectable()
export class ManagerTasksService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly scope: ManagerScopeService,
    private readonly finance: ManagerFinanceFacade,
    private readonly schedule: ManagerScheduleService,
    private readonly audit: AuditService,
  ) {}
  private where(ctx: ManagerContext): Prisma.CrmTaskWhereInput {
    return taskPortfolioWhere(
      this.scope.portfolioWhere(ctx),
      this.scope.leadWhere(ctx),
      ctx.managerId,
    );
  }
  async find(
    ctx: ManagerContext,
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Result<Row, DomainError>> {
    try {
      const row = await tx.crmTask.findFirst({
        where: { AND: [{ id }, this.where(ctx)] },
        include,
      });
      if (
        !row ||
        (!row.lead_id && (!row.student_id || !row.student)) ||
        (row.lesson && row.lesson.enrollment_ref.student_id !== row.student_id)
      )
        return err(domainError('TASK_NOT_FOUND', 404));
      if (row.student_id) {
        const allowed = await this.scope.assertStudentInPortfolio(ctx, row.student_id, tx);
        if (!allowed.ok) return err(domainError('TASK_NOT_FOUND', 404));
      }
      return ok(row);
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  private async authorize(
    ctx: ManagerContext,
    c: CriticalContext,
  ): Promise<Result<void, DomainError>> {
    const r = await this.scope.resolveContext({ ...c.actor, requestId: c.requestId }, c.tx);
    return !r.ok
      ? r
      : r.value.managerId === ctx.managerId && r.value.accountId === ctx.accountId
        ? ok(undefined)
        : err(domainError('FORBIDDEN_ROLE', 403));
  }
  private async project(
    ctx: ManagerContext,
    row: Row,
    tx: Prisma.TransactionClient,
    now: Date,
  ): Promise<Result<TaskView, DomainError>> {
    try {
      const payload = obj(row.payload),
        decision = obj(row.decision);
      let data: TaskPayload;
      if (row.type === 'LEAD_FOLLOWUP' || row.type === 'ASSIGN_TEACHER') {
        if (!row.lead_id || !row.lead) return err(domainError('TASK_NOT_FOUND', 404));
        data = { kind: row.type, leadId: row.lead_id };
      } else if (row.type === 'RESCHEDULE_REQUEST') {
        if (!row.lesson) return err(domainError('TASK_NOT_FOUND', 404));
        data = {
          kind: 'RESCHEDULE_REQUEST',
          lessonId: row.lesson.id,
          currentStartsAt: row.lesson.scheduled_at.toISOString(),
          studentComment: typeof payload.reason === 'string' ? text(payload.reason, 500) : null,
          preferredWindows: windows(payload.preferredWindows),
          preferredDate:
            typeof payload.preferredDate === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(payload.preferredDate)
              ? payload.preferredDate
              : null,
        };
      } else if (row.type === 'ATTENDANCE_DISPUTE') {
        if (!row.lesson) return err(domainError('TASK_NOT_FOUND', 404));
        const source = await this.finance.disputeSource(
          ctx,
          row.student_id!,
          row.lesson.id,
          row.created_at,
          row.original_consumption_id,
          tx,
        );
        if (!source.ok && source.error.status >= 500) return source;
        data = {
          kind: 'CHARGE_DISPUTE',
          lessonId: row.lesson.id,
          ledgerRef: source.ok ? source.value.entryId : null,
          chargedLessons: source.ok ? source.value.quantity : 0,
          chargedAmount: source.ok ? source.value.amount : null,
          currency: source.ok ? source.value.currency : null,
          studentComment: text(payload.description),
        };
      } else if (row.type === 'SUBSCRIPTION_EXPIRING') {
        if (typeof payload.subscriptionId !== 'string' || !UUID.test(payload.subscriptionId))
          return err(domainError('TASK_NOT_FOUND', 404));
        const sub = await tx.managerSubscription.findFirst({
          where: { id: payload.subscriptionId, enrollment_ref: { student_id: row.student_id! } },
        });
        if (!sub) return err(domainError('TASK_NOT_FOUND', 404));
        data = {
          kind: 'SUBSCRIPTION_EXPIRING',
          subscriptionId: sub.id,
          endsAt: sub.ends_at.toISOString(),
        };
      } else {
        data = {
          kind: 'GENERAL',
          text: typeof payload.text === 'string' ? payload.text : row.title,
        };
      }
      const status = row.status === 'CANCELLED' ? 'REJECTED' : row.status;
      const approvalStatus =
        closed(row.status) || !row.escalated_at
          ? 'NONE'
          : decision.kind === 'RESCHEDULE'
            ? 'AWAITING_SCHEDULE_APPROVAL'
            : decision.mode === 'FULL_REVERSAL'
              ? 'AWAITING_DIRECTOR'
              : 'MANUAL_FINANCE_REVIEW';
      return ok({
        taskId: row.id,
        type: data.kind,
        status,
        version: row.version,
        studentId: row.student_id,
        leadId: row.lead_id ?? null,
        studentName: row.student?.full_name ?? row.lead?.full_name ?? '',
        createdAt: row.created_at.toISOString(),
        dueAt: row.due_at.toISOString(),
        isOverdue: !closed(row.status) && row.due_at < now,
        escalatedAt: row.escalated_at?.toISOString() ?? null,
        approvalStatus,
        payload: data,
        ledgerPublicationId: row.ledger_publication_id,
      });
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  get(ctx: ManagerContext, id: string): Promise<Result<TaskDetail, DomainError>> {
    return this.transactions.runResult(async (tx) => {
      const row = await this.find(ctx, id, tx);
      if (!row.ok) return row;
      const view = await this.project(ctx, row.value, tx, await at(tx));
      if (!view.ok) return view;
      const d = obj(row.value.decision),
        resolution: Record<string, unknown> = {};
      for (const key of [
        'kind',
        'decision',
        'reason',
        'mode',
        'requestedAmount',
        'requestedLessons',
        'amount',
        'lessons',
        'changeRequestId',
        'newStartsAt',
        'newTeacherId',
      ])
        if (d[key] !== undefined) resolution[key] = d[key];
      return ok({ ...view.value, resolution: Object.keys(resolution).length ? resolution : null });
    });
  }
  list(ctx: ManagerContext, q: TaskQuery): Promise<Result<TaskPage, DomainError>> {
    return this.transactions.runResult(async (tx) => {
      const cursor = unwrap(readTaskCursor(ctx, q, await at(tx))),
        conditions: Prisma.CrmTaskWhereInput[] = [this.where(ctx)];
      if (q.studentId) {
        const allowed = await this.scope.assertStudentInPortfolio(ctx, q.studentId, tx);
        if (!allowed.ok) return allowed;
        conditions.push({ student_id: q.studentId });
      }
      if (q.type?.length) conditions.push({ type: { in: q.type.map((t) => TYPE_STORAGE[t]) } });
      if (q.status?.length) {
        const statuses: StoredStatus[] = q.status.flatMap((s) =>
          s === 'REJECTED' ? ['REJECTED', 'CANCELLED'] : [s],
        ) as StoredStatus[];
        conditions.push({ status: { in: statuses } });
      }
      if (q.dueBefore) conditions.push({ due_at: { lt: new Date(q.dueBefore) } });
      if (q.overdue === true) conditions.push(taskOverdueWhere(cursor.now));
      if (q.overdue === false)
        conditions.push({
          OR: [
            { due_at: { gte: cursor.now } },
            { status: { in: ['RESOLVED', 'REJECTED', 'CANCELLED'] } },
          ],
        });
      if (cursor.id)
        conditions.push({
          OR: [{ due_at: { gt: cursor.dueAt! } }, { due_at: cursor.dueAt!, id: { gt: cursor.id } }],
        });
      const rows = await tx.crmTask.findMany({
          where: { AND: conditions },
          include,
          orderBy: [{ due_at: 'asc' }, { id: 'asc' }],
          take: q.limit + 1,
        }),
        items: TaskView[] = [];
      for (const row of rows.slice(0, q.limit)) {
        if (
          (!row.lead_id && (!row.student_id || !row.student)) ||
          (row.lesson && row.lesson.enrollment_ref.student_id !== row.student_id)
        )
          continue;
        const p = await this.project(ctx, row, tx, cursor.now);
        if (!p.ok) {
          if (p.error.code === 'TASK_NOT_FOUND') continue;
          return p;
        }
        items.push(p.value);
      }
      const last = rows[q.limit - 1],
        nextCursor =
          rows.length > q.limit && last
            ? unwrap(writeTaskCursor(ctx, q, cursor, last.id, last.due_at))
            : null;
      return ok({ items, nextCursor });
    });
  }
  private check(row: Row, version: number, type?: string): Result<void, DomainError> {
    if (closed(row.status)) return err(domainError('TASK_ALREADY_RESOLVED', 409));
    if (type && row.type !== type) return err(domainError('TASK_TYPE_MISMATCH', 409));
    if (row.version !== version) return err(domainError('TASK_VERSION_CONFLICT', 409));
    if (row.status !== 'IN_PROGRESS') return err(domainError('TASK_NOT_IN_PROGRESS', 409));
    return ok(undefined);
  }
  private async record(
    ctx: CriticalContext,
    row: Row,
    action: string,
    metadata: Prisma.InputJsonObject,
    decision = false,
  ): Promise<Result<void, DomainError>> {
    try {
      const id = randomUUID(),
        data = redactMeet(metadata) as Prisma.InputJsonObject;
      await this.audit.record(
        {
          id,
          actor_kind: 'ACCOUNT',
          actor_id: ctx.actor.accountId,
          action,
          resource_type: 'CrmTask',
          resource_id: row.id,
          request_id: ctx.requestId,
          result: 'SUCCESS',
          source_operation_id: ctx.operationId,
          event_key: `${action}:${row.id}:${ctx.operationId}`,
          metadata: { studentId: row.student_id!, lessonId: row.lesson_id, ...data },
        },
        ctx.tx,
      );
      await ctx.tx.outboxEvent.create({
        data: {
          topic: decision ? 'manager.task.decision.v1' : 'manager.task.changed.v1',
          aggregate_type: 'CrmTask',
          aggregate_id: row.id,
          audit_event_id: id,
          source_operation_id: ctx.operationId,
          event_key: `${action}:${row.id}:${ctx.operationId}`,
          payload: {
            schemaVersion: 1,
            taskId: row.id,
            studentId: row.student_id!,
            lessonId: row.lesson_id,
            action,
            ...data,
          },
        },
      });
      const templateCode =
        action === 'TASK_RESCHEDULE_DECLINED'
          ? 'RESCHEDULE_DECLINED'
          : action === 'TASK_DISPUTE_REJECTED'
            ? 'DISPUTE_REJECTED'
            : null;
      if (templateCode && row.student_id && row.lesson_id)
        unwrap(
          await new NotificationOutboxPublisher().enqueue(ctx.tx, {
            studentId: row.student_id,
            templateCode,
            variables: { taskId: row.id, lessonId: row.lesson_id },
            dedupeKey: `task:${row.id}:${templateCode}`,
            operationId: ctx.operationId,
            actorId: ctx.actor.accountId,
            requestId: ctx.requestId,
          }),
        );
      return ok(undefined);
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  private async update(
    ctx: CriticalContext,
    row: Row,
    data: Prisma.CrmTaskUncheckedUpdateManyInput,
  ): Promise<Result<Row, DomainError>> {
    const change = await ctx.tx.crmTask.updateMany({
      where: { id: row.id, version: row.version, status: row.status },
      data: { ...data, version: { increment: 1 } },
    });
    if (change.count !== 1) return err(domainError('TASK_VERSION_CONFLICT', 409));
    // The shared Schedule command may have changed the related lesson projection.
    const next = await ctx.tx.crmTask.findUnique({ where: { id: row.id }, include });
    return next ? ok(next) : err(domainError('TASK_NOT_FOUND', 404));
  }
  async claim(
    ctx: ManagerContext,
    id: string,
    version: number,
    c: CriticalContext,
  ): Promise<Result<TaskView, DomainError>> {
    try {
      unwrap(await this.authorize(ctx, c));
      const row = unwrap(await this.find(ctx, id, c.tx));
      if (closed(row.status)) return err(domainError('TASK_ALREADY_RESOLVED', 409));
      if (row.version !== version || row.status !== 'OPEN')
        return err(domainError('TASK_VERSION_CONFLICT', 409));
      const next = unwrap(
        await this.update(c, row, { status: 'IN_PROGRESS', assigned_manager_id: ctx.managerId }),
      );
      unwrap(await this.record(c, row, 'TASK_CLAIMED', { version: next.version }));
      return this.project(ctx, next, c.tx, await at(c.tx));
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async resolveReschedule(
    ctx: ManagerContext,
    id: string,
    input: ResolveTaskReschedule,
    c: CriticalContext,
  ): Promise<Result<TaskView, DomainError>> {
    try {
      unwrap(await this.authorize(ctx, c));
      const row = unwrap(await this.find(ctx, id, c.tx));
      unwrap(this.check(row, input.version, 'RESCHEDULE_REQUEST'));
      if (!row.lesson) return err(domainError('TASK_NOT_FOUND', 404));
      const now = await at(c.tx);
      const reason =
        input.reason?.trim() || (input.decision === 'APPROVE' ? 'Одобрение запроса ученика' : '');
      if (reason.length < 3 || reason.length > 500) return err(domainError('INVALID_INPUT', 422));
      if (input.decision === 'DECLINE') {
        const next = unwrap(
          await this.update(c, row, {
            status: 'REJECTED',
            resolved_at: now,
            resolved_by_staff_id: ctx.managerId,
            decision: { kind: 'RESCHEDULE', decision: 'DECLINE', reason },
          }),
        );
        unwrap(
          await this.record(
            c,
            row,
            'TASK_RESCHEDULE_DECLINED',
            { decision: 'DECLINE', reason, status: 'REJECTED' },
            true,
          ),
        );
        return this.project(ctx, next, c.tx, now);
      }
      if (!input.newStartsAt) return err(domainError('INVALID_INPUT', 422));
      const lesson = unwrap(
        await this.schedule.reschedule(
          ctx,
          row.lesson.id,
          {
            newStartsAt: input.newStartsAt,
            ...(input.newTeacherId === undefined ? {} : { newTeacherId: input.newTeacherId }),
            reason,
            ...(input.overrideLateRule === undefined
              ? {}
              : { overrideLateRule: input.overrideLateRule }),
            initiator: 'STUDENT',
          },
          c,
        ),
      );
      const pending = lesson.requiresApproval,
        decision = {
          kind: 'RESCHEDULE',
          decision: 'APPROVE',
          reason,
          newStartsAt: input.newStartsAt,
          newTeacherId: input.newTeacherId ?? null,
          changeRequestId: lesson.pendingChangeId,
        };
      const next = unwrap(
        await this.update(c, row, {
          ...(pending
            ? { escalated_at: row.escalated_at ?? now }
            : { status: 'RESOLVED', resolved_at: now, resolved_by_staff_id: ctx.managerId }),
          decision,
        }),
      );
      unwrap(
        await this.record(
          c,
          row,
          pending ? 'TASK_RESCHEDULE_ESCALATED' : 'TASK_RESCHEDULE_APPROVED',
          {
            decision: 'APPROVE',
            status: pending ? 'IN_PROGRESS' : 'RESOLVED',
            changeRequestId: lesson.pendingChangeId,
            newStartsAt: lesson.startsAt,
          },
          true,
        ),
      );
      return this.project(ctx, next, c.tx, now);
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
  async resolveDispute(
    ctx: ManagerContext,
    id: string,
    input: ResolveTaskDispute,
    c: CriticalContext,
  ): Promise<Result<TaskView, DomainError>> {
    try {
      unwrap(await this.authorize(ctx, c));
      const row = unwrap(await this.find(ctx, id, c.tx));
      unwrap(this.check(row, input.version, 'ATTENDANCE_DISPUTE'));
      const reason = input.reason.trim(),
        now = await at(c.tx);
      if (reason.length < 3 || reason.length > 1000) return err(domainError('INVALID_INPUT', 422));
      if (input.decision === 'REJECT') {
        const next = unwrap(
          await this.update(c, row, {
            status: 'REJECTED',
            resolved_at: now,
            resolved_by_staff_id: ctx.managerId,
            decision: { kind: 'DISPUTE', decision: 'REJECT', reason },
          }),
        );
        unwrap(
          await this.record(
            c,
            row,
            'TASK_DISPUTE_REJECTED',
            { decision: 'REJECT', reason, status: 'REJECTED' },
            true,
          ),
        );
        return this.project(ctx, next, c.tx, now);
      }
      if (!row.lesson) return err(domainError('TASK_NOT_FOUND', 404));
      if (input.decision === 'ESCALATE') {
        const next = unwrap(
          await this.update(c, row, {
            escalated_at: row.escalated_at ?? now,
            decision: { kind: 'DISPUTE', decision: 'ESCALATE', reason, mode: 'MANUAL_REVIEW' },
          }),
        );
        unwrap(
          await this.record(
            c,
            row,
            'TASK_DISPUTE_ESCALATED',
            {
              decision: 'ESCALATE',
              reason,
              status: 'IN_PROGRESS',
              approvalStatus: 'MANUAL_FINANCE_REVIEW',
            },
            true,
          ),
        );
        return this.project(ctx, next, c.tx, now);
      }
      if (input.refundAmount === undefined && !(input.refundLessons && input.refundLessons > 0))
        return err(domainError('REFUND_REQUIRED', 422));
      const source = unwrap(
        await this.finance.disputeSource(
          ctx,
          row.student_id!,
          row.lesson.id,
          row.created_at,
          row.original_consumption_id,
          c.tx,
        ),
      );
      if (source.cancelled) return err(domainError('CHARGE_ALREADY_REVERSED', 409));
      if (
        (input.refundAmount !== undefined &&
          (!positiveReceiptAmount(input.refundAmount) ||
            new Prisma.Decimal(input.refundAmount).gt(source.amount))) ||
        (input.refundLessons !== undefined &&
          (!Number.isInteger(input.refundLessons) ||
            input.refundLessons < 0 ||
            input.refundLessons > source.quantity))
      )
        return err(domainError('DISPUTE_REFUND_EXCEEDS_CHARGE', 409));
      const check = await this.finance.publishAdjustment(
        ctx,
        {
          studentId: row.student_id!,
          originalConsumptionId: source.consumptionId,
          reason,
          ...(input.refundAmount === undefined ? {} : { amount: input.refundAmount }),
          ...(input.refundLessons === undefined ? {} : { lessons: input.refundLessons }),
        },
        c,
      );
      if (check.ok) return err(domainError('FINANCE_POLICY_CONFIGURATION_ERROR', 503));
      if (check.error.code !== 'APPROVAL_REQUIRED') return check;
      const full =
        !source.requiresManualReview &&
        (input.refundAmount === undefined ||
          new Prisma.Decimal(input.refundAmount).eq(source.amount)) &&
        (input.refundLessons === undefined || input.refundLessons === source.quantity);
      const proposal: DisputeProposal = {
        kind: 'DISPUTE',
        decision: 'ACCEPT',
        reason,
        mode: full ? 'FULL_REVERSAL' : 'MANUAL_REVIEW',
        requestedAmount: input.refundAmount ?? null,
        requestedLessons: input.refundLessons ?? null,
        amount: source.amount,
        lessons: source.quantity,
        consumptionId: source.consumptionId,
        sourceEntryId: source.entryId,
      };
      const next = unwrap(
        await this.update(c, row, {
          escalated_at: row.escalated_at ?? now,
          decision: proposal,
          original_consumption_id: source.consumptionId,
          dispute_resolution_key: `dispute:${row.id}`,
        }),
      );
      unwrap(
        await this.record(
          c,
          row,
          'TASK_DISPUTE_ESCALATED',
          {
            decision: 'ACCEPT',
            reason,
            status: 'IN_PROGRESS',
            approvalStatus: full ? 'AWAITING_DIRECTOR' : 'MANUAL_FINANCE_REVIEW',
            consumptionId: source.consumptionId,
            sourceEntryId: source.entryId,
          },
          true,
        ),
      );
      return this.project(ctx, next, c.tx, now);
    } catch (error: unknown) {
      return err(subscriptionFailure(error));
    }
  }
}
