import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { at } from '../finance/finance-common.js';
import type {
  EscalationDto,
  EscalationPageDto,
  EscalationsQueryDto,
  ManagerAvailabilityListDto,
} from './dto/director-escalations.dto.js';
import type { EscalationState } from './dto/director-escalations.dto.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const OPEN_TASK = Prisma.sql`t.status IN ('OPEN','IN_PROGRESS')`;

type Row = {
  id: string;
  task_id: string;
  task_type: string;
  title: string;
  task_status: string;
  state: EscalationState;
  reason: EscalationDto['reason'];
  manager_status: string;
  primary_manager_id: string | null;
  primary_manager_name: string | null;
  student_id: string | null;
  student_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
  accept_due_at: Date;
  escalated_at: Date;
  accepted_at: Date | null;
  accepted_by_name: string | null;
};

const select = Prisma.sql`
  SELECT e.id, e.task_id, t.type::text AS task_type, t.title, t.status::text AS task_status,
    CASE WHEN t.status NOT IN ('OPEN','IN_PROGRESS') THEN 'CLOSED'
         WHEN e.accepted_at IS NOT NULL THEN 'ACCEPTED' ELSE 'OPEN' END AS state,
    e.reason, e.manager_status, e.primary_manager_id, pm.full_name AS primary_manager_name,
    t.student_id, COALESCE(st.display_name, st.full_name) AS student_name, t.lead_id, ld.full_name AS lead_name,
    e.accept_due_at, e.escalated_at, e.accepted_at, ab.full_name AS accepted_by_name
  FROM task_escalations e
  JOIN crm_tasks t ON t.id = e.task_id
  LEFT JOIN staff_accounts pm ON pm.id = e.primary_manager_id
  LEFT JOIN staff_accounts ab ON ab.id = e.accepted_by_id
  LEFT JOIN students st ON st.id = t.student_id
  LEFT JOIN leads ld ON ld.id = t.lead_id`;

const view = (r: Row): EscalationDto => ({
  escalationId: r.id,
  taskId: r.task_id,
  taskType: r.task_type,
  title: r.title,
  taskStatus: r.task_status,
  state: r.state,
  reason: r.reason,
  managerStatus: r.manager_status,
  primaryManagerId: r.primary_manager_id,
  primaryManagerName: r.primary_manager_name,
  studentId: r.student_id,
  studentName: r.student_name,
  leadId: r.lead_id,
  leadName: r.lead_name,
  acceptDueAt: r.accept_due_at.toISOString(),
  escalatedAt: r.escalated_at.toISOString(),
  acceptedAt: r.accepted_at?.toISOString() ?? null,
  acceptedByName: r.accepted_by_name,
});

const stateSql = (state: EscalationState) =>
  state === 'CLOSED'
    ? Prisma.sql`t.status NOT IN ('OPEN','IN_PROGRESS')`
    : state === 'ACCEPTED'
      ? Prisma.sql`e.accepted_at IS NOT NULL AND ${OPEN_TASK}`
      : Prisma.sql`e.accepted_at IS NULL AND ${OPEN_TASK}`;

function decode(cursor: string): { at: Date; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      UUID_RE.test(parsed[1]) &&
      Number.isFinite(Date.parse(parsed[0]))
    )
      return { at: new Date(parsed[0]), id: parsed[1] };
  } catch {
    /* fall through */
  }
  return null;
}

/** OPS-01/B / DIR-05: the director's view of urgent tasks that were routed to them. */
@Injectable()
export class DirectorEscalationsService {
  constructor(private readonly db: DatabaseService) {}

  async openCount(): Promise<number> {
    const [row] = await this.db.client.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT count(*)::int AS n FROM task_escalations e JOIN crm_tasks t ON t.id = e.task_id
      WHERE e.accepted_at IS NULL AND ${OPEN_TASK}`);
    return row?.n ?? 0;
  }

  async list(q: EscalationsQueryDto): Promise<Result<EscalationPageDto, DomainError>> {
    try {
      const limit = q.limit ?? 20;
      let after = Prisma.empty;
      if (q.cursor) {
        const c = decode(q.cursor);
        if (!c) return err(domainError('INVALID_CURSOR', 422));
        after = Prisma.sql`AND (e.escalated_at, e.id) > (${c.at}::timestamptz, ${c.id}::uuid)`;
      }
      const rows = await this.db.client.$queryRaw<Row[]>(Prisma.sql`${select}
        WHERE ${stateSql(q.state ?? 'OPEN')} ${after}
        ORDER BY e.escalated_at, e.id LIMIT ${limit + 1}`);
      const page = rows.slice(0, limit);
      const last = page[page.length - 1];
      return ok({
        items: page.map(view),
        nextCursor:
          rows.length > limit && last
            ? Buffer.from(JSON.stringify([last.escalated_at.toISOString(), last.id])).toString(
                'base64url',
              )
            : null,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async detail(id: string): Promise<Result<EscalationDto, DomainError>> {
    if (!UUID_RE.test(id)) return err(domainError('ESCALATION_NOT_FOUND', 404));
    try {
      const [row] = await this.db.client.$queryRaw<Row[]>(
        Prisma.sql`${select} WHERE e.id = ${id}::uuid`,
      );
      return row ? ok(view(row)) : err(domainError('ESCALATION_NOT_FOUND', 404));
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  /** The director takes responsibility; the task stays open and the client keeps their manager. */
  async accept(ctx: CriticalContext, id: string): Promise<Result<EscalationDto, DomainError>> {
    if (!UUID_RE.test(id)) return err(domainError('ESCALATION_NOT_FOUND', 404));
    try {
      if (!ctx.actor.roles.includes('DIRECTOR')) return err(domainError('FORBIDDEN_ROLE', 403));
      const [director] = await ctx.tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM staff_accounts WHERE account_id=${ctx.actor.accountId}::uuid AND deactivated_at IS NULL`;
      if (!director) return err(domainError('FORBIDDEN_ROLE', 403));
      const [locked] = await ctx.tx.$queryRaw<
        { accepted_at: Date | null; task_status: string }[]
      >`SELECT e.accepted_at, t.status::text AS task_status FROM task_escalations e
        JOIN crm_tasks t ON t.id=e.task_id WHERE e.id=${id}::uuid FOR UPDATE OF e`;
      if (!locked) return err(domainError('ESCALATION_NOT_FOUND', 404));
      if (locked.accepted_at) return err(domainError('ESCALATION_ALREADY_ACCEPTED', 409));
      if (!['OPEN', 'IN_PROGRESS'].includes(locked.task_status))
        return err(domainError('ESCALATION_CLOSED', 409));
      await ctx.tx.$executeRaw`UPDATE task_escalations SET accepted_by_id=${director.id}::uuid,
        accepted_at=${await at(ctx.tx)} WHERE id=${id}::uuid`;
      const [row] = await ctx.tx.$queryRaw<Row[]>(Prisma.sql`${select} WHERE e.id = ${id}::uuid`);
      return ok(view(row!));
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  /** Who can take an urgent task right now; a missing row means "never set", i.e. available. */
  async managers(): Promise<Result<ManagerAvailabilityListDto, DomainError>> {
    try {
      const rows = await this.db.client.$queryRaw<
        { id: string; full_name: string; status: string | null; changed_at: Date | null }[]
      >(Prisma.sql`
        SELECT s.id, s.full_name, a.status, a.changed_at
        FROM staff_accounts s
        JOIN role_assignments ra ON ra.account_id = s.account_id AND ra.valid_to IS NULL
        JOIN roles r ON r.id = ra.role_id AND r.code = 'MANAGER'
        LEFT JOIN manager_availability a ON a.manager_id = s.id
        WHERE s.deactivated_at IS NULL
        ORDER BY s.full_name, s.id`);
      return ok({
        managers: rows.map((r) => ({
          managerId: r.id,
          fullName: r.full_name,
          status: r.status ?? 'AVAILABLE',
          changedAt: r.changed_at?.toISOString() ?? null,
        })),
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }
}
