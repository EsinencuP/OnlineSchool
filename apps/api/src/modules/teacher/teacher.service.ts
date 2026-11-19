import { Injectable } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { StaffActorContextService } from '../../core/actor/actor-context.service.js';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { AccountContext } from '../../core/http.js';
import { effectiveMeetLink, readPublishedMeetLinks } from '../schedule/meet-link.js';
import type { TeacherContext } from './context/teacher-context.js';
import type { TeacherMeResponseDto, TeacherTodayResponseDto } from './dto/teacher.dto.js';

const JOIN_OPENS_MS = 10 * 60_000;
const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);

@Injectable()
export class TeacherService {
  constructor(
    private readonly db: DatabaseService,
    private readonly actors: StaffActorContextService,
  ) {}

  async me(
    ctx: TeacherContext,
    actor: AccountContext,
  ): Promise<Result<TeacherMeResponseDto, DomainError>> {
    try {
      const actorContext = await this.actors.get(actor);
      const now = (
        await this.db.client.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      )[0]!.now;
      const assignments = await this.db.client.teachingAssignment.findMany({
        where: {
          teacher_id: ctx.teacherId,
          valid_from: { lte: now },
          OR: [{ valid_to: null }, { valid_to: { gt: now } }],
          enrollment_ref: { status: 'ACTIVE' },
        },
        select: { enrollment_ref: { select: { student_id: true } } },
      });
      return ok({
        actorContext,
        teacherId: ctx.teacherId,
        displayName: actorContext.displayName,
        role: 'TEACHER',
        activeStudentCount: new Set(assignments.map((a) => a.enrollment_ref.student_id)).size,
        timezone: actorContext.timezone,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async today(
    ctx: TeacherContext,
    actor: AccountContext,
    date?: string,
  ): Promise<Result<TeacherTodayResponseDto, DomainError>> {
    try {
      const { timezone } = await this.actors.get(actor);
      let bounds: { day: string; start: Date; end: Date; now: Date }[];
      try {
        // PostgreSQL resolves the school-timezone calendar day, so DST days are 23/25 hours.
        bounds = await this.db.client.$queryRaw`
          WITH d AS (
            SELECT COALESCE(${date ?? null}::date, (clock_timestamp() AT TIME ZONE ${timezone})::date) AS day
          )
          SELECT to_char(day, 'YYYY-MM-DD') AS day,
                 (day::timestamp AT TIME ZONE ${timezone}) AS start,
                 ((day + 1)::timestamp AT TIME ZONE ${timezone}) AS "end",
                 clock_timestamp() AS now
          FROM d`;
      } catch {
        return err(domainError('INVALID_DATE', 422));
      }
      const { day, start, end, now } = bounds[0]!;
      const rows = await this.db.client.lessonOccurrence.findMany({
        where: { scheduled_teacher_id: ctx.teacherId, scheduled_at: { gte: start, lt: end } },
        orderBy: [{ scheduled_at: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          scheduled_at: true,
          scheduled_end_at: true,
          status: true,
          kind: true,
          google_meet_link: true,
          meet_link_overridden: true,
          teaching_assignment_ref: { select: { google_meet_link: true } },
          t03_lessonactualoutcome_lesson_occurrence_id: { select: { id: true } },
          enrollment_ref: {
            select: {
              student_ref: { select: { id: true, full_name: true, display_name: true } },
              subject_ref: { select: { code: true, name: true } },
            },
          },
        },
      });
      const meetLinks = await readPublishedMeetLinks(
        this.db.client,
        rows.filter((row) => !row.meet_link_overridden).map((row) => row.id),
      );
      return ok({
        date: day,
        timezone,
        asOf: now.toISOString(),
        lessons: rows.map((l) => {
          const link = effectiveMeetLink(
            l.meet_link_overridden,
            l.google_meet_link,
            meetLinks.get(l.id) ?? l.teaching_assignment_ref.google_meet_link,
          );
          const student = l.enrollment_ref.student_ref;
          return {
            lessonId: l.id,
            startsAt: l.scheduled_at.toISOString(),
            endsAt: l.scheduled_end_at.toISOString(),
            status: l.status,
            kind: l.kind,
            studentId: student.id,
            studentName: student.display_name ?? student.full_name,
            subjectCode: l.enrollment_ref.subject_ref.code,
            subjectName: l.enrollment_ref.subject_ref.name,
            joinOpensAt: new Date(+l.scheduled_at - JOIN_OPENS_MS).toISOString(),
            meetLinkState: link ? ('PRESENT' as const) : ('MISSING' as const),
            outcomeRecorded: l.t03_lessonactualoutcome_lesson_occurrence_id !== null,
          };
        }),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }
}
