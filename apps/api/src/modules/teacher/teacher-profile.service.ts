import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { StaffActorContextService } from '../../core/actor/actor-context.service.js';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { AccountContext, CriticalContext } from '../../core/http.js';
import type { TeacherContext } from './context/teacher-context.js';
import type { TeacherStudentOverviewDto } from './dto/teacher-overview.dto.js';
import type {
  TeacherProfileDto,
  UpdateTeacherProfileDto,
  UpdateTeacherProfileResponseDto,
} from './dto/teacher-profile.dto.js';

const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TeacherProfileService {
  constructor(
    private readonly db: DatabaseService,
    private readonly actors: StaffActorContextService,
  ) {}

  async profile(
    ctx: TeacherContext,
    actor: AccountContext,
  ): Promise<Result<TeacherProfileDto, DomainError>> {
    try {
      const { timezone } = await this.actors.get(actor);
      const teacher = await this.db.client.teacherAccount.findUniqueOrThrow({
        where: { id: ctx.teacherId },
        select: { id: true, full_name: true, email: true, phone: true },
      });
      const keys = await this.db.client.webAuthnCredential.findMany({
        where: { account_id: ctx.accountId, revoked_at: null },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
        select: { id: true, created_at: true, last_used_at: true, backed_up: true },
      });
      return ok({
        teacherId: teacher.id,
        fullName: teacher.full_name,
        email: teacher.email,
        phone: teacher.phone,
        timezone,
        passkeys: keys.map((k) => ({
          id: k.id,
          createdAt: k.created_at.toISOString(),
          lastUsedAt: k.last_used_at?.toISOString() ?? null,
          backedUp: k.backed_up,
        })),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async updatePhone(
    ctx: CriticalContext,
    body: UpdateTeacherProfileDto,
  ): Promise<UpdateTeacherProfileResponseDto> {
    const teacher = await ctx.tx.teacherAccount.findFirst({
      where: { account_id: ctx.actor.accountId, deactivated_at: null },
      select: { id: true },
    });
    if (!teacher) return fail(domainError('FORBIDDEN', 403));
    const updated = await ctx.tx.teacherAccount.update({
      where: { id: teacher.id },
      data: { phone: body.phone },
      select: { id: true, phone: true },
    });
    return { id: updated.id, phone: updated.phone };
  }

  async overview(
    ctx: TeacherContext,
    enrollmentId: string,
  ): Promise<Result<TeacherStudentOverviewDto, DomainError>> {
    if (!UUID_RE.test(enrollmentId)) return err(domainError('INVALID_INPUT', 422));
    try {
      const client = this.db.client;
      const now = (await client.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!
        .now;
      const enrollment = await client.studentSubjectEnrollment.findFirst({
        where: {
          id: enrollmentId,
          t03_teachingassignment_enrollment_id: {
            some: {
              teacher_id: ctx.teacherId,
              valid_from: { lte: now },
              OR: [{ valid_to: null }, { valid_to: { gt: now } }],
            },
          },
        },
        select: {
          id: true,
          student_id: true,
          subject_id: true,
          student_ref: { select: { full_name: true, display_name: true } },
          subject_ref: { select: { name: true } },
        },
      });
      if (!enrollment) return err(domainError('NOT_FOUND', 404));
      const lessonWhere = { enrollment_id: enrollmentId, scheduled_teacher_id: ctx.teacherId };
      const [upcoming, recent] = await Promise.all([
        client.lessonOccurrence.findMany({
          where: {
            ...lessonWhere,
            scheduled_at: { gt: now },
            status: { in: ['SCHEDULED', 'STAR_PENDING'] },
          },
          orderBy: [{ scheduled_at: 'asc' }, { id: 'asc' }],
          take: 5,
          select: { id: true, scheduled_at: true, status: true },
        }),
        client.lessonOccurrence.findMany({
          where: { ...lessonWhere, scheduled_at: { lte: now } },
          orderBy: [{ scheduled_at: 'desc' }, { id: 'desc' }],
          take: 5,
          select: { id: true, scheduled_at: true, status: true },
        }),
      ]);
      const [counts] = await client.$queryRaw<
        {
          confirmed: number;
          not_submitted: number;
          awaiting: number;
          revision: number;
          reviewed: number;
          goals: number;
          checkpoints: number;
        }[]
      >(Prisma.sql`
        SELECT
          (SELECT count(*)::int FROM lesson_actual_outcomes o
             JOIN lesson_occurrences l ON l.id = o.lesson_occurrence_id
             JOIN student_subject_enrollments e ON e.id = l.enrollment_id
            WHERE e.student_id = ${enrollment.student_id}::uuid AND e.subject_id = ${enrollment.subject_id}::uuid
              AND l.status = 'CONDUCTED') AS confirmed,
          count(*) FILTER (WHERE h.state = 'NOT_SUBMITTED')::int AS not_submitted,
          count(*) FILTER (WHERE h.state = 'AWAITING')::int AS awaiting,
          count(*) FILTER (WHERE h.state = 'REVISION')::int AS revision,
          count(*) FILTER (WHERE h.state = 'REVIEWED')::int AS reviewed,
          (SELECT count(*)::int FROM learning_goals g WHERE g.enrollment_id = ${enrollmentId}::uuid AND g.status = 'ACTIVE') AS goals,
          (SELECT count(*)::int FROM progress_checkpoints cp
            WHERE cp.enrollment_id = ${enrollmentId}::uuid AND (
              (cp.type = 'LESSON_4' AND cp.completed_at IS NULL) OR
              (cp.type = 'LESSON_8' AND NOT EXISTS (SELECT 1 FROM education_reports r WHERE r.checkpoint_id = cp.id AND r.status = 'PUBLISHED')))) AS checkpoints
        FROM (
          SELECT CASE WHEN d.cancelled_at IS NOT NULL THEN 'CANCELLED'
                      WHEN latest.id IS NULL THEN 'NOT_SUBMITTED'
                      WHEN review.result IS NULL THEN 'AWAITING'
                      WHEN review.result = 'NEEDS_REVISION' THEN 'REVISION' ELSE 'REVIEWED' END AS state
          FROM homework_deliveries d
          LEFT JOIN LATERAL (SELECT id FROM homework_submissions WHERE delivery_id = d.id ORDER BY version DESC LIMIT 1) latest ON true
          LEFT JOIN LATERAL (SELECT result::text AS result FROM submission_reviews WHERE submission_id = latest.id ORDER BY version DESC LIMIT 1) review ON true
          WHERE d.enrollment_id = ${enrollmentId}::uuid AND d.issued_by = ${ctx.teacherId}::uuid
        ) h`);
      const levels = await client.$queryRaw<{ level: string | null }[]>(Prisma.sql`
        SELECT a.level::text AS level FROM skill_entries sk
        LEFT JOIN LATERAL (
          SELECT sa.level FROM skill_assessments sa JOIN student_subject_enrollments e ON e.id = sa.enrollment_id
          WHERE sa.skill_id = sk.id AND e.student_id = ${enrollment.student_id}::uuid
          ORDER BY sa.assessed_at DESC, sa.version DESC, sa.id DESC LIMIT 1) a ON true
        WHERE sk.subject_id = ${enrollment.subject_id}::uuid AND sk.archived_at IS NULL
          AND (sk.student_id IS NULL OR sk.student_id = ${enrollment.student_id}::uuid)`);
      const skills = { notStudied: 0, familiarizing: 0, practicing: 0, applying: 0 };
      for (const { level } of levels) {
        if (level === 'INTRODUCING') skills.familiarizing += 1;
        else if (level === 'PRACTICING') skills.practicing += 1;
        else if (level === 'APPLYING') skills.applying += 1;
        else skills.notStudied += 1;
      }
      const lesson = (l: { id: string; scheduled_at: Date; status: string }) => ({
        lessonId: l.id,
        startsAt: l.scheduled_at.toISOString(),
        status: l.status,
      });
      return ok({
        enrollmentId,
        studentId: enrollment.student_id,
        studentName: enrollment.student_ref.display_name ?? enrollment.student_ref.full_name,
        subjectName: enrollment.subject_ref.name,
        confirmedLessons: counts!.confirmed,
        lessonsToNextReview: 4 - (counts!.confirmed % 4),
        upcomingLessons: upcoming.map(lesson),
        recentLessons: recent.map(lesson),
        homework: {
          notSubmitted: counts!.not_submitted,
          awaitingReview: counts!.awaiting,
          needsRevision: counts!.revision,
          reviewed: counts!.reviewed,
        },
        skills,
        activeGoals: counts!.goals,
        pendingCheckpoints: counts!.checkpoints,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }
}
