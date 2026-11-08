import { Injectable } from '@nestjs/common';
import { ok } from '@online-school/shared';
import {
  StaffActorContextService,
  sourceTimestamp,
} from '../../core/actor/actor-context.service.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { unwrap, fail, domainError } from '../../core/errors/domain-error.js';
import type { AccountContext } from '../../core/http.js';
import type { Prisma } from '@online-school/db';
import { workspaceDetailSections } from './platform.dto.js';
import type {
  PlatformWorkspaceDto,
  WorkspaceCoverageDto,
  WorkspaceDetailDto,
} from './platform.dto.js';

const enrollment = { include: { student_ref: true, subject_ref: true } } as const;
const lessonRelations = { enrollment_ref: enrollment, scheduled_teacher_ref: true } as const;
const homeworkRelations = { subject_ref: true } as const;
const taskRelations = { assigned_to: true } as const;
const openTasks = { status: { in: ['OPEN', 'IN_PROGRESS'] } } satisfies Prisma.CrmTaskWhereInput;
const activeAssignment = (now: Date) => ({
  valid_from: { lte: now },
  OR: [{ valid_to: null }, { valid_to: { gt: now } }],
});
const studentName = (student: { display_name: string | null; full_name: string }) =>
  student.display_name ?? student.full_name;
function lessonItem(row: Prisma.LessonOccurrenceGetPayload<{ include: typeof lessonRelations }>) {
  return {
    id: row.id,
    startsAt: row.scheduled_at.toISOString(),
    endsAt: row.scheduled_end_at.toISOString(),
    status: row.status,
    subject: row.enrollment_ref.subject_ref.name,
    student: studentName(row.enrollment_ref.student_ref),
    teacher: row.scheduled_teacher_ref.full_name,
  };
}
function homeworkItem(
  row: Prisma.HomeworkAssignmentGetPayload<{ include: typeof homeworkRelations }>,
) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject_ref.name,
    dueAt: row.due_at?.toISOString() ?? null,
  };
}
function taskItem(row: Prisma.CrmTaskGetPayload<{ include: typeof taskRelations }>) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    dueAt: row.due_at.toISOString(),
    manager: row.assigned_to?.full_name ?? 'Не назначен',
  };
}

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
  async getDetail(actor: AccountContext, section: string, id: string): Promise<WorkspaceDetailDto> {
    if (!workspaceDetailSections.some((value) => value === section))
      return fail(domainError('INVALID_INPUT', 400));
    return unwrap(
      await this.transactions.runReadOnly(async (db) => {
        const actorContext = await this.actors.get(actor, db);
        const director = actorContext.role === 'DIRECTOR';
        const teacherId = actorContext.teacherProfileId;
        if (!director && (actorContext.role !== 'TEACHER' || !teacherId))
          return fail(domainError('FORBIDDEN', 403));
        let item: WorkspaceDetailDto['item'] | undefined;
        if (section === 'lessons') {
          const row = await db.lessonOccurrence.findFirst({
            where: { id, ...(director ? {} : { scheduled_teacher_id: teacherId! }) },
            include: lessonRelations,
          });
          if (row) item = lessonItem(row);
        } else if (section === 'students') {
          const rows = await db.teachingAssignment.findMany({
            where: {
              enrollment_ref: { student_id: id },
              ...activeAssignment(new Date(actorContext.asOf)),
              ...(director ? {} : { teacher_id: teacherId! }),
            },
            orderBy: { id: 'asc' },
            include: { enrollment_ref: enrollment },
          });
          if (rows[0])
            item = {
              id,
              name: studentName(rows[0].enrollment_ref.student_ref),
              subjects: [...new Set(rows.map((row) => row.enrollment_ref.subject_ref.name))],
            };
        } else if (section === 'homework' && !director) {
          const row = await db.homeworkAssignment.findFirst({
            where: { id, issued_by: teacherId! },
            include: homeworkRelations,
          });
          if (row) item = homeworkItem(row);
        } else if (section === 'tasks' && director) {
          const row = await db.crmTask.findFirst({
            where: { id, ...openTasks },
            include: taskRelations,
          });
          if (row) item = taskItem(row);
        }
        return item ? ok({ actorContext, item }) : fail(domainError('NOT_FOUND', 404));
      }),
    );
  }
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
          include: lessonRelations,
        });
        const assignments = await db.teachingAssignment.findMany({
          where: {
            ...(director ? {} : { teacher_id: profileId! }),
            ...activeAssignment(now),
          },
          orderBy: { id: 'asc' },
          take: 101,
          include: { enrollment_ref: enrollment },
        });
        const homework = await db.homeworkAssignment.findMany({
          where: director ? {} : { issued_by: profileId! },
          orderBy: [{ due_at: 'asc' }, { id: 'asc' }],
          take: 51,
          include: homeworkRelations,
        });
        const tasks = director
          ? await db.crmTask.findMany({
              where: openTasks,
              orderBy: [{ due_at: 'asc' }, { id: 'asc' }],
              take: 51,
              include: taskRelations,
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
            ...lessonItem(l),
            meetUrl: l.google_meet_link,
          })),
          students: assignments.slice(0, 100).map((a) => ({
            id: a.enrollment_ref.student_id,
            name: studentName(a.enrollment_ref.student_ref),
            subject: a.enrollment_ref.subject_ref.name,
          })),
          homework: homework.slice(0, 50).map(homeworkItem),
          tasks: tasks.slice(0, 50).map(taskItem),
        });
      }),
    );
  }
}
