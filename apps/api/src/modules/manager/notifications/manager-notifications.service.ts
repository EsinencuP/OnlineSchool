import { Injectable } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { NotificationDispatch, NotificationDeliveryStatus } from '@online-school/db';
import { AppException, domainError, unwrap } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { databaseError } from '../../../core/errors/database-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { at } from '../../finance/finance-common.js';
import { NotificationOutboxPublisher } from '../../notifications/notification-outbox.publisher.js';
import {
  containsNotificationSecret,
  validateNotificationLinks,
} from '../../notifications/templates.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerContext } from '../context/manager-context.js';
import { readTaskCursor, writeTaskCursor } from '../tasks/task-cursor.js';
export type NotificationView = {
  notificationId: string;
  studentId: string;
  channel: 'IN_APP' | 'EMAIL';
  templateCode: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  createdAt: string;
  sentAt: string | null;
  failureReason: string | null;
};
export const notificationView = (r: NotificationDispatch): NotificationView => ({
  notificationId: r.id,
  studentId: r.student_id!, // This projection is used only by student-scoped endpoints.
  channel: r.channel,
  templateCode: r.template_code,
  status: r.status,
  createdAt: r.created_at.toISOString(),
  sentAt: r.sent_at?.toISOString() ?? null,
  failureReason:
    r.failure_reason === 'NO_DELIVERY_CHANNEL'
      ? 'Нет доступного канала доставки.'
      : r.failure_reason
        ? 'Уведомление не доставлено. Обратитесь к менеджеру.'
        : null,
});
export type NotificationQuery = {
  status?: NotificationDeliveryStatus;
  cursor?: string;
  limit: number;
};
export type ManualNotification = { channel: 'IN_APP' | 'EMAIL'; subject?: string; body: string };
@Injectable()
export class ManagerNotificationsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly scope: ManagerScopeService,
    private readonly publisher: NotificationOutboxPublisher,
  ) {}
  async send(
    ctx: ManagerContext,
    studentId: string,
    input: ManualNotification,
    c: CriticalContext,
  ): Promise<Result<NotificationView, DomainError>> {
    try {
      studentId = studentId.toLowerCase();
      const current = unwrap(
        await this.scope.resolveContext({ ...c.actor, requestId: c.requestId }, c.tx),
      );
      if (current.managerId !== ctx.managerId) return err(domainError('FORBIDDEN_ROLE', 403));
      unwrap(await this.scope.assertStudentInPortfolio(ctx, studentId, c.tx));
      if (
        !input.body.trim() ||
        input.body.length > 2000 ||
        containsNotificationSecret(input.body + ' ' + (input.subject ?? '')) ||
        (input.subject !== undefined &&
          (input.channel !== 'EMAIL' ||
            !input.subject.trim() ||
            input.subject.length > 150 ||
            /[\r\n]/.test(input.subject)))
      )
        return err(domainError('INVALID_INPUT', 422));
      unwrap(validateNotificationLinks(input.body + ' ' + (input.subject ?? '')));
      const dedupeKey = `manual:${ctx.managerId}:${studentId}:${c.operationId}`;
      unwrap(
        await this.publisher.enqueue(c.tx, {
          studentId,
          channel: input.channel,
          templateCode: 'MANUAL_MESSAGE',
          variables: { body: input.body },
          dedupeKey,
          managerId: ctx.managerId,
          ...(input.subject === undefined ? {} : { subject: input.subject }),
          operationId: c.operationId,
          actorId: ctx.accountId,
          requestId: c.requestId,
        }),
      );
      const row = await c.tx.notificationDispatch.findUnique({ where: { dedupe_key: dedupeKey } });
      return row ? ok(notificationView(row)) : err(domainError('NOTIFICATIONS_UNAVAILABLE', 503));
    } catch (error: unknown) {
      return err(error instanceof AppException ? error.domain : databaseError(error));
    }
  }
  list(
    ctx: ManagerContext,
    studentId: string,
    q: NotificationQuery,
  ): Promise<Result<{ items: NotificationView[]; nextCursor: string | null }, DomainError>> {
    studentId = studentId.toLowerCase();
    return this.transactions.runResult(async (tx) => {
      unwrap(await this.scope.assertStudentInPortfolio(ctx, studentId, tx));
      // Reuse the encrypted cursor primitive; namespace via the student-bound fingerprint.
      const filter = {
          limit: q.limit,
          studentId: `notifications:${studentId}:${q.status ?? 'ALL'}`,
          ...(q.cursor ? { cursor: q.cursor } : {}),
        },
        now = await at(tx),
        cursor = unwrap(readTaskCursor(ctx, filter, now));
      const rows = await tx.notificationDispatch.findMany({
        where: {
          student_id: studentId,
          ...(q.status ? { status: q.status } : {}),
          ...(cursor.id
            ? {
                OR: [
                  { created_at: { gt: cursor.dueAt! } },
                  { created_at: cursor.dueAt!, id: { gt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
        take: q.limit + 1,
      });
      const last = rows[q.limit - 1];
      return ok({
        items: rows.slice(0, q.limit).map(notificationView),
        nextCursor:
          rows.length > q.limit && last
            ? unwrap(writeTaskCursor(ctx, filter, cursor, last.id, last.created_at))
            : null,
      });
    });
  }
}
