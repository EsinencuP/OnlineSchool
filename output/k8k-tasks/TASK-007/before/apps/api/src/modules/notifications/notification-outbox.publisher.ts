import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@online-school/db';
import type { NotificationChannel } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { AppException, domainError, unwrap } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import { databaseError } from '../../core/errors/database-error.js';
import { at } from '../finance/finance-common.js';
import { renderNotification, validateNotificationLinks } from './templates.js';
import type { ManagerTemplateCode } from './templates.js';
export interface SystemNotificationEvent {
  studentId: string;
  templateCode: Exclude<ManagerTemplateCode, 'MANUAL_MESSAGE'>;
  variables: Record<string, string>;
  dedupeKey: string;
}
export type NotificationIntent = Omit<SystemNotificationEvent, 'templateCode'> & {
  templateCode: ManagerTemplateCode;
  channel?: NotificationChannel;
  managerId?: string;
  subject?: string;
  sourceKey?: string;
  operationId?: string;
  actorId?: string;
  requestId?: string;
};
const same = (a: unknown, b: Record<string, string>) =>
  !!a &&
  typeof a === 'object' &&
  !Array.isArray(a) &&
  JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
@Injectable()
export class NotificationOutboxPublisher {
  async enqueueContact(
    tx: Prisma.TransactionClient,
    event: {
      leadId: string;
      lessonId: string;
      operationId: string;
      requestId: string;
      actorId: string;
    },
  ): Promise<Result<void, DomainError>> {
    try {
      const lead = await tx.lead.findUnique({
        where: { id: event.leadId },
        include: { trial_lesson: true },
      });
      if (!lead || lead.trial_lesson_id !== event.lessonId || !lead.trial_lesson)
        return err(domainError('LEAD_NOT_FOUND', 404));
      const key = `trial-contact:${event.leadId}:${event.lessonId}:${lead.trial_lesson.version}`;
      const previous = await tx.notificationDispatch.findUnique({ where: { dedupe_key: key } });
      if (previous)
        return previous.lead_id === event.leadId && previous.channel === 'EMAIL'
          ? ok(undefined)
          : err(domainError('NOTIFICATION_DEDUPE_CONFLICT', 409));
      const variables = {
          lessonId: event.lessonId,
          startsAt: lead.trial_lesson.scheduled_at.toISOString(),
        },
        content = unwrap(renderNotification('TRIAL_SCHEDULED', variables, 'ru'));
      const hasEmail = !!lead.email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(lead.email),
        id = randomUUID(),
        auditId = randomUUID();
      await tx.notificationDispatch.create({
        data: {
          id,
          lead_id: lead.id,
          channel: 'EMAIL',
          template_code: 'TRIAL_SCHEDULED',
          variables,
          dedupe_key: key,
          recipient_email: hasEmail ? lead.email : null,
          subject: content.title,
          body: content.body,
          ...(hasEmail ? {} : { status: 'FAILED', failure_reason: 'NO_DELIVERY_CHANNEL' }),
        },
      });
      await tx.auditEvent.create({
        data: {
          id: auditId,
          actor_kind: 'ACCOUNT',
          actor_id: event.actorId,
          action: 'NOTIFICATION_QUEUED',
          resource_type: 'NotificationDispatch',
          resource_id: id,
          result: 'SUCCESS',
          request_id: event.requestId,
          source_operation_id: event.operationId,
          event_key: `notification-queued:${id}`,
          metadata: {
            recipient: 'CONTACT',
            leadId: lead.id,
            channel: 'EMAIL',
            templateCode: 'TRIAL_SCHEDULED',
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          topic: 'notification.deliver.v1',
          aggregate_type: 'NotificationDispatch',
          aggregate_id: id,
          audit_event_id: auditId,
          source_operation_id: event.operationId,
          event_key: `notification-deliver:${id}`,
          payload: { schemaVersion: 1, notificationId: id },
        },
      });
      return ok(undefined);
    } catch (e: unknown) {
      return err(e instanceof AppException ? e.domain : databaseError(e));
    }
  }
  async enqueue(
    tx: Prisma.TransactionClient,
    event: NotificationIntent,
  ): Promise<Result<void, DomainError>> {
    try {
      if (!event.dedupeKey || event.dedupeKey.length > 250)
        return err(domainError('TEMPLATE_VARIABLES_INVALID', 422));
      const student = await tx.student.findUnique({ where: { id: event.studentId } });
      if (!student || student.archived_at) return err(domainError('STUDENT_NOT_FOUND', 404));
      const content = unwrap(
        renderNotification(event.templateCode, event.variables, student.notification_locale),
      );
      const previous = await tx.notificationDispatch.findUnique({
        where: { dedupe_key: event.dedupeKey },
      });
      if (previous)
        return previous.student_id === event.studentId &&
          previous.template_code === event.templateCode &&
          same(previous.variables, event.variables) &&
          (!event.channel || previous.channel === event.channel) &&
          (!event.subject || previous.subject === event.subject)
          ? ok(undefined)
          : err(domainError('NOTIFICATION_DEDUPE_CONFLICT', 409));
      if (event.templateCode === 'MANUAL_MESSAGE') {
        if (!event.managerId) return err(domainError('INVALID_INPUT', 422));
        unwrap(validateNotificationLinks(content.body + ' ' + (event.subject ?? '')));
        const raw = process.env.MANUAL_NOTIFICATIONS_PER_HOUR ?? '10';
        if (!/^[1-9]\d*$/.test(raw) || Number(raw) > 1000)
          return err(domainError('NOTIFICATION_CONFIGURATION_INVALID', 503));
        await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${`manual-notification:${event.managerId}:${event.studentId}`},0))`;
        const time = await at(tx),
          count = await tx.notificationDispatch.count({
            where: {
              manager_id: event.managerId,
              student_id: event.studentId,
              template_code: 'MANUAL_MESSAGE',
              created_at: { gt: new Date(+time - 3600000) },
            },
          });
        if (count >= Number(raw)) return err(domainError('NOTIFICATION_RATE_LIMITED', 429));
      }
      const profile = await tx.studentAccount.findFirst({
        where: {
          student_id: event.studentId,
          deactivated_at: null,
          account: { disabled_at: null },
        },
        select: { id: true },
      });
      const channel = event.channel ?? (profile ? 'IN_APP' : 'EMAIL');
      const hasEmail =
        typeof student.email === 'string' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(student.email);
      const missingChannel =
        (channel === 'IN_APP' && !profile) || (channel === 'EMAIL' && !hasEmail);
      if (missingChannel && event.templateCode === 'MANUAL_MESSAGE')
        return err(domainError('NO_DELIVERY_CHANNEL', 422));
      const now = await at(tx),
        id = randomUUID(),
        operationId = event.operationId ?? randomUUID(),
        auditId = randomUUID();
      let sourceId: string | null = null;
      if (channel === 'IN_APP' && !missingChannel) {
        const sourceKey = event.sourceKey ?? event.dedupeKey;
        await tx.studentNotificationSource.createMany({
          skipDuplicates: true,
          data: [
            {
              id,
              student_id: event.studentId,
              type: event.templateCode,
              event_key: sourceKey,
              payload: event.variables,
              occurred_at: now,
            },
          ],
        });
        const source = await tx.studentNotificationSource.findUnique({
          where: { event_key: sourceKey },
        });
        if (
          !source ||
          source.student_id !== event.studentId ||
          source.type !== event.templateCode ||
          !same(source.payload, event.variables)
        )
          return err(domainError('INVALID_NOTIFICATION_SOURCE', 409));
        sourceId = source.id;
      }
      const row = await tx.notificationDispatch.create({
        data: {
          id,
          student_id: event.studentId,
          manager_id: event.managerId ?? null,
          channel,
          template_code: event.templateCode,
          locale: content.locale,
          variables: event.variables,
          dedupe_key: event.dedupeKey,
          recipient_email: channel === 'EMAIL' && hasEmail ? student.email : null,
          subject: event.subject ?? content.title,
          body: content.body,
          source_id: sourceId,
          created_at: now,
          ...(missingChannel ? { status: 'FAILED', failure_reason: 'NO_DELIVERY_CHANNEL' } : {}),
        },
      });
      await tx.auditEvent.create({
        data: {
          id: auditId,
          ...(event.actorId
            ? { actor_kind: 'ACCOUNT', actor_id: event.actorId }
            : { actor_kind: 'SYSTEM', system_actor_ref: 'notification-outbox' }),
          action: 'NOTIFICATION_QUEUED',
          resource_type: 'NotificationDispatch',
          resource_id: row.id,
          result: 'SUCCESS',
          request_id: event.requestId ?? randomUUID(),
          source_operation_id: operationId,
          event_key: `notification-queued:${row.id}`,
          metadata: {
            studentId: event.studentId,
            templateCode: event.templateCode,
            channel,
            textLength: content.body.length,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          topic: 'notification.deliver.v1',
          aggregate_type: 'NotificationDispatch',
          aggregate_id: row.id,
          audit_event_id: auditId,
          source_operation_id: operationId,
          event_key: `notification-deliver:${row.id}`,
          payload: { schemaVersion: 1, notificationId: row.id },
        },
      });
      return ok(undefined);
    } catch (error: unknown) {
      return err(
        error instanceof AppException
          ? error.domain
          : error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
            ? { ...domainError('TRANSACTION_CONFLICT', 503), retryable: true }
            : databaseError(error),
      );
    }
  }
}
