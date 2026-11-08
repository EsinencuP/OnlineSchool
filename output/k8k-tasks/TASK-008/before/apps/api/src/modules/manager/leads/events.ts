import { randomUUID } from 'node:crypto';
import type { Prisma, LeadStage } from '@online-school/db';
export type LeadActor = { accountId?: string; requestId: string; operationId: string };
export async function recordLead(
  tx: Prisma.TransactionClient,
  actor: LeadActor,
  leadId: string,
  action: string,
  metadata: Prisma.InputJsonObject = {},
) {
  const id = randomUUID();
  await tx.auditEvent.create({
    data: {
      id,
      ...(actor.accountId
        ? { actor_kind: 'ACCOUNT' as const, actor_id: actor.accountId }
        : { actor_kind: 'SYSTEM' as const, system_actor_ref: 'lead-workflow' }),
      action,
      resource_type: 'Lead',
      resource_id: leadId,
      result: 'SUCCESS',
      request_id: actor.requestId,
      source_operation_id: actor.operationId,
      event_key: `lead:${action}:${actor.operationId}:${leadId}`,
      metadata,
    },
  });
  if (action !== 'LEAD_PII_VIEWED')
    await tx.outboxEvent.create({
      data: {
        topic: 'manager.lead.changed.v1',
        aggregate_type: 'Lead',
        aggregate_id: leadId,
        audit_event_id: id,
        source_operation_id: actor.operationId,
        event_key: `lead:${action}:${actor.operationId}:${leadId}`,
        payload: { schemaVersion: 1, leadId, action },
      },
    });
}
export async function stageEvent(
  tx: Prisma.TransactionClient,
  leadId: string,
  from: LeadStage | null,
  to: LeadStage,
  byManager: boolean,
  at: Date,
  reason?: string,
) {
  await tx.leadStageEvent.create({
    data: {
      lead_id: leadId,
      from_stage: from,
      to_stage: to,
      actor: byManager ? 'MANAGER' : 'SYSTEM',
      created_at: at,
      reason: reason ?? null,
    },
  });
}
export async function leadTask(
  tx: Prisma.TransactionClient,
  leadId: string,
  managerId: string,
  type: 'LEAD_FOLLOWUP' | 'ASSIGN_TEACHER',
  dueAt: Date,
  key: string,
  studentId?: string,
) {
  await tx.crmTask.createMany({
    skipDuplicates: true,
    data: [
      {
        lead_id: leadId,
        student_id: studentId ?? null,
        assigned_manager_id: managerId,
        type,
        title: type === 'LEAD_FOLLOWUP' ? 'Связаться по заявке' : 'Назначить преподавателя',
        due_at: dueAt,
        idempotency_key: key,
        payload: { kind: type, leadId },
      },
    ],
  });
}
export async function closeLeadTasks(
  tx: Prisma.TransactionClient,
  leadId: string,
  types: ('LEAD_FOLLOWUP' | 'ASSIGN_TEACHER')[],
  now: Date,
  staffId?: string,
) {
  // Preserve MGR07's database transition protocol inside the same transaction.
  await tx.crmTask.updateMany({
    where: { lead_id: leadId, type: { in: types }, status: 'OPEN' },
    data: { status: 'IN_PROGRESS', version: { increment: 1 } },
  });
  await tx.crmTask.updateMany({
    where: { lead_id: leadId, type: { in: types }, status: 'IN_PROGRESS' },
    data: {
      status: 'RESOLVED',
      resolved_at: now,
      resolved_by_staff_id: staffId ?? null,
      system_resolved: !staffId,
      version: { increment: 1 },
    },
  });
}
