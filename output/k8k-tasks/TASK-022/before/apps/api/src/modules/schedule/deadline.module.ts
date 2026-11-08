import { randomUUID } from 'node:crypto';
import { Injectable, Module } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseModule } from '../../core/database/database.module.js';
import {
  TransactionModule,
  TransactionService,
} from '../../core/transaction/transaction.service.js';
import { AuditModule, AuditService } from '../../core/audit/audit.service.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import { at } from '../finance/finance-common.js';

@Injectable()
export class ScheduleDeadlines {
  private readonly workerId = `schedule:${randomUUID()}`;
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
  ) {}
  async processDue(limit = 20): Promise<Result<number, DomainError>> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      return err(domainError('INVALID_BATCH_SIZE', 400));
    let total = 0;
    for (let i = 0; i < limit; i++) {
      const claimed = await this.transactions.runCritical(async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM job_records WHERE type IN ('schedule.outcome-deadline.v1','schedule.star-follow-up.v1') AND next_run_at<=clock_timestamp() AND (status IN ('PENDING','RETRY_WAIT') OR (status='RUNNING' AND locked_until<=clock_timestamp())) ORDER BY next_run_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
        if (!rows.length) return null;
        const job = await tx.jobRecord.findUniqueOrThrow({ where: { id: rows[0]!.id } }),
          now = await at(tx);
        if (job.status === 'RUNNING')
          await tx.jobAttempt.updateMany({
            where: { job_id: job.id, attempt_no: job.attempts, finished_at: null },
            data: { finished_at: now, result: 'FAILED', error: 'LEASE_EXPIRED' },
          });
        if (job.attempts >= job.max_attempts) {
          await tx.jobRecord.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              finished_at: now,
              locked_by: null,
              locked_until: null,
              last_error_code: 'ATTEMPTS_EXHAUSTED',
            },
          });
          return null;
        }
        const reserved = await tx.jobRecord.update({
          where: { id: job.id },
          data: {
            status: 'RUNNING',
            attempts: { increment: 1 },
            locked_by: this.workerId,
            locked_until: new Date(+now + 30000),
            started_at: now,
          },
        });
        const attempt = await tx.jobAttempt.create({
          data: { job_id: job.id, attempt_no: reserved.attempts, started_at: now },
        });
        return { job: reserved, attemptId: attempt.id };
      });
      if (!claimed.ok) return claimed;
      if (!claimed.value) break;
      const { job, attemptId } = claimed.value;
      const outcome = await this.transactions.runCritical(async (tx) => {
        await tx.$queryRaw`SELECT id FROM job_records WHERE id=${job.id}::uuid FOR UPDATE`;
        const lease = await tx.jobRecord.findUniqueOrThrow({ where: { id: job.id } }),
          now = await at(tx);
        if (
          lease.status !== 'RUNNING' ||
          lease.locked_by !== this.workerId ||
          !lease.locked_until ||
          lease.locked_until <= now
        )
          return fail(domainError('LEASE_EXPIRED', 409));
        const payload = job.payload as { lessonId?: unknown; version?: unknown };
        if (typeof payload.lessonId !== 'string' || !Number.isInteger(payload.version))
          return fail(domainError('INVALID_SCHEDULE_JOB', 422));
        await tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${payload.lessonId}::uuid FOR UPDATE`;
        const lesson = await tx.lessonOccurrence.findUniqueOrThrow({
          where: { id: payload.lessonId },
        });
        const star = job.type === 'schedule.star-follow-up.v1',
          due = new Date(+lesson.scheduled_end_at + (star ? 0 : 86400000));
        const needed =
          lesson.version === payload.version &&
          due <= now &&
          (star
            ? lesson.status === 'STAR_PENDING'
            : !lesson.confirmed_report_id &&
              ['SCHEDULED', 'STAR_PENDING', 'DISPUTED'].includes(lesson.status));
        const key = `${star ? 'star-follow-up' : 'outcome-deadline'}:${lesson.id}:${lesson.version}`;
        if (needed && !(await tx.crmTask.findUnique({ where: { idempotency_key: key } }))) {
          const en = await tx.studentSubjectEnrollment.findUniqueOrThrow({
              where: { id: lesson.enrollment_id },
            }),
            auditId = randomUUID();
          await this.audit.record(
            {
              id: auditId,
              actor_kind: 'SYSTEM',
              system_actor_ref: 'schedule-deadline-worker',
              action: star ? 'schedule.star-missed' : 'schedule.outcome-overdue',
              resource_type: 'LessonOccurrence',
              resource_id: lesson.id,
              result: 'SUCCESS',
              request_id: randomUUID(),
              source_operation_id: job.source_operation_id,
              event_key: key,
            },
            tx,
          );
          const event = await tx.outboxEvent.create({
            data: {
              topic: star ? 'schedule.star-follow-up.v1' : 'schedule.outcome-overdue.v1',
              aggregate_type: 'LessonOccurrence',
              aggregate_id: lesson.id,
              source_operation_id: job.source_operation_id,
              audit_event_id: auditId,
              event_key: key,
              payload: { schemaVersion: 1, lessonId: lesson.id, studentId: en.student_id },
            },
          });
          const manager = await tx.assignedManager.findFirst({
            where: {
              student_id: en.student_id,
              assigned_at: { lte: now },
              OR: [{ ended_at: null }, { ended_at: { gt: now } }],
            },
          });
          await tx.crmTask.create({
            data: {
              student_id: en.student_id,
              assigned_manager_id: manager?.manager_id ?? null,
              type: 'FOLLOW_UP',
              title: star
                ? 'Непроведённый ⭐-урок: связаться с семьёй; слот удержан'
                : 'Истёк 24-часовой срок подтверждения исхода урока',
              due_at: now,
              source_event_id: event.id,
              idempotency_key: key,
            },
          });
        }
        await tx.jobAttempt.update({
          where: { id: attemptId },
          data: { finished_at: now, result: 'SUCCEEDED' },
        });
        await tx.jobRecord.update({
          where: { id: job.id },
          data: { status: 'SUCCEEDED', finished_at: now, locked_by: null, locked_until: null },
        });
      });
      if (!outcome.ok) {
        const released = await this.transactions.runCritical(async (tx) => {
          await tx.$queryRaw`SELECT id FROM job_records WHERE id=${job.id}::uuid FOR UPDATE`;
          const lease = await tx.jobRecord.findUniqueOrThrow({ where: { id: job.id } });
          if (lease.locked_by !== this.workerId || lease.status !== 'RUNNING') return;
          const now = await at(tx),
            final = lease.attempts >= lease.max_attempts;
          await tx.jobAttempt.update({
            where: { id: attemptId },
            data: { finished_at: now, result: 'FAILED', error: outcome.error.code },
          });
          await tx.jobRecord.update({
            where: { id: job.id },
            data: {
              status: final ? 'FAILED' : 'RETRY_WAIT',
              finished_at: final ? now : null,
              locked_by: null,
              locked_until: null,
              next_run_at: new Date(+now + 30000 * 2 ** (lease.attempts - 1)),
              last_error_code: outcome.error.code,
            },
          });
        });
        if (!released.ok) return released;
        return outcome;
      }
      total++;
    }
    return ok(total);
  }
  async enabled(): Promise<Result<number, DomainError>> {
    return process.env.DATABASE_URL ? this.processDue() : ok(0);
  }
}
@Module({
  imports: [DatabaseModule, TransactionModule, AuditModule],
  providers: [ScheduleDeadlines],
  exports: [ScheduleDeadlines],
})
export class ScheduleDeadlineModule {}
