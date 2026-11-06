import { Injectable } from '@nestjs/common';
import { ok } from '@online-school/shared';
import {
  StaffActorContextService,
  sourceTimestamp,
} from '../../core/actor/actor-context.service.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { unwrap, fail, domainError } from '../../core/errors/domain-error.js';
import type { AccountContext } from '../../core/http.js';
import type { PlatformWorkspaceDto, WorkspaceCoverageDto } from './platform.dto.js';

function coverage(
  rows: readonly { updated_at?: Date }[],
  limit: number,
  scope: WorkspaceCoverageDto['scope'],
  windowFrom: string | null = null,
): WorkspaceCoverageDto {
  const returned = rows.slice(0, limit);
  const timestamps = returned
    .map((row) => sourceTimestamp(row.updated_at))
    .filter((v): v is string => v !== null);
  return {
    scope,
    windowFrom,
    windowTo: null,
    sourceUpdatedAt: timestamps.sort().at(-1) ?? null,
    pageInfo: { limit, returned: returned.length, hasMore: rows.length > limit, total: null },
  };
}
@Injectable()
export class PlatformWorkspaceService {
  constructor(
    private readonly actors: StaffActorContextService,
    private readonly transactions: TransactionService,
  ) {}
  async get(actor: AccountContext): Promise<PlatformWorkspaceDto> {
    return unwrap(
      await this.transactions.runReadOnly(async (db) => {
        const actorContext = await this.actors.get(actor, db);
        if (actorContext.role !== 'TEACHER' && actorContext.role !== 'DIRECTOR')
          return fail(domainError('FORBIDDEN', 403));
        const director = actorContext.role === 'DIRECTOR';
        const profileId = actorContext.teacherProfileId;
        const scope = director ? 'SCHOOL' : 'OWN_TEACHER';
        const now = new Date(actorContext.asOf),
          since = new Date(+now - 86400000);
        const lessons = await db.lessonOccurrence.findMany({
          where: {
            ...(director ? {} : { scheduled_teacher_id: profileId! }),
            scheduled_at: { gte: since },
          },
          orderBy: [{ scheduled_at: 'asc' }, { id: 'asc' }],
          take: 101,
          include: {
            enrollment_ref: { include: { student_ref: true, subject_ref: true } },
            scheduled_teacher_ref: true,
          },
        });
        const assignments = await db.teachingAssignment.findMany({
          where: {
            ...(director ? {} : { teacher_id: profileId! }),
            valid_from: { lte: now },
            OR: [{ valid_to: null }, { valid_to: { gt: now } }],
          },
          orderBy: { id: 'asc' },
          take: 101,
          include: { enrollment_ref: { include: { student_ref: true, subject_ref: true } } },
        });
        const homework = await db.homeworkAssignment.findMany({
          where: director ? {} : { issued_by: profileId! },
          orderBy: [{ due_at: 'asc' }, { id: 'asc' }],
          take: 51,
          include: { subject_ref: true },
        });
        const tasks = director
          ? await db.crmTask.findMany({
              where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
              orderBy: [{ due_at: 'asc' }, { id: 'asc' }],
              take: 51,
              include: { assigned_to: true },
            })
          : [];
        return ok({
          actorContext,
          name: actorContext.displayName,
          role: actorContext.role,
          coverage: {
            lessons: coverage(lessons, 100, scope, since.toISOString()),
            students: coverage(assignments, 100, scope),
            homework: coverage(homework, 50, scope),
            tasks: coverage(tasks, 50, director ? 'SCHOOL' : 'NOT_APPLICABLE'),
          },
          lessons: lessons.slice(0, 100).map((l) => ({
            id: l.id,
            startsAt: l.scheduled_at.toISOString(),
            endsAt: l.scheduled_end_at.toISOString(),
            status: l.status,
            subject: l.enrollment_ref.subject_ref.name,
            student:
              l.enrollment_ref.student_ref.display_name ?? l.enrollment_ref.student_ref.full_name,
            teacher: l.scheduled_teacher_ref.full_name,
            meetUrl: l.google_meet_link,
          })),
          students: assignments.slice(0, 100).map((a) => ({
            id: a.enrollment_ref.student_id,
            name:
              a.enrollment_ref.student_ref.display_name ?? a.enrollment_ref.student_ref.full_name,
            subject: a.enrollment_ref.subject_ref.name,
          })),
          homework: homework.slice(0, 50).map((h) => ({
            id: h.id,
            title: h.title,
            subject: h.subject_ref.name,
            dueAt: h.due_at?.toISOString() ?? null,
          })),
          tasks: tasks.slice(0, 50).map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            dueAt: t.due_at.toISOString(),
            manager: t.assigned_to?.full_name ?? 'Не назначен',
          })),
        });
      }),
    );
  }
}
