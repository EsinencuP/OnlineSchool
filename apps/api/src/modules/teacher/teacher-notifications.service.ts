import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { TeacherContext } from './context/teacher-context.js';
import type {
  MarkReadResponseDto,
  NotificationType,
  TeacherNotificationPageDto,
  TeacherNotificationSummaryDto,
} from './dto/teacher-notifications.dto.js';

const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WINDOW = Prisma.sql`interval '90 days'`;

type Row = {
  type: NotificationType;
  key: string;
  occurred_at: Date;
  read: boolean;
  student_name: string;
  subject_name: string;
  lesson_at: Date | null;
  target_kind: 'LESSON' | 'HOMEWORK' | 'CHECKPOINT' | 'SCHEDULE_REQUEST';
  target_id: string;
};

// Work notifications are derived from existing facts; only their read state is stored.
// Own actions of the teacher (start, report) never notify the teacher.
const feedSql = (teacherId: string, accountId: string) => Prisma.sql`
  events AS (
    SELECT 'LESSON_SCHEDULED' AS type, 'lesson-scheduled:' || l.id AS key, l.created_at AS occurred_at,
           COALESCE(s.display_name, s.full_name) AS student_name, sub.name AS subject_name,
           l.scheduled_at AS lesson_at, 'LESSON' AS target_kind, l.id AS target_id
    FROM lesson_occurrences l
    JOIN student_subject_enrollments e ON e.id = l.enrollment_id
    JOIN students s ON s.id = e.student_id JOIN subjects sub ON sub.id = e.subject_id
    WHERE l.scheduled_teacher_id = ${teacherId}::uuid AND l.recurring_slot_id IS NULL
      AND l.created_at > clock_timestamp() - ${WINDOW}
    UNION ALL
    SELECT CASE WHEN ev.new_values->>'status' = 'CANCELLED' AND COALESCE(ev.old_values->>'status', '') <> 'CANCELLED'
                THEN 'LESSON_CANCELLED' ELSE 'LESSON_RESCHEDULED' END,
           'lesson-change:' || ev.id, ev.created_at,
           COALESCE(s.display_name, s.full_name), sub.name, l.scheduled_at, 'LESSON', l.id
    FROM lesson_change_events ev
    JOIN lesson_occurrences l ON l.id = ev.lesson_occurrence_id
    JOIN student_subject_enrollments e ON e.id = l.enrollment_id
    JOIN students s ON s.id = e.student_id JOIN subjects sub ON sub.id = e.subject_id
    WHERE l.scheduled_teacher_id = ${teacherId}::uuid AND ev.author_id <> ${accountId}::uuid
      AND ev.created_at > clock_timestamp() - ${WINDOW}
      AND ((ev.new_values->>'status' = 'CANCELLED' AND COALESCE(ev.old_values->>'status', '') <> 'CANCELLED')
        OR ((ev.old_values->>'scheduled_at') IS NOT NULL
          AND (ev.new_values->>'scheduled_at') IS DISTINCT FROM (ev.old_values->>'scheduled_at')))
    UNION ALL
    SELECT 'HOMEWORK_SUBMITTED', 'homework-submitted:' || h.id, h.submitted_at,
           COALESCE(s.display_name, s.full_name), sub.name, NULL::timestamptz, 'HOMEWORK', d.id
    FROM homework_submissions h
    JOIN homework_deliveries d ON d.id = h.delivery_id
    JOIN student_subject_enrollments e ON e.id = d.enrollment_id
    JOIN students s ON s.id = e.student_id JOIN subjects sub ON sub.id = e.subject_id
    WHERE d.issued_by = ${teacherId}::uuid AND h.submitted_at > clock_timestamp() - ${WINDOW}
    UNION ALL
    SELECT 'CHECKPOINT_DUE', 'checkpoint:' || cp.id, cp.triggered_at,
           COALESCE(s.display_name, s.full_name), sub.name, NULL::timestamptz, 'CHECKPOINT', cp.id
    FROM progress_checkpoints cp
    JOIN student_subject_enrollments e ON e.id = cp.enrollment_id
    JOIN students s ON s.id = e.student_id JOIN subjects sub ON sub.id = e.subject_id
    WHERE cp.triggered_at > clock_timestamp() - ${WINDOW} AND EXISTS (
      SELECT 1 FROM teaching_assignments a WHERE a.enrollment_id = e.id AND a.teacher_id = ${teacherId}::uuid
        AND a.valid_from <= clock_timestamp() AND (a.valid_to IS NULL OR a.valid_to > clock_timestamp()))
    UNION ALL
    SELECT 'SCHEDULE_REQUEST_RESOLVED', 'schedule-request:' || r.id, r.updated_at,
           COALESCE(s.display_name, s.full_name), sub.name, l.scheduled_at, 'SCHEDULE_REQUEST', r.id
    FROM schedule_change_requests r
    LEFT JOIN lesson_occurrences l ON l.id = r.lesson_occurrence_id
    LEFT JOIN recurring_slots rs ON rs.id = r.recurring_slot_id
    JOIN student_subject_enrollments e ON e.id = COALESCE(l.enrollment_id, rs.enrollment_id)
    JOIN students s ON s.id = e.student_id JOIN subjects sub ON sub.id = e.subject_id
    WHERE r.teacher_id = ${teacherId}::uuid AND r.status = 'RESOLVED'
      AND r.updated_at > clock_timestamp() - ${WINDOW}
  ), feed AS (
    SELECT ev.*, (rd.event_key IS NOT NULL
                  OR ev.occurred_at <= COALESCE(st.read_all_before, '-infinity'::timestamptz)) AS read
    FROM events ev
    LEFT JOIN teacher_notification_reads rd ON rd.teacher_id = ${teacherId}::uuid AND rd.event_key = ev.key
    LEFT JOIN teacher_notification_state st ON st.teacher_id = ${teacherId}::uuid
  )`;

const encode = (r: Row) =>
  Buffer.from(JSON.stringify([r.occurred_at.toISOString(), r.key])).toString('base64url');
function decode(cursor: string): { at: Date; key: string } | null {
  try {
    const [t, key] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown[];
    if (typeof t !== 'string' || typeof key !== 'string' || Number.isNaN(Date.parse(t)))
      return null;
    if (!/^[a-z-]+:[0-9a-f-]{36}$/.test(key)) return null;
    return { at: new Date(t), key };
  } catch {
    return null;
  }
}

@Injectable()
export class TeacherNotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async list(
    ctx: TeacherContext,
    query: { state?: string; limit?: number; cursor?: string },
  ): Promise<Result<TeacherNotificationPageDto, DomainError>> {
    try {
      const limit = query.limit ?? 20;
      const cursor = query.cursor === undefined ? null : decode(query.cursor);
      if (query.cursor !== undefined && !cursor) return err(domainError('INVALID_CURSOR', 422));
      if (query.state !== undefined && !['ALL', 'UNREAD'].includes(query.state))
        return err(domainError('INVALID_INPUT', 422));
      const rows = await this.db.client.$queryRaw<Row[]>(Prisma.sql`
        WITH ${feedSql(ctx.teacherId, ctx.accountId)}
        SELECT * FROM feed
        WHERE true ${query.state === 'UNREAD' ? Prisma.sql`AND NOT read` : Prisma.empty}
          ${cursor ? Prisma.sql`AND (occurred_at, key) < (${cursor.at}::timestamptz, ${cursor.key}::text)` : Prisma.empty}
        ORDER BY occurred_at DESC, key DESC LIMIT ${limit + 1}`);
      const page = rows.slice(0, limit);
      return ok({
        items: page.map((r) => ({
          key: r.key,
          type: r.type,
          occurredAt: r.occurred_at.toISOString(),
          read: r.read,
          studentName: r.student_name,
          subjectName: r.subject_name,
          lessonAt: r.lesson_at?.toISOString() ?? null,
          targetKind: r.target_kind,
          targetId: r.target_id,
        })),
        nextCursor: rows.length > limit ? encode(page[page.length - 1]!) : null,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async summary(ctx: TeacherContext): Promise<Result<TeacherNotificationSummaryDto, DomainError>> {
    try {
      const [row] = await this.db.client.$queryRaw<
        { unread: number; latest: Date | null }[]
      >(Prisma.sql`
        WITH ${feedSql(ctx.teacherId, ctx.accountId)}
        SELECT (SELECT count(*)::int FROM (SELECT 1 FROM feed WHERE NOT read LIMIT 500) c) AS unread,
               (SELECT max(occurred_at) FROM feed WHERE NOT read) AS latest`);
      return ok({ unreadCount: row?.unread ?? 0, latestAt: row?.latest?.toISOString() ?? null });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  // Only keys that belong to the teacher's own feed are stored.
  async markRead(
    ctx: TeacherContext,
    keys: string[],
  ): Promise<Result<MarkReadResponseDto, DomainError>> {
    try {
      if (keys.some((k) => !UUID_RE.test(k.slice(k.indexOf(':') + 1))))
        return err(domainError('INVALID_INPUT', 422));
      const marked = await this.db.client.$executeRaw(Prisma.sql`
        WITH ${feedSql(ctx.teacherId, ctx.accountId)}
        INSERT INTO teacher_notification_reads (teacher_id, event_key)
        SELECT ${ctx.teacherId}::uuid, key FROM feed
        WHERE key = ANY(${keys}::text[]) AND NOT read
        ON CONFLICT DO NOTHING`);
      return ok({ marked });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async markAllRead(ctx: TeacherContext): Promise<Result<MarkReadResponseDto, DomainError>> {
    try {
      const [counted] = await this.db.client.$queryRaw<{ unread: number }[]>(Prisma.sql`
        WITH ${feedSql(ctx.teacherId, ctx.accountId)}
        SELECT count(*)::int AS unread FROM feed WHERE NOT read`);
      await this.db.client.$executeRaw`
        INSERT INTO teacher_notification_state (teacher_id, read_all_before)
        VALUES (${ctx.teacherId}::uuid, clock_timestamp())
        ON CONFLICT (teacher_id) DO UPDATE
          SET read_all_before = clock_timestamp(), updated_at = clock_timestamp()`;
      return ok({ marked: counted?.unread ?? 0 });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }
}
