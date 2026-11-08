import { randomUUID } from 'node:crypto';
import type { OutboxEvent, Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { databaseError } from '../../../core/errors/database-error.js';
import { lockLead } from '../../crm/lead-data.js';
import { leadConfig } from './policy.js';
import { recordLead, stageEvent, leadTask, closeLeadTasks } from './events.js';

/** The caller supplies the worker's transaction; receipt, audit and state commit together. */
export async function applyLeadEvent(
  tx: Prisma.TransactionClient,
  event: OutboxEvent,
  now: Date,
): Promise<Result<void, DomainError>> {
  try {
    const receiptKey = `lead-processed:${event.id}`;
    if (await tx.auditEvent.findUnique({ where: { event_key: receiptKey }, select: { id: true } }))
      return ok(undefined);
    const conversion = event.topic === 'finance.lead-first-payment.allocated.v1';
    let studentId: string | undefined;
    if (conversion) {
      const distribution = await tx.paymentDistribution.findUnique({
        where: { id: event.aggregate_id },
        include: {
          payment_ref: true,
          subscription_ref: { include: { enrollment_ref: true } },
          ledger_document: { include: { t03_ledgerentry_document_id: true } },
        },
      });
      const entry = distribution?.ledger_document?.t03_ledgerentry_document_id;
      if (
        !distribution?.approved_at ||
        !distribution.payment_ref.confirmed_by_director_at ||
        distribution.payment_ref.purpose !== 'FIRST_PAYMENT' ||
        !entry?.published_at ||
        entry.published_at > now ||
        entry.effective_at > now
      )
        return ok(undefined);
      studentId = distribution.subscription_ref.enrollment_ref.student_id;
    }
    if (conversion) {
      const linked = await tx.lead.findMany({
        where: { student_links: { some: { student_id: studentId!, unlinked_at: null } } },
        take: 2,
        select: { id: true },
      });
      if (linked.length > 1)
        return err({ code: 'LEAD_LINK_AMBIGUOUS', message: 'LEAD_LINK_AMBIGUOUS', status: 409 });
    }
    const lead = await tx.lead.findFirst({
      where: conversion
        ? {
            student_links: { some: { student_id: studentId!, unlinked_at: null } },
            stage: { not: 'CONVERTED' },
          }
        : { trial_lesson_id: event.aggregate_id, stage: { in: ['TRIAL_SCHEDULED', 'TRIAL_DONE'] } },
    });
    if (lead) {
      const locked = await lockLead(tx, lead.id);
      if (!locked.ok) return locked;
      const current = await tx.lead.findUnique({
        where: { id: lead.id },
        include: { trial_lesson: true },
      });
      if (
        current &&
        (conversion
          ? current.stage !== 'CONVERTED'
          : !['CONVERTED', 'CLOSED'].includes(current.stage))
      ) {
        const to = conversion
          ? 'CONVERTED'
          : current.trial_lesson_id === event.aggregate_id &&
              current.trial_lesson?.kind === 'TRIAL' &&
              current.trial_lesson.status === 'CANCELLED'
            ? 'CONTACTED'
            : null;
        if (to && (conversion || ['TRIAL_SCHEDULED', 'TRIAL_DONE'].includes(current.stage))) {
          if (conversion && studentId && current.archived_student_at)
            await tx.student.updateMany({
              where: { id: studentId, archived_at: current.archived_student_at },
              data: { archived_at: null, version: { increment: 1 } },
            });
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              stage: to,
              stage_changed_at: now,
              version: { increment: 1 },
              ...(conversion
                ? {
                    converted_at: now,
                    archived_student_at: null,
                    lost_reason: null,
                    lost_comment: null,
                  }
                : {}),
            },
          });
          await stageEvent(tx, lead.id, current.stage, to, false, now);
          await recordLead(
            tx,
            { requestId: randomUUID(), operationId: event.id },
            lead.id,
            conversion ? 'LEAD_CONVERTED' : 'LEAD_STAGE_CHANGED',
            { sourceEventId: event.id, from: current.stage, to },
          );
          if (conversion)
            await closeLeadTasks(tx, lead.id, ['LEAD_FOLLOWUP', 'ASSIGN_TEACHER'], now);
          else {
            const manager = await tx.assignedManager.findFirst({
              where: {
                lead_id: lead.id,
                assigned_at: { lte: now },
                OR: [{ ended_at: null }, { ended_at: { gt: now } }],
              },
              select: { manager_id: true },
            });
            const config = leadConfig();
            if (!config.ok) return config;
            if (manager)
              await leadTask(
                tx,
                lead.id,
                manager.manager_id,
                'LEAD_FOLLOWUP',
                new Date(+now + config.value.followupMinutes * 60000),
                `trial-followup:${event.id}`,
              );
          }
        }
      }
    }
    await tx.auditEvent.create({
      data: {
        actor_kind: 'SYSTEM',
        system_actor_ref: 'lead-event-worker',
        action: 'LEAD_EVENT_PROCESSED',
        resource_type: 'OutboxEvent',
        resource_id: event.id,
        result: 'SUCCESS',
        request_id: randomUUID(),
        source_operation_id: event.id,
        event_key: receiptKey,
      },
    });
    return ok(undefined);
  } catch (error: unknown) {
    return err(databaseError(error));
  }
}
