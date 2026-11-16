import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { TeacherContext } from './context/teacher-context.js';
import { REQUEST_STATUSES } from './dto/teacher-availability.dto.js';
import type {
  TeacherAvailabilityResponseDto,
  TeacherScheduleRequestPageDto,
} from './dto/teacher-availability.dto.js';

const DAY_MS = 86_400_000;
const MAX_WINDOWS = 200;
const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);

type WindowRow = {
  id: string;
  starts_at: Date;
  ends_at: Date;
  timezone: string;
  cancelled_at: Date | null;
  lesson_count: number;
  now: Date;
};

const encode = (createdAt: Date, id: string) =>
  Buffer.from(JSON.stringify([createdAt.toISOString(), id])).toString('base64url');
function decode(cursor: string): { at: Date; id: string } | null {
  try {
    const [at, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown[];
    if (
      typeof at !== 'string' ||
      typeof id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(id) ||
      Number.isNaN(Date.parse(at))
    )
      return null;
    return { at: new Date(at), id };
  } catch {
    return null;
  }
}

@Injectable()
export class TeacherAvailabilityService {
  constructor(private readonly db: DatabaseService) {}

  async windows(
    ctx: TeacherContext,
    query: { from?: string; to?: string; includeCancelled?: string },
  ): Promise<Result<TeacherAvailabilityResponseDto, DomainError>> {
    try {
      const now = (
        await this.db.client.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      )[0]!.now;
      const from = query.from ? new Date(query.from) : now;
      const to = query.to ? new Date(query.to) : new Date(+from + 90 * DAY_MS);
      if (!(+to > +from) || +to - +from > 366 * DAY_MS)
        return err(domainError('INVALID_RANGE', 422));
      const rows = await this.db.client.$queryRaw<WindowRow[]>(Prisma.sql`
        SELECT a.id, a.starts_at, a.ends_at, a.timezone, a.cancelled_at,
               (SELECT count(*)::int FROM lesson_occurrences l
                 WHERE l.scheduled_teacher_id = a.teacher_id AND l.status <> 'CANCELLED'
                   AND l.scheduled_at < a.ends_at AND l.scheduled_end_at > a.starts_at) AS lesson_count,
               clock_timestamp() AS now
        FROM teacher_availabilities a
        WHERE a.teacher_id = ${ctx.teacherId}::uuid
          AND a.starts_at < ${to}::timestamptz AND a.ends_at > ${from}::timestamptz
          ${query.includeCancelled === 'true' ? Prisma.empty : Prisma.sql`AND a.cancelled_at IS NULL`}
        ORDER BY a.starts_at, a.id
        LIMIT ${MAX_WINDOWS}`);
      return ok({
        from: from.toISOString(),
        to: to.toISOString(),
        asOf: (rows[0]?.now ?? now).toISOString(),
        windows: rows.map((r) => ({
          availabilityId: r.id,
          startsAt: r.starts_at.toISOString(),
          endsAt: r.ends_at.toISOString(),
          timezone: r.timezone,
          cancelledAt: r.cancelled_at?.toISOString() ?? null,
          occupied: r.lesson_count > 0,
          lessonCount: r.lesson_count,
        })),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async requests(
    ctx: TeacherContext,
    query: { status?: string; limit?: number; cursor?: string },
  ): Promise<Result<TeacherScheduleRequestPageDto, DomainError>> {
    try {
      const limit = query.limit ?? 20;
      const cursor = query.cursor === undefined ? null : decode(query.cursor);
      if (query.cursor !== undefined && !cursor) return err(domainError('INVALID_CURSOR', 422));
      if (
        query.status !== undefined &&
        !(REQUEST_STATUSES as readonly string[]).includes(query.status)
      )
        return err(domainError('INVALID_INPUT', 422));
      const rows = await this.db.client.scheduleChangeRequest.findMany({
        where: {
          teacher_id: ctx.teacherId,
          ...(query.status ? { status: query.status as 'PENDING' | 'RESOLVED' } : {}),
          ...(cursor
            ? {
                OR: [
                  { created_at: { lt: cursor.at } },
                  { created_at: cursor.at, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: {
          id: true,
          status: true,
          created_at: true,
          reason: true,
          requested_start_at: true,
          requested_end_at: true,
          lesson_occurrence_id: true,
          recurring_slot_id: true,
          lesson_ref: {
            select: {
              scheduled_at: true,
              enrollment_ref: {
                select: {
                  student_ref: { select: { full_name: true, display_name: true } },
                  subject_ref: { select: { name: true } },
                },
              },
            },
          },
          slot_ref: {
            select: {
              enrollment_ref: {
                select: {
                  student_ref: { select: { full_name: true, display_name: true } },
                  subject_ref: { select: { name: true } },
                },
              },
            },
          },
        },
      });
      const page = rows.slice(0, limit);
      return ok({
        items: page.map((r) => {
          const enrollment = (r.lesson_ref ?? r.slot_ref)!.enrollment_ref;
          return {
            requestId: r.id,
            status: r.status,
            createdAt: r.created_at.toISOString(),
            reason: r.reason,
            requestedStartAt: r.requested_start_at?.toISOString() ?? null,
            requestedEndAt: r.requested_end_at?.toISOString() ?? null,
            lessonId: r.lesson_occurrence_id,
            slotId: r.recurring_slot_id,
            lessonStartsAt: r.lesson_ref?.scheduled_at.toISOString() ?? null,
            studentName: enrollment.student_ref.display_name ?? enrollment.student_ref.full_name,
            subjectName: enrollment.subject_ref.name,
          };
        }),
        nextCursor:
          rows.length > limit
            ? encode(page[page.length - 1]!.created_at, page[page.length - 1]!.id)
            : null,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }
}
