import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { at } from '../finance/finance-common.js';
import type { TeacherContext } from './context/teacher-context.js';
import type {
  AssessSkillDto,
  AssessSkillResponseDto,
  SkillStatus,
  TeacherEnrollmentsResponseDto,
  TeacherSkillHistoryDto,
  TeacherSkillMapDto,
} from './dto/teacher-skills.dto.js';

const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Storage level -> public status (same mapping as the student map and stu08_skill_status()).
const publicStatus = (level: string | null | undefined): SkillStatus =>
  level === 'INTRODUCING'
    ? 'FAMILIARIZING'
    : level === 'PRACTICING' || level === 'APPLYING'
      ? level
      : 'NOT_STUDIED';
const storageLevel = (status: SkillStatus) =>
  (status === 'FAMILIARIZING' ? 'INTRODUCING' : status) as
    'NOT_STUDIED' | 'INTRODUCING' | 'PRACTICING' | 'APPLYING';

@Injectable()
export class TeacherSkillsService {
  constructor(private readonly db: DatabaseService) {}

  async enrollments(
    ctx: TeacherContext,
  ): Promise<Result<TeacherEnrollmentsResponseDto, DomainError>> {
    try {
      const rows = await this.db.client.$queryRaw<
        {
          enrollment_id: string;
          student_id: string;
          student_name: string;
          subject_id: string;
          subject_name: string;
          assigned_from: Date;
          confirmed_lessons: number;
          next_lesson_at: Date | null;
        }[]
      >(Prisma.sql`
        SELECT e.id AS enrollment_id, s.id AS student_id,
               COALESCE(s.display_name, s.full_name) AS student_name,
               sub.id AS subject_id, sub.name AS subject_name,
               (SELECT min(a.valid_from) FROM teaching_assignments a
                 WHERE a.enrollment_id = e.id AND a.teacher_id = ${ctx.teacherId}::uuid
                   AND a.valid_from <= clock_timestamp()
                   AND (a.valid_to IS NULL OR a.valid_to > clock_timestamp())) AS assigned_from,
               (SELECT count(*)::int FROM lesson_actual_outcomes o
                  JOIN lesson_occurrences l ON l.id = o.lesson_occurrence_id
                  JOIN student_subject_enrollments e2 ON e2.id = l.enrollment_id
                 WHERE e2.student_id = e.student_id AND e2.subject_id = e.subject_id
                   AND l.status = 'CONDUCTED') AS confirmed_lessons,
               (SELECT min(l.scheduled_at) FROM lesson_occurrences l
                 WHERE l.enrollment_id = e.id AND l.scheduled_teacher_id = ${ctx.teacherId}::uuid
                   AND l.status IN ('SCHEDULED', 'STAR_PENDING')
                   AND l.scheduled_at > clock_timestamp()) AS next_lesson_at
        FROM student_subject_enrollments e
        JOIN students s ON s.id = e.student_id
        JOIN subjects sub ON sub.id = e.subject_id
        WHERE e.status = 'ACTIVE' AND EXISTS (
          SELECT 1 FROM teaching_assignments a
          WHERE a.enrollment_id = e.id AND a.teacher_id = ${ctx.teacherId}::uuid
            AND a.valid_from <= clock_timestamp()
            AND (a.valid_to IS NULL OR a.valid_to > clock_timestamp()))
        ORDER BY student_name, subject_name, e.id
        LIMIT 200`);
      return ok({
        items: rows.map((r) => ({
          enrollmentId: r.enrollment_id,
          studentId: r.student_id,
          studentName: r.student_name,
          subjectId: r.subject_id,
          subjectName: r.subject_name,
          assignedFrom: r.assigned_from.toISOString(),
          confirmedLessons: r.confirmed_lessons,
          nextLessonAt: r.next_lesson_at?.toISOString() ?? null,
        })),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  // Enrollment the teacher actively teaches, or a uniform 404 (does not reveal foreign enrollments).
  private async owned(
    client: Prisma.TransactionClient | DatabaseService['client'],
    teacherId: string,
    enrollmentId: string,
    now: Date,
    mustBeActive: boolean,
  ) {
    if (!UUID_RE.test(enrollmentId)) return fail(domainError('INVALID_INPUT', 422));
    const enrollment = await client.studentSubjectEnrollment.findFirst({
      where: {
        id: enrollmentId,
        ...(mustBeActive ? { status: 'ACTIVE' as const } : {}),
        t03_teachingassignment_enrollment_id: {
          some: {
            teacher_id: teacherId,
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
    return enrollment ?? fail(domainError('NOT_FOUND', 404));
  }

  private async dbNow(client: DatabaseService['client']): Promise<Date> {
    return (await client.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
  }

  async map(
    ctx: TeacherContext,
    enrollmentId: string,
  ): Promise<Result<TeacherSkillMapDto, DomainError>> {
    try {
      const client = this.db.client;
      const enrollment = await this.owned(
        client,
        ctx.teacherId,
        enrollmentId,
        await this.dbNow(client),
        false,
      );
      const rows = await client.$queryRaw<
        {
          skill_id: string;
          name: string;
          category: string;
          personal: boolean;
          level: string | null;
          assessed_at: Date | null;
          teacher_name: string | null;
          public_comment: string | null;
        }[]
      >(Prisma.sql`
        SELECT sk.id AS skill_id, sk.label AS name, sk.category, sk.student_id IS NOT NULL AS personal,
               a.level::text AS level, a.assessed_at, t.full_name AS teacher_name, a.public_comment
        FROM skill_entries sk
        LEFT JOIN LATERAL (
          SELECT sa.* FROM skill_assessments sa
          JOIN student_subject_enrollments e ON e.id = sa.enrollment_id
          WHERE sa.skill_id = sk.id AND e.student_id = ${enrollment.student_id}::uuid
          ORDER BY sa.assessed_at DESC, sa.version DESC, sa.id DESC LIMIT 1
        ) a ON true
        LEFT JOIN teacher_accounts t ON t.id = a.assessed_by
        WHERE sk.subject_id = ${enrollment.subject_id}::uuid AND sk.archived_at IS NULL
          AND (sk.student_id IS NULL OR sk.student_id = ${enrollment.student_id}::uuid)
        ORDER BY sk.category, sk.label, sk.id`);
      return ok({
        enrollmentId,
        studentName: enrollment.student_ref.display_name ?? enrollment.student_ref.full_name,
        subjectName: enrollment.subject_ref.name,
        skills: rows.map((r) => ({
          skillId: r.skill_id,
          name: r.name,
          category: r.category,
          personal: r.personal,
          status: publicStatus(r.level),
          assessedAt: r.assessed_at?.toISOString() ?? null,
          assessedByName: r.teacher_name,
          publicComment: r.public_comment,
        })),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async history(
    ctx: TeacherContext,
    enrollmentId: string,
    skillId: string,
  ): Promise<Result<TeacherSkillHistoryDto, DomainError>> {
    try {
      const client = this.db.client;
      if (!UUID_RE.test(skillId)) return err(domainError('INVALID_INPUT', 422));
      const enrollment = await this.owned(
        client,
        ctx.teacherId,
        enrollmentId,
        await this.dbNow(client),
        false,
      );
      const skill = await client.skillEntry.findFirst({
        where: {
          id: skillId,
          subject_id: enrollment.subject_id,
          OR: [{ student_id: null }, { student_id: enrollment.student_id }],
        },
        select: { id: true, label: true },
      });
      if (!skill) return err(domainError('NOT_FOUND', 404));
      const rows = await client.skillAuditLog.findMany({
        where: { skill_id: skill.id, enrollment_ref: { student_id: enrollment.student_id } },
        orderBy: [{ changed_at: 'desc' }, { id: 'desc' }],
        take: 50,
        select: {
          id: true,
          changed_at: true,
          from_status: true,
          to_status: true,
          teacher_name: true,
          public_comment: true,
          assessment_ref: { select: { basis: true } },
        },
      });
      return ok({
        skillId: skill.id,
        skillName: skill.label,
        items: rows.map((r) => ({
          auditId: r.id,
          changedAt: r.changed_at.toISOString(),
          fromStatus: r.from_status,
          toStatus: r.to_status,
          teacherName: r.teacher_name,
          publicComment: r.public_comment,
          basis: r.assessment_ref.basis,
        })),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async assess(
    ctx: CriticalContext,
    enrollmentId: string,
    skillId: string,
    body: AssessSkillDto,
  ): Promise<AssessSkillResponseDto> {
    if (!UUID_RE.test(skillId)) return fail(domainError('INVALID_INPUT', 422));
    const tx = ctx.tx;
    const teacher = await tx.teacherAccount.findFirst({
      where: { account_id: ctx.actor.accountId, deactivated_at: null },
      select: { id: true },
    });
    if (!teacher) return fail(domainError('FORBIDDEN', 403));
    const now = await at(tx);
    const enrollment = await this.owned(tx, teacher.id, enrollmentId, now, true);
    const skill = await tx.skillEntry.findFirst({
      where: {
        id: skillId,
        archived_at: null,
        subject_id: enrollment.subject_id,
        OR: [{ student_id: null }, { student_id: enrollment.student_id }],
      },
      select: { id: true },
    });
    if (!skill) return fail(domainError('NOT_FOUND', 404));
    await tx.$queryRaw`SELECT id FROM students WHERE id=${enrollment.student_id}::uuid FOR UPDATE`;
    const previous = await tx.skillAssessment.findFirst({
      where: { skill_id: skill.id, enrollment_ref: { student_id: enrollment.student_id } },
      orderBy: [{ assessed_at: 'desc' }, { version: 'desc' }, { id: 'desc' }],
      select: { id: true, level: true, version: true, assessed_at: true, enrollment_id: true },
    });
    const from = publicStatus(previous?.level);
    if (from === body.level) return fail(domainError('SKILL_LEVEL_UNCHANGED', 409));
    if (previous && +previous.assessed_at >= +now)
      return fail(domainError('SKILL_CHANGED_CONCURRENTLY', 409));
    if (body.lessonId) {
      const lesson = await tx.lessonOccurrence.findFirst({
        where: {
          id: body.lessonId,
          enrollment_id: enrollmentId,
          status: 'CONDUCTED',
          t03_lessonactualoutcome_lesson_occurrence_id: { is: { confirmed_at: { lte: now } } },
        },
        select: { id: true },
      });
      if (!lesson) return fail(domainError('SKILL_LESSON_NOT_CONFIRMED', 422));
    }
    const sameEnrollment = previous?.enrollment_id === enrollmentId;
    const created = await tx.skillAssessment.create({
      data: {
        skill_id: skill.id,
        enrollment_id: enrollmentId,
        assessed_by: teacher.id,
        assessed_at: now,
        lesson_ref: body.lessonId ?? null,
        level: storageLevel(body.level),
        version: sameEnrollment ? previous!.version + 1 : 1,
        basis: body.basis.trim(),
        public_comment: body.publicComment?.trim() || null,
        supersedes_assessment_id: sameEnrollment ? previous!.id : null,
        source_operation_id: ctx.operationId,
      },
    });
    return {
      id: created.id,
      skillId: skill.id,
      enrollmentId,
      fromStatus: from,
      toStatus: body.level,
      assessedAt: now.toISOString(),
    };
  }
}
