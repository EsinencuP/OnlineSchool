import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError, fail } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { at } from '../finance/finance-common.js';
import { MEET_REVOCATION_TOPIC } from '../schedule/google-meet/meet-operations.js';
import type {
  HandoverDto,
  HandoverListDto,
  StaffCardDto,
  StaffItemDto,
  StaffKind,
  StaffListDto,
  StaffQueryDto,
  StatusChangeDto,
} from './dto/director-staff.dto.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const OPEN_TASK = Prisma.sql`('OPEN','IN_PROGRESS')`;
const DAY = 86_400_000;

type StaffRow = {
  kind: StaffKind;
  id: string;
  full_name: string;
  deactivated_at: Date | null;
  disabled_at: Date | null;
  students: number;
  leads: number;
  open_tasks: number;
  open_escalations: number;
  availability: string | null;
  active_students: number;
  lessons_7d: number;
  future_lessons: number;
};
type HandoverRow = {
  id: string;
  student_id: string | null;
  lead_id: string | null;
  from_id: string | null;
  from_name: string | null;
  to_id: string;
  to_name: string;
  comment: string | null;
  moved_tasks: number;
  handed_over_at: Date;
};

const handover = (r: HandoverRow): HandoverDto => ({
  handoverId: r.id,
  subjectKind: r.student_id ? 'STUDENT' : 'LEAD',
  subjectId: (r.student_id ?? r.lead_id)!,
  fromManagerId: r.from_id,
  fromManagerName: r.from_name,
  toManagerId: r.to_id,
  toManagerName: r.to_name,
  movedTasks: r.moved_tasks,
  comment: r.comment,
  handedOverAt: r.handed_over_at.toISOString(),
});
const handoverSelect = Prisma.sql`
  SELECT h.id, h.student_id, h.lead_id, h.from_manager_id AS from_id, f.full_name AS from_name,
         h.to_manager_id AS to_id, t.full_name AS to_name, h.comment, h.moved_tasks, h.handed_over_at
  FROM manager_handovers h
  LEFT JOIN staff_accounts f ON f.id = h.from_manager_id
  JOIN staff_accounts t ON t.id = h.to_manager_id`;

const staffSelect = (now: Date) => Prisma.sql`
  WITH people AS (
    SELECT 'MANAGER'::text AS kind, s.id, s.full_name, s.deactivated_at, a.disabled_at
    FROM staff_accounts s
    JOIN auth_accounts a ON a.id = s.account_id
    WHERE EXISTS (SELECT 1 FROM role_assignments ra JOIN roles r ON r.id = ra.role_id
                  WHERE ra.account_id = s.account_id AND r.code = 'MANAGER' AND ra.valid_to IS NULL)
    UNION ALL
    SELECT 'TEACHER', t.id, t.full_name, t.deactivated_at, a.disabled_at
    FROM teacher_accounts t JOIN auth_accounts a ON a.id = t.account_id
  )
  SELECT p.*,
    (SELECT count(*)::int FROM assigned_managers am WHERE am.manager_id = p.id AND p.kind = 'MANAGER'
        AND am.student_id IS NOT NULL AND am.ended_at IS NULL) AS students,
    (SELECT count(*)::int FROM assigned_managers am WHERE am.manager_id = p.id AND p.kind = 'MANAGER'
        AND am.lead_id IS NOT NULL AND am.ended_at IS NULL) AS leads,
    (SELECT count(*)::int FROM crm_tasks c WHERE c.assigned_manager_id = p.id AND p.kind = 'MANAGER'
        AND c.status::text IN ${OPEN_TASK}) AS open_tasks,
    (SELECT count(*)::int FROM task_escalations e JOIN crm_tasks c ON c.id = e.task_id
      WHERE e.primary_manager_id = p.id AND p.kind = 'MANAGER' AND e.accepted_at IS NULL
        AND c.status::text IN ${OPEN_TASK}) AS open_escalations,
    (SELECT m.status FROM manager_availability m WHERE m.manager_id = p.id AND p.kind = 'MANAGER') AS availability,
    (SELECT count(DISTINCT en.student_id)::int FROM teaching_assignments ta
       JOIN student_subject_enrollments en ON en.id = ta.enrollment_id
      WHERE ta.teacher_id = p.id AND p.kind = 'TEACHER' AND ta.valid_from <= ${now}
        AND (ta.valid_to IS NULL OR ta.valid_to > ${now}) AND en.valid_to IS NULL AND en.status = 'ACTIVE') AS active_students,
    (SELECT count(*)::int FROM lesson_occurrences l WHERE l.scheduled_teacher_id = p.id AND p.kind = 'TEACHER'
        AND l.status <> 'CANCELLED' AND l.scheduled_at >= ${now}
        AND l.scheduled_at < ${new Date(+now + 7 * DAY)}) AS lessons_7d,
    (SELECT count(*)::int FROM lesson_occurrences l WHERE l.scheduled_teacher_id = p.id AND p.kind = 'TEACHER'
        AND l.status <> 'CANCELLED' AND l.scheduled_at >= ${now}) AS future_lessons
  FROM people p`;

const item = (r: StaffRow): StaffItemDto => ({
  kind: r.kind,
  id: r.id,
  fullName: r.full_name,
  active: !r.deactivated_at && !r.disabled_at,
  deactivatedAt: r.deactivated_at?.toISOString() ?? null,
  metrics:
    r.kind === 'MANAGER'
      ? {
          students: r.students,
          leads: r.leads,
          openTasks: r.open_tasks,
          openEscalations: r.open_escalations,
          availability: r.availability ?? 'AVAILABLE',
        }
      : {
          activeStudents: r.active_students,
          lessonsNext7Days: r.lessons_7d,
          futureLessons: r.future_lessons,
        },
});

/** DEV-07/B and staff lifecycle: director-only people management. */
@Injectable()
export class DirectorStaffService {
  constructor(private readonly db: DatabaseService) {}

  async list(q: StaffQueryDto): Promise<Result<StaffListDto, DomainError>> {
    try {
      const rows = await this.db.client.$queryRaw<StaffRow[]>(Prisma.sql`
        ${staffSelect(new Date())}
        WHERE true
          ${q.kind ? Prisma.sql`AND p.kind = ${q.kind}` : Prisma.empty}
          ${q.active === 'true' ? Prisma.sql`AND p.deactivated_at IS NULL AND p.disabled_at IS NULL` : Prisma.empty}
          ${q.active === 'false' ? Prisma.sql`AND (p.deactivated_at IS NOT NULL OR p.disabled_at IS NOT NULL)` : Prisma.empty}
          ${q.search?.trim() ? Prisma.sql`AND p.full_name ILIKE ${'%' + q.search.trim().replace(/[%_\\]/g, '\\$&') + '%'}` : Prisma.empty}
        ORDER BY p.kind, p.full_name, p.id`);
      return ok({ items: rows.map(item) });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async card(kind: string, id: string): Promise<Result<StaffCardDto, DomainError>> {
    if (!['MANAGER', 'TEACHER'].includes(kind) || !UUID_RE.test(id))
      return err(domainError('STAFF_NOT_FOUND', 404));
    try {
      const [row] = await this.db.client.$queryRaw<StaffRow[]>(
        Prisma.sql`${staffSelect(new Date())} WHERE p.kind = ${kind} AND p.id = ${id}::uuid`,
      );
      if (!row) return err(domainError('STAFF_NOT_FOUND', 404));
      const changes = await this.db.client.$queryRaw<
        { action: string; reason: string; by_name: string; changed_at: Date }[]
      >(Prisma.sql`
        SELECT c.action, c.reason, d.full_name AS by_name, c.changed_at
        FROM staff_status_changes c JOIN staff_accounts d ON d.id = c.by_director_id
        WHERE ${kind === 'MANAGER' ? Prisma.sql`c.staff_id` : Prisma.sql`c.teacher_id`} = ${id}::uuid
        ORDER BY c.changed_at DESC LIMIT 20`);
      const handovers =
        kind === 'MANAGER'
          ? await this.db.client.$queryRaw<HandoverRow[]>(Prisma.sql`${handoverSelect}
              WHERE h.to_manager_id = ${id}::uuid OR h.from_manager_id = ${id}::uuid
              ORDER BY h.handed_over_at DESC, h.id DESC LIMIT 20`)
          : [];
      const statusHistory: StatusChangeDto[] = changes.map((c) => ({
        action: c.action,
        reason: c.reason,
        byDirectorName: c.by_name,
        changedAt: c.changed_at.toISOString(),
      }));
      return ok({ ...item(row), statusHistory, handovers: handovers.map(handover) });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async handovers(q: {
    studentId?: string;
    leadId?: string;
    limit?: number;
  }): Promise<Result<HandoverListDto, DomainError>> {
    try {
      const rows = await this.db.client.$queryRaw<HandoverRow[]>(Prisma.sql`${handoverSelect}
        WHERE true
          ${q.studentId ? Prisma.sql`AND h.student_id = ${q.studentId}::uuid` : Prisma.empty}
          ${q.leadId ? Prisma.sql`AND h.lead_id = ${q.leadId}::uuid` : Prisma.empty}
        ORDER BY h.handed_over_at DESC, h.id DESC LIMIT ${q.limit ?? 50}`);
      return ok({ items: rows.map(handover) });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  private async director(ctx: CriticalContext): Promise<string> {
    if (!ctx.actor.roles.includes('DIRECTOR')) return fail(domainError('FORBIDDEN_ROLE', 403));
    const [row] = await ctx.tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM staff_accounts WHERE account_id=${ctx.actor.accountId}::uuid AND deactivated_at IS NULL`;
    return row?.id ?? fail(domainError('FORBIDDEN_ROLE', 403));
  }

  /** Responsible manager changes by hand only; open tasks follow the client, history stays attributed. */
  async reassign(
    ctx: CriticalContext,
    subject: { kind: 'STUDENT' | 'LEAD'; id: string },
    managerId: string,
    comment: string | undefined,
  ): Promise<Result<HandoverDto, DomainError>> {
    try {
      const director = await this.director(ctx);
      const tx = ctx.tx;
      const missing = domainError(
        subject.kind === 'STUDENT' ? 'STUDENT_NOT_FOUND' : 'LEAD_NOT_FOUND',
        404,
      );
      if (!UUID_RE.test(subject.id)) return err(missing);
      const exists =
        subject.kind === 'STUDENT'
          ? await tx.student.findUnique({ where: { id: subject.id }, select: { id: true } })
          : await tx.lead.findUnique({ where: { id: subject.id }, select: { id: true } });
      if (!exists) return err(missing);
      const [target] = await tx.$queryRaw<{ id: string }[]>`
        SELECT s.id FROM staff_accounts s JOIN auth_accounts a ON a.id = s.account_id
        WHERE s.id = ${managerId}::uuid AND s.deactivated_at IS NULL AND a.disabled_at IS NULL
          AND EXISTS (SELECT 1 FROM role_assignments ra JOIN roles r ON r.id = ra.role_id
                      WHERE ra.account_id = s.account_id AND r.code = 'MANAGER' AND ra.valid_to IS NULL)`;
      if (!target) return err(domainError('MANAGER_NOT_FOUND', 422));
      const key = subject.kind === 'STUDENT' ? { student_id: subject.id } : { lead_id: subject.id };
      // Serialises two hand-overs of the same client.
      await tx.$queryRaw`SELECT id FROM assigned_managers WHERE ${subject.kind === 'STUDENT' ? Prisma.sql`student_id` : Prisma.sql`lead_id`} = ${subject.id}::uuid AND ended_at IS NULL FOR UPDATE`;
      const current = await tx.assignedManager.findFirst({ where: { ...key, ended_at: null } });
      if (current?.manager_id === managerId) return err(domainError('SAME_MANAGER', 409));
      const now = await at(tx);
      if (current)
        await tx.assignedManager.update({ where: { id: current.id }, data: { ended_at: now } });
      await tx.assignedManager.create({
        data: { manager_id: managerId, ...key, assigned_at: now },
      });
      const moved = current
        ? await tx.crmTask.updateMany({
            where: {
              ...key,
              assigned_manager_id: current.manager_id,
              status: { in: ['OPEN', 'IN_PROGRESS'] },
            },
            data: { assigned_manager_id: managerId, version: { increment: 1 } },
          })
        : { count: 0 };
      const [row] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO manager_handovers (student_id, lead_id, from_manager_id, to_manager_id, by_director_id, comment, moved_tasks, handed_over_at)
        VALUES (${subject.kind === 'STUDENT' ? subject.id : null}::uuid, ${subject.kind === 'LEAD' ? subject.id : null}::uuid,
                ${current?.manager_id ?? null}::uuid, ${managerId}::uuid, ${director}::uuid, ${comment?.trim() ?? null}, ${moved.count}, ${now})
        RETURNING id`;
      const [view] = await tx.$queryRaw<HandoverRow[]>(
        Prisma.sql`${handoverSelect} WHERE h.id = ${row!.id}::uuid`,
      );
      return ok(handover(view!));
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  /** Deactivating never rewrites history; it only stops the person from working and being picked. */
  async setStatus(
    ctx: CriticalContext,
    kind: string,
    id: string,
    action: 'DEACTIVATED' | 'REACTIVATED',
    reason: string,
  ): Promise<Result<StaffItemDto, DomainError>> {
    try {
      const director = await this.director(ctx);
      if (!['MANAGER', 'TEACHER'].includes(kind) || !UUID_RE.test(id))
        return err(domainError('STAFF_NOT_FOUND', 404));
      const tx = ctx.tx;
      const table = kind === 'MANAGER' ? Prisma.sql`staff_accounts` : Prisma.sql`teacher_accounts`;
      const [person] = await tx.$queryRaw<{ id: string; deactivated_at: Date | null }[]>(
        Prisma.sql`SELECT id, deactivated_at FROM ${table} WHERE id = ${id}::uuid FOR UPDATE`,
      );
      if (!person) return err(domainError('STAFF_NOT_FOUND', 404));
      if (kind === 'MANAGER') {
        const [isManager] = await tx.$queryRaw<{ ok: boolean }[]>`
          SELECT EXISTS (SELECT 1 FROM staff_accounts s JOIN role_assignments ra ON ra.account_id = s.account_id AND ra.valid_to IS NULL
                         JOIN roles r ON r.id = ra.role_id WHERE s.id = ${id}::uuid AND r.code = 'MANAGER') AS ok`;
        if (!isManager?.ok) return err(domainError('STAFF_NOT_FOUND', 404));
      }
      const now = await at(tx);
      if (action === 'DEACTIVATED') {
        if (person.deactivated_at) return err(domainError('STAFF_ALREADY_INACTIVE', 409));
        if (kind === 'MANAGER') {
          const [load] = await tx.$queryRaw<{ n: number }[]>`
            SELECT (SELECT count(*) FROM assigned_managers WHERE manager_id = ${id}::uuid AND ended_at IS NULL)::int
                 + (SELECT count(*) FROM crm_tasks WHERE assigned_manager_id = ${id}::uuid AND status::text IN ('OPEN','IN_PROGRESS'))::int AS n`;
          if ((load?.n ?? 0) > 0) return err(domainError('MANAGER_HAS_PORTFOLIO', 409));
        } else {
          const future = await tx.lessonOccurrence.count({
            where: {
              scheduled_teacher_id: id,
              status: { not: 'CANCELLED' },
              scheduled_at: { gte: now },
            },
          });
          if (future > 0) return err(domainError('TEACHER_HAS_FUTURE_LESSONS', 409));
        }
      } else if (!person.deactivated_at) return err(domainError('STAFF_ALREADY_ACTIVE', 409));
      const value = action === 'DEACTIVATED' ? now : null;
      if (kind === 'MANAGER')
        await tx.staffAccount.update({ where: { id }, data: { deactivated_at: value } });
      else {
        await tx.teacherAccount.update({ where: { id }, data: { deactivated_at: value } });
        if (action === 'DEACTIVATED') await this.queueMeetRevocation(ctx, id);
      }
      await tx.$executeRaw`
        INSERT INTO staff_status_changes (staff_id, teacher_id, action, reason, by_director_id, changed_at)
        VALUES (${kind === 'MANAGER' ? id : null}::uuid, ${kind === 'TEACHER' ? id : null}::uuid, ${action}, ${reason.trim()}, ${director}::uuid, ${now})`;
      const [row] = await tx.$queryRaw<StaffRow[]>(
        Prisma.sql`${staffSelect(now)} WHERE p.kind = ${kind} AND p.id = ${id}::uuid`,
      );
      return ok(item(row!));
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  private async queueMeetRevocation(ctx: CriticalContext, teacherId: string) {
    const tx = ctx.tx;
    const grant = await tx.teacherMeetOAuthGrant.findUnique({
      where: { teacher_id: teacherId },
      select: { generation: true, disconnected_at: true, provider_revoked_at: true },
    });
    if (!grant?.disconnected_at || grant.provider_revoked_at) return;
    const key = `teacher-meet-deactivation:${ctx.operationId}`;
    const audit = await tx.auditEvent.create({
      data: {
        actor_kind: 'ACCOUNT',
        actor_id: ctx.actor.accountId,
        action: 'teacher.meet-oauth.termination-queued',
        resource_type: 'TeacherMeetOAuthGrant',
        resource_id: teacherId,
        result: 'SUCCESS',
        request_id: ctx.requestId,
        source_operation_id: ctx.operationId,
        event_key: key,
      },
      select: { id: true },
    });
    await tx.outboxEvent.create({
      data: {
        topic: MEET_REVOCATION_TOPIC,
        aggregate_type: 'TeacherMeetOAuthGrant',
        aggregate_id: teacherId,
        source_operation_id: ctx.operationId,
        audit_event_id: audit.id,
        event_key: key,
        payload: { schemaVersion: 1, teacherId, generation: grant.generation },
      },
    });
  }
}
