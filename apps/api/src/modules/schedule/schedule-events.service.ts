import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import type { CriticalContext } from '../../core/http.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { at } from '../finance/finance-common.js';

@Injectable()
export class ScheduleEvents {
  constructor(private readonly audit: AuditService) {}
  async task(
    ctx: CriticalContext,
    studentId: string,
    resourceId: string,
    key: string,
    title: string,
  ) {
    const now = await at(ctx.tx);
    if (await ctx.tx.crmTask.findUnique({ where: { idempotency_key: key } })) return;
    const id = randomUUID();
    await this.audit.record(
      {
        id,
        actor_kind: 'ACCOUNT',
        actor_id: ctx.actor.accountId,
        action: key.split(':')[0]!,
        resource_type: 'Schedule',
        resource_id: resourceId,
        result: 'SUCCESS',
        request_id: ctx.requestId,
        source_operation_id: ctx.operationId,
        event_key: key,
      },
      ctx.tx,
    );
    const event = await ctx.tx.outboxEvent.create({
      data: {
        topic: 'schedule.manager-task.v1',
        aggregate_type: 'Schedule',
        aggregate_id: resourceId,
        source_operation_id: ctx.operationId,
        audit_event_id: id,
        event_key: key,
        payload: { schemaVersion: 1, studentId, resourceId },
      },
    });
    const manager = await ctx.tx.assignedManager.findFirst({
      where: {
        student_id: studentId,
        assigned_at: { lte: now },
        OR: [{ ended_at: null }, { ended_at: { gt: now } }],
      },
    });
    await ctx.tx.crmTask.create({
      data: {
        student_id: studentId,
        assigned_manager_id: manager?.manager_id ?? null,
        type: 'FOLLOW_UP',
        title,
        due_at: now,
        source_event_id: event.id,
        idempotency_key: key,
      },
    });
  }
  async change(
    ctx: CriticalContext,
    id: string,
    oldValues: unknown,
    newValues: unknown,
    reason: string,
  ) {
    const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
    await ctx.tx.lessonChangeEvent.create({
      data: {
        lesson_occurrence_id: id,
        author_id: ctx.actor.accountId,
        old_values: json(oldValues),
        new_values: json(newValues),
        reason,
        effective_at: await at(ctx.tx),
        source_operation_id: randomUUID(),
      },
    });
  }
  async jobs(
    ctx: CriticalContext,
    lesson: { id: string; version: number; scheduled_end_at: Date; status: string },
  ) {
    const auditId = randomUUID(),
      key = `schedule-jobs:${lesson.id}:${lesson.version}`;
    await this.audit.record(
      {
        id: auditId,
        actor_kind: 'ACCOUNT',
        actor_id: ctx.actor.accountId,
        action: 'schedule.jobs',
        resource_type: 'LessonOccurrence',
        resource_id: lesson.id,
        result: 'SUCCESS',
        request_id: ctx.requestId,
        source_operation_id: ctx.operationId,
        event_key: key,
      },
      ctx.tx,
    );
    const event = await ctx.tx.outboxEvent.create({
      data: {
        topic: 'schedule.jobs.v1',
        aggregate_type: 'LessonOccurrence',
        aggregate_id: lesson.id,
        source_operation_id: ctx.operationId,
        audit_event_id: auditId,
        event_key: key,
        payload: { schemaVersion: 1, lessonId: lesson.id },
      },
    });
    for (const kind of lesson.status === 'STAR_PENDING'
      ? ['outcome-deadline', 'star-follow-up']
      : ['outcome-deadline']) {
      const due = new Date(+lesson.scheduled_end_at + (kind === 'outcome-deadline' ? 86400000 : 0));
      await ctx.tx.jobRecord.create({
        data: {
          type: `schedule.${kind}.v1`,
          payload: { lessonId: lesson.id, version: lesson.version },
          source_operation_id: ctx.operationId,
          source_outbox_event_id: event.id,
          deduplication_key: `${kind}:${lesson.id}:${lesson.version}`,
          retry_policy: 'SAFE_RETRY',
          max_attempts: 3,
          next_run_at: due,
        },
      });
    }
  }
}
