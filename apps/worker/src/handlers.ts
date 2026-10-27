import type { OutboxEvent } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Handler, Tx } from './contracts.js';
import { systemAudit } from './contracts.js';

async function task(
  tx: Tx,
  event: OutboxEvent,
  now: Date,
  key: string,
  studentId: string,
  title: string,
  payment = false,
): Promise<void> {
  const manager = studentId
    ? await tx.assignedManager.findFirst({
        where: {
          student_id: studentId,
          assigned_at: { lte: now },
          OR: [{ ended_at: null }, { ended_at: { gt: now } }],
        },
        orderBy: [{ assigned_at: 'desc' }, { id: 'asc' }],
      })
    : null;
  // The API/deadline producers use these same keys. Replays never reopen a resolved task.
  await tx.crmTask.createMany({
    skipDuplicates: true,
    data: [
      {
        student_id: studentId,
        assigned_manager_id: manager?.manager_id ?? null,
        type: payment ? 'PAYMENT_FOLLOW_UP' : 'FOLLOW_UP',
        title,
        due_at: now,
        source_event_id: event.id,
        idempotency_key: key,
      },
    ],
  });
}

export const PaymentConfirmedHandler: Handler = async (tx, event, now) => {
  const receipt = await tx.paymentReceipt.findUnique({ where: { id: event.aggregate_id } });
  if (!receipt?.confirmed_by_director_at) return err({ code: 'PAYMENT_NOT_CONFIRMED' });
  if (!receipt.student_id) {
    await systemAudit(tx, {
      key: `worker:payment-unassigned:${receipt.id}`,
      action: 'worker.payment-unassigned',
      resourceType: 'PaymentReceipt',
      resourceId: receipt.id,
      operationId: event.source_operation_id,
    });
    return ok(undefined);
  }
  await task(
    tx,
    event,
    now,
    `payment-confirmed:${receipt.id}`,
    receipt.student_id,
    'Поступление подтверждено: проверить распределение и доступ',
    true,
  );
  return ok(undefined);
};

async function lessonTask(tx: Tx, event: OutboxEvent, now: Date, star: boolean) {
  await tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${event.aggregate_id}::uuid FOR UPDATE`;
  const lesson = await tx.lessonOccurrence.findUnique({ where: { id: event.aggregate_id } });
  if (!lesson) return err({ code: 'LESSON_NOT_FOUND' });
  if (
    event.event_key !==
    `${star ? 'star-follow-up' : 'outcome-deadline'}:${lesson.id}:${lesson.version}`
  )
    return ok(undefined); // Rescheduled/cancelled version: do not create a stale task.
  const needed = star
    ? lesson.status === 'STAR_PENDING'
    : !lesson.confirmed_report_id &&
      ['SCHEDULED', 'STAR_PENDING', 'DISPUTED'].includes(lesson.status);
  if (!needed) return ok(undefined);
  if (+now < +lesson.scheduled_end_at + (star ? 0 : 86400000))
    return err({ code: 'LESSON_DEADLINE_NOT_REACHED' });
  const enrollment = await tx.studentSubjectEnrollment.findUniqueOrThrow({
    where: { id: lesson.enrollment_id },
  });
  await task(
    tx,
    event,
    now,
    event.event_key,
    enrollment.student_id,
    star
      ? 'Непроведённый ⭐-урок: связаться с семьёй; слот удержан'
      : 'Истёк 24-часовой срок подтверждения исхода урока',
  );
  return ok(undefined);
}
export const LessonOutcomeTimeoutHandler: Handler = (tx, event, now) =>
  lessonTask(tx, event, now, false);
export const StarPendingHandler: Handler = (tx, event, now) => lessonTask(tx, event, now, true);

export const FileAccessRevokedHandler: Handler = async (tx, event) => {
  const permission = await tx.filePermission.findUnique({ where: { id: event.aggregate_id } });
  if (!permission?.revoked_at || !permission.revoked_by)
    return err({ code: 'FILE_PERMISSION_NOT_REVOKED' });
  const audit = await tx.auditEvent.findUniqueOrThrow({ where: { id: event.audit_event_id } });
  await tx.fileAuditLog.createMany({
    skipDuplicates: true,
    data: [
      {
        s3_object_id: permission.s3_object_id,
        permission_id: permission.id,
        action: 'REVOKE',
        actor_id: permission.revoked_by,
        at: permission.revoked_at,
        result: 'SUCCESS',
        request_id: audit.request_id,
        event_key: `file-access-revoked:${permission.id}`,
      },
    ],
  });
  return ok(undefined);
};

export const EntitlementGrantedHandler: Handler = async (tx, event) => {
  const grant = await tx.entitlementGrant.findUnique({ where: { id: event.aggregate_id } });
  if (!grant) return err({ code: 'ENTITLEMENT_NOT_FOUND' });
  await systemAudit(tx, {
    key: `worker:entitlement-granted:${grant.id}`,
    action: 'worker.entitlement-granted',
    resourceType: 'EntitlementGrant',
    resourceId: grant.id,
    operationId: event.source_operation_id,
  });
  return ok(undefined);
};

const observed: Handler = async (tx, event) => {
  await systemAudit(tx, {
    key: `worker:observed:${event.id}`,
    action: 'worker.event-observed',
    resourceType: event.aggregate_type,
    resourceId: event.aggregate_id,
    operationId: event.source_operation_id,
  });
  return ok(undefined);
};

export function createHandlers(): ReadonlyMap<string, Handler> {
  const handlers = new Map<string, Handler>([
    ['finance.payment.confirmed.v1', PaymentConfirmedHandler],
    ['payment.confirmed.v1', PaymentConfirmedHandler],
    ['schedule.outcome-overdue.v1', LessonOutcomeTimeoutHandler],
    ['schedule.star-follow-up.v1', StarPendingHandler],
    ['file.access-revoked.v1', FileAccessRevokedHandler],
    ['entitlement.granted.v1', EntitlementGrantedHandler],
  ]);
  // These existing Phase-0 events have no secondary business effect. Record receipt explicitly.
  for (const topic of OBSERVED_TOPICS) handlers.set(topic, observed);
  return handlers;
}

const OBSERVED_TOPICS = [
  'student.homework.draft-saved.v1',
  'student.homework.upload-prepared.v1',
  'student.homework.file-confirmed.v1',
  'student.homework.submitted.v1',
  'student.lesson.dispute-requested.v1',
  'student.password.change.v1',
  'student.lesson.reschedule-requested.v1',
  'student.created.v1',
  'household.created.v1',
  'household.member.added.v1',
  'payment.registered.v1',
  'payment.distribution-proposed.v1',
  'payment.distribution-approved.v1',
  'subscription.created.v1',
  'entitlement.consumed.v1',
  'entitlement.adjusted.v1',
  'temporary-access.granted.v1',
  'ledger.command.published.v1',
  'ledger.published.v1',
  'ledger.adjusted.v1',
  'period.closed.v1',
  'payroll.accrued.v1',
  'payroll.payout.attempted.v1',
  'payroll.payout.confirmed.v1',
  'finance.temporary-access.expiry-scheduled.v1',
  'finance.temporary-access.expired.v1',
  'schedule.jobs.v1',
  'schedule.manager-task.v1',
  ...[
    'subject.create',
    'enrollment.create',
    'assignment.create',
    'assignment.revoke',
    'slot.create',
    'slot.change',
    'slot.generate',
    'lesson.create',
    'lesson.reschedule',
    'lesson.cancel',
    'lesson.start',
    'lesson.report',
    'lesson.confirm',
    'availability.manage',
    'schedule.request',
  ].map((name) => `schedule.${name}.v1`),
  ...[
    'logout',
    'password',
    'recovery.initiate',
    'recovery.complete',
    'webauthn.register.start',
    'webauthn.register.finish',
    'webauthn.authenticate.start',
    'webauthn.authenticate.finish',
  ].map((name) => `auth.${name}.v1`),
];
