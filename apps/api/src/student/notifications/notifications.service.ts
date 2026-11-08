import { studentAccessSuspended } from '../manager-contacts.js';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { at } from '../../modules/finance/finance-common.js';
import { object } from '../../modules/identity/input.js';
import {
  NOTIFICATION_TTL_MS,
  notificationLock,
} from '../../modules/notifications/notification.service.js';
import { projectNotificationText } from './notification-locale.js';
import type { NotificationsQuery } from './notifications.dto.js';
import { MeService } from '../me/me.service.js';
import type { IStudentContext } from '../student-context.interface.js';
import type { HistoryPage } from '../history/history.dto.js';
import type { NotificationsResponseDto, UnreadCountDto } from './notifications.dto.js';

export function notificationsSql(studentId: string, query: HistoryPage, now: Date): Prisma.Sql {
  return Prisma.sql`WITH visible AS (
    SELECT id,type,title,body,payload,created_at,read_at,
      coalesce((SELECT jsonb_build_object('code',d.template_code,'params',d.variables,'kind','dispatch') FROM notification_dispatches d WHERE d.source_id=student_notifications.id AND d.student_id=student_notifications.student_id AND d.channel='IN_APP'),
        (SELECT jsonb_build_object('code',s.type,'params',s.payload,'kind','source') FROM student_notification_sources s WHERE s.id=student_notifications.id AND s.student_id=student_notifications.student_id AND s.type=student_notifications.type)) AS catalog FROM student_notifications
    WHERE student_id=${studentId}::uuid AND archived_at IS NULL AND created_at>${new Date(+now - NOTIFICATION_TTL_MS)} AND created_at<=${now}
  ), paged AS(SELECT * FROM visible ORDER BY created_at DESC,id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize})
  SELECT (SELECT count(*)::int FROM visible) AS total,(SELECT count(*)::int FROM visible WHERE read_at IS NULL) AS "unreadCount",
    coalesce((SELECT jsonb_agg(jsonb_build_object('notificationId',id,'type',type,'title',title,'body',body,
      'payload',payload,'createdAt',created_at,'isRead',read_at IS NOT NULL,'catalog',catalog) ORDER BY created_at DESC,id DESC) FROM paged),'[]'::jsonb) AS items`;
}
@Injectable()
export class StudentNotificationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly me: MeService,
  ) {}
  async list(
    student: IStudentContext,
    query: NotificationsQuery,
  ): Promise<NotificationsResponseDto> {
    const now = await at(this.database.client);
    const [row] = await this.database.client.$queryRaw<
      Pick<NotificationsResponseDto, 'items' | 'total' | 'unreadCount'>[]
    >(notificationsSql(student.studentProfileId, query, now));
    if (!row) return fail(domainError('NOTIFICATIONS_UNAVAILABLE', 503));
    return {
      ...row,
      items: row.items.map((item) => {
        const { catalog, ...n } = item as typeof item & { catalog?: unknown };
        return {
          ...n,
          ...(projectNotificationText(n.type, catalog, query.locale ?? 'ru') ?? {}),
          createdAt: new Date(n.createdAt).toISOString(),
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async count(student: IStudentContext): Promise<UnreadCountDto> {
    // Exactly one COUNT on the partial unread index, no join or body projection.
    const [row] = await this.database.client.$queryRaw<
      UnreadCountDto[]
    >`SELECT count(*)::int AS "unreadCount" FROM student_notifications
      WHERE student_id=${student.studentProfileId}::uuid AND read_at IS NULL AND archived_at IS NULL
        AND created_at>statement_timestamp()-interval '2160 hours' AND created_at<=statement_timestamp()`;
    if (!row) return fail(domainError('NOTIFICATIONS_UNAVAILABLE', 503));
    return row;
  }
  async markRead(
    ctx: CriticalContext,
    student: IStudentContext,
    id: string | null,
    body: unknown,
  ): Promise<void> {
    object(body ?? {}, []);
    const current = unwrap(await this.me.load(student.userId, ctx.tx)).context;
    if (current.studentProfileId !== student.studentProfileId)
      return fail(domainError('NOTIFICATION_FORBIDDEN', 403));
    if (current.mustChangePassword) return fail(domainError('MUST_CHANGE_PASSWORD', 403));
    if (!current.hasActiveAccess) return fail(studentAccessSuspended(current.managerContacts));
    await notificationLock(ctx.tx, student.studentProfileId);
    const now = await at(ctx.tx),
      where = {
        student_id: student.studentProfileId,
        archived_at: null,
        created_at: { gt: new Date(+now - NOTIFICATION_TTL_MS), lte: now },
      };
    if (
      id &&
      !(await ctx.tx.studentNotification.findFirst({
        where: { ...where, id },
        select: { id: true },
      }))
    )
      return fail(domainError('NOTIFICATION_NOT_FOUND', 404));
    await ctx.tx.studentNotification.updateMany({
      where: { ...where, ...(id ? { id } : {}), read_at: null },
      data: { read_at: now },
    });
  }
}
