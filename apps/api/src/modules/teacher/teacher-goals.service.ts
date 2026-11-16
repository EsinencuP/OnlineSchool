import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { at } from '../finance/finance-common.js';
import type { TeacherContext } from './context/teacher-context.js';
import type {
  CreateGoalDto,
  GoalCommandResponseDto,
  TeacherGoalsResponseDto,
  UpdateGoalDto,
} from './dto/teacher-goals.dto.js';

const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (value: string): Date | null => {
  const d = new Date(value + 'T00:00:00Z');
  return Number.isNaN(+d) || d.toISOString().slice(0, 10) !== value ? null : d;
};
const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

@Injectable()
export class TeacherGoalsService {
  constructor(private readonly db: DatabaseService) {}

  // Active assignment of this teacher to the enrollment, otherwise a uniform 404.
  private async owned(
    client: Prisma.TransactionClient | DatabaseService['client'],
    teacherId: string,
    enrollmentId: string,
    now: Date,
  ) {
    if (!UUID_RE.test(enrollmentId)) return fail(domainError('INVALID_INPUT', 422));
    const enrollment = await client.studentSubjectEnrollment.findFirst({
      where: {
        id: enrollmentId,
        t03_teachingassignment_enrollment_id: {
          some: {
            teacher_id: teacherId,
            valid_from: { lte: now },
            OR: [{ valid_to: null }, { valid_to: { gt: now } }],
          },
        },
      },
      select: { id: true, student_id: true, subject_id: true, status: true },
    });
    return enrollment ?? fail(domainError('NOT_FOUND', 404));
  }

  async list(
    ctx: TeacherContext,
    enrollmentId: string,
  ): Promise<Result<TeacherGoalsResponseDto, DomainError>> {
    try {
      const now = (
        await this.db.client.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      )[0]!.now;
      const enrollment = await this.owned(this.db.client, ctx.teacherId, enrollmentId, now);
      const goals = await this.db.client.learningGoal.findMany({
        where: { enrollment_id: enrollment.id },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 200,
      });
      return ok({
        enrollmentId,
        goals: goals.map((g) => ({
          goalId: g.id,
          text: g.text,
          targetDate: dateOnly(g.target_date),
          status: g.status,
          skillId: g.skill_id,
          createdAt: g.created_at.toISOString(),
          updatedAt: g.updated_at.toISOString(),
        })),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  private async teacher(ctx: CriticalContext): Promise<string> {
    const t = await ctx.tx.teacherAccount.findFirst({
      where: { account_id: ctx.actor.accountId, deactivated_at: null },
      select: { id: true },
    });
    return t?.id ?? fail(domainError('FORBIDDEN', 403));
  }

  async create(
    ctx: CriticalContext,
    enrollmentId: string,
    body: CreateGoalDto,
  ): Promise<GoalCommandResponseDto> {
    const teacher = await this.teacher(ctx);
    const now = await at(ctx.tx);
    const enrollment = await this.owned(ctx.tx, teacher, enrollmentId, now);
    if (enrollment.status !== 'ACTIVE') return fail(domainError('ENROLLMENT_INACTIVE', 422));
    const target = body.targetDate ? day(body.targetDate) : null;
    if (body.targetDate && !target) return fail(domainError('INVALID_INPUT', 422));
    if (target && +target < +day(now.toISOString().slice(0, 10))!)
      return fail(domainError('GOAL_DATE_IN_PAST', 422));
    if (body.skillId) {
      const skill = await ctx.tx.skillEntry.findFirst({
        where: {
          id: body.skillId,
          archived_at: null,
          subject_id: enrollment.subject_id,
          OR: [{ student_id: null }, { student_id: enrollment.student_id }],
        },
        select: { id: true },
      });
      if (!skill) return fail(domainError('NOT_FOUND', 404));
    }
    const goal = await ctx.tx.learningGoal.create({
      data: {
        enrollment_id: enrollment.id,
        skill_id: body.skillId ?? null,
        text: body.text.trim(),
        target_date: target,
        created_by: teacher,
        updated_by: teacher,
        created_at: now,
      },
    });
    return { id: goal.id, status: goal.status };
  }

  async update(
    ctx: CriticalContext,
    enrollmentId: string,
    goalId: string,
    body: UpdateGoalDto,
  ): Promise<GoalCommandResponseDto> {
    if (!UUID_RE.test(goalId)) return fail(domainError('INVALID_INPUT', 422));
    if (body.text === undefined && body.targetDate === undefined && body.status === undefined)
      return fail(domainError('INVALID_INPUT', 422));
    const teacher = await this.teacher(ctx);
    const now = await at(ctx.tx);
    const enrollment = await this.owned(ctx.tx, teacher, enrollmentId, now);
    await ctx.tx.$queryRaw`SELECT id FROM learning_goals WHERE id=${goalId}::uuid FOR UPDATE`;
    const goal = await ctx.tx.learningGoal.findFirst({
      where: { id: goalId, enrollment_id: enrollment.id },
    });
    if (!goal) return fail(domainError('NOT_FOUND', 404));
    if (goal.status === 'ARCHIVED') return fail(domainError('GOAL_ARCHIVED', 409));
    let target: Date | null | undefined;
    if (body.targetDate === null) target = null;
    else if (body.targetDate !== undefined) {
      target = day(body.targetDate);
      if (!target) return fail(domainError('INVALID_INPUT', 422));
    }
    const updated = await ctx.tx.learningGoal.update({
      where: { id: goal.id },
      data: {
        ...(body.text !== undefined ? { text: body.text.trim() } : {}),
        ...(target !== undefined ? { target_date: target } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        updated_by: teacher,
      },
    });
    return { id: updated.id, status: updated.status };
  }
}
