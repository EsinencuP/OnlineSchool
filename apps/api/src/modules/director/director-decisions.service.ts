import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AppException, domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import { DECISION_KINDS } from './dto/director.dto.js';
import type {
  DecisionCommandDto,
  DecisionCountsDto,
  DecisionDetailDto,
  DecisionItemDto,
  DecisionKind,
  DecisionPageDto,
} from './dto/director.dto.js';

const failure = (error: unknown): DomainError =>
  error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  kind: DecisionKind;
  id: string;
  requested_at: Date;
  requested_by: string | null;
  student_id: string | null;
  student_name: string | null;
  amount: string | null;
  currency: string | null;
  ready: boolean;
  blocked_by: string | null;
};

// Every source is a fact the existing commands decide; nothing is stored for the queue itself.
const feedSql = Prisma.sql`
  decisions AS (
    SELECT 'PAYMENT'::text AS kind, p.id, p.approval_requested_at AS requested_at, st.full_name AS requested_by,
           s.id AS student_id, COALESCE(s.display_name, s.full_name) AS student_name,
           p.amount::text AS amount, p.currency, true AS ready, NULL::text AS blocked_by
    FROM payment_receipts p
    JOIN staff_accounts st ON st.id = p.registered_by_manager_id
    LEFT JOIN students s ON s.id = p.student_id
    WHERE p.approval_requested_at IS NOT NULL AND p.confirmed_by_director_at IS NULL AND p.rejected_at IS NULL
    UNION ALL
    SELECT 'DISTRIBUTION', d.id, d.created_at, st.full_name, s.id, COALESCE(s.display_name, s.full_name),
           d.amount::text, d.currency, p.confirmed_by_director_at IS NOT NULL,
           CASE WHEN p.confirmed_by_director_at IS NULL THEN 'PAYMENT_NOT_CONFIRMED' END
    FROM payment_distributions d
    JOIN payment_receipts p ON p.id = d.payment_id
    JOIN staff_accounts st ON st.id = p.registered_by_manager_id
    JOIN subscriptions sub ON sub.id = d.subscription_id
    JOIN student_subject_enrollments e ON e.id = sub.enrollment_id
    JOIN students s ON s.id = e.student_id
    WHERE d.approved_at IS NULL AND p.rejected_at IS NULL
    UNION ALL
    SELECT 'SCHEDULE_EXCEPTION', a.id, a.created_at, st.full_name, s.id, COALESCE(s.display_name, s.full_name),
           NULL, NULL,
           (l.version = a.lesson_version AND l.status IN ('SCHEDULED', 'STAR_PENDING') AND l.scheduled_at > clock_timestamp()),
           CASE WHEN l.version <> a.lesson_version OR l.status NOT IN ('SCHEDULED', 'STAR_PENDING')
                     OR l.scheduled_at <= clock_timestamp() THEN 'STALE' END
    FROM schedule_change_approvals a
    JOIN lesson_occurrences l ON l.id = a.lesson_id
    JOIN student_subject_enrollments e ON e.id = l.enrollment_id
    JOIN students s ON s.id = e.student_id
    JOIN staff_accounts st ON st.id = a.requested_by_id
    WHERE a.approved_at IS NULL AND a.consumed_at IS NULL
    UNION ALL
    SELECT 'DISPUTE', t.id, t.escalated_at, mgr.full_name, s.id, COALESCE(s.display_name, s.full_name),
           t.decision->>'amount', t.decision->>'currency', (t.decision->>'mode' = 'FULL_REVERSAL'),
           CASE WHEN COALESCE(t.decision->>'mode', '') <> 'FULL_REVERSAL' THEN 'MANUAL_FINANCE_REVIEW' END
    FROM crm_tasks t
    JOIN students s ON s.id = t.student_id
    LEFT JOIN staff_accounts mgr ON mgr.id = t.assigned_manager_id
    WHERE t.type = 'ATTENDANCE_DISPUTE' AND t.status = 'IN_PROGRESS' AND t.escalated_at IS NOT NULL
      AND t.decision->>'kind' = 'DISPUTE' AND t.decision->>'decision' = 'ACCEPT'
    UNION ALL
    SELECT CASE r.kind WHEN 'TEMPORARY_ACCESS' THEN 'TEMPORARY_ACCESS' ELSE 'REFUND_REQUEST' END,
           r.id, r.requested_at, st.full_name, s.id, COALESCE(s.display_name, s.full_name),
           CASE r.kind WHEN 'TEMPORARY_ACCESS' THEN greatest(sub.full_price - paid.total, 0)::text ELSE paid.total::text END,
           sub.currency,
           (r.kind <> 'TEMPORARY_ACCESS' OR paid.total < sub.full_price),
           CASE WHEN r.kind = 'TEMPORARY_ACCESS' AND paid.total >= sub.full_price THEN 'FULLY_PAID' END
    FROM manager_requests r
    JOIN staff_accounts st ON st.id = r.requested_by_id
    JOIN students s ON s.id = r.student_id
    JOIN subscriptions sub ON sub.id = r.subscription_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(sum(d.amount), 0) AS total FROM payment_distributions d
      WHERE d.subscription_id = sub.id AND d.approved_at IS NOT NULL) paid
    WHERE r.status = 'PENDING'
  )`;

const item = (r: Row): DecisionItemDto => ({
  kind: r.kind,
  id: r.id,
  requestedAt: r.requested_at.toISOString(),
  requestedBy: r.requested_by,
  studentId: r.student_id,
  studentName: r.student_name,
  amount: r.amount,
  currency: r.currency,
  ready: r.ready,
  blockedBy: r.blocked_by,
});

const encode = (r: Row) =>
  Buffer.from(JSON.stringify([r.requested_at.toISOString(), r.id])).toString('base64url');
function decode(cursor: string): { at: Date; id: string } | null {
  try {
    const [t, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown[];
    if (
      typeof t !== 'string' ||
      typeof id !== 'string' ||
      !UUID_RE.test(id) ||
      Number.isNaN(Date.parse(t))
    )
      return null;
    return { at: new Date(t), id };
  } catch {
    return null;
  }
}

const COMMANDS: Record<DecisionKind, DecisionCommandDto[]> = {
  PAYMENT: [
    {
      operationId: 'confirmPayment',
      method: 'POST',
      path: '/api/v1/payments/{id}/confirm',
      effect: 'Confirms the money receipt once and posts it to the ledger',
    },
  ],
  DISTRIBUTION: [
    {
      operationId: 'approveDistribution',
      method: 'POST',
      path: '/api/v1/distributions/{id}/approve',
      effect: 'Approves the allocation of a confirmed payment to a subscription',
    },
  ],
  SCHEDULE_EXCEPTION: [
    {
      operationId: 'approveScheduleChange',
      method: 'POST',
      path: '/api/v1/schedule-change-approvals/{id}/approve',
      effect: 'Approves exactly this lesson version and change payload',
    },
  ],
  DISPUTE: [
    {
      operationId: 'approveCrmDisputeResolution',
      method: 'POST',
      path: '/api/v1/dispute-resolutions/{taskId}/approve',
      effect: 'Executes the full-reversal proposal and resolves the CRM task',
    },
  ],
  TEMPORARY_ACCESS: [
    {
      operationId: 'directorApproveRequest',
      method: 'POST',
      path: '/api/v1/director/requests/{id}/approve',
      effect:
        'Grants limited temporary access (you set the lesson limit and expiry); not a payment',
    },
    {
      operationId: 'directorDeclineRequest',
      method: 'POST',
      path: '/api/v1/director/requests/{id}/decline',
      effect: 'Declines the request; the partial payment stays a confirmed partial payment',
    },
  ],
  REFUND_REQUEST: [
    {
      operationId: 'directorApproveRequest',
      method: 'POST',
      path: '/api/v1/director/requests/{id}/approve',
      effect: 'Accepts the request for a refund calculation; no money moves',
    },
    {
      operationId: 'directorDeclineRequest',
      method: 'POST',
      path: '/api/v1/director/requests/{id}/decline',
      effect: 'Declines the refund request with a reason',
    },
  ],
};

@Injectable()
export class DirectorDecisionsService {
  constructor(private readonly db: DatabaseService) {}

  async counts(): Promise<DecisionCountsDto> {
    const rows = await this.db.client.$queryRaw<{ kind: DecisionKind; n: number }[]>(Prisma.sql`
      WITH ${feedSql} SELECT kind, count(*)::int AS n FROM decisions GROUP BY kind`);
    const by = new Map(rows.map((r) => [r.kind, r.n]));
    const counts = {
      payment: by.get('PAYMENT') ?? 0,
      distribution: by.get('DISTRIBUTION') ?? 0,
      scheduleException: by.get('SCHEDULE_EXCEPTION') ?? 0,
      dispute: by.get('DISPUTE') ?? 0,
      temporaryAccess: by.get('TEMPORARY_ACCESS') ?? 0,
      refundRequest: by.get('REFUND_REQUEST') ?? 0,
    };
    return { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  }

  async summary(): Promise<Result<DecisionCountsDto, DomainError>> {
    try {
      return ok(await this.counts());
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async list(query: {
    kind?: string;
    limit?: number;
    cursor?: string;
  }): Promise<Result<DecisionPageDto, DomainError>> {
    try {
      const limit = query.limit ?? 20;
      const cursor = query.cursor === undefined ? null : decode(query.cursor);
      if (query.cursor !== undefined && !cursor) return err(domainError('INVALID_CURSOR', 422));
      if (query.kind !== undefined && !(DECISION_KINDS as readonly string[]).includes(query.kind))
        return err(domainError('INVALID_INPUT', 422));
      const rows = await this.db.client.$queryRaw<Row[]>(Prisma.sql`
        WITH ${feedSql}
        SELECT * FROM decisions
        WHERE true ${query.kind ? Prisma.sql`AND kind = ${query.kind}` : Prisma.empty}
          ${cursor ? Prisma.sql`AND (requested_at, id) > (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : Prisma.empty}
        ORDER BY requested_at ASC, id ASC LIMIT ${limit + 1}`);
      const page = rows.slice(0, limit);
      return ok({
        items: page.map(item),
        nextCursor: rows.length > limit ? encode(page[page.length - 1]!) : null,
      });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  async detail(kind: string, id: string): Promise<Result<DecisionDetailDto, DomainError>> {
    if (!(DECISION_KINDS as readonly string[]).includes(kind) || !UUID_RE.test(id))
      return err(domainError('NOT_FOUND', 404));
    try {
      const [row] = await this.db.client.$queryRaw<Row[]>(Prisma.sql`
        WITH ${feedSql} SELECT * FROM decisions WHERE kind = ${kind} AND id = ${id}::uuid`);
      if (!row) return err(domainError('NOT_FOUND', 404));
      const facts = await this.facts(row.kind, id);
      return ok({ ...item(row), facts, commands: COMMANDS[row.kind] });
    } catch (error: unknown) {
      return err(failure(error));
    }
  }

  private async facts(kind: DecisionKind, id: string): Promise<Record<string, unknown>> {
    const client = this.db.client;
    const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;
    if (kind === 'PAYMENT') {
      const p = await client.paymentReceipt.findUniqueOrThrow({
        where: { id },
        include: {
          t03_paymentdistribution_payment_id: { select: { amount: true, approved_at: true } },
        },
      });
      const proposed = p.t03_paymentdistribution_payment_id;
      return {
        method: p.method,
        purpose: p.purpose,
        receivedAt: iso(p.received_at),
        registeredAt: iso(p.registered_at),
        approvalRequestedAt: iso(p.approval_requested_at),
        provider: p.provider,
        externalReference: p.external_reference,
        managerNote: p.manager_note,
        proposedDistributions: proposed.length,
        proposedTotal: proposed
          .reduce((sum, d) => sum.plus(d.amount), new Prisma.Decimal(0))
          .toFixed(4),
      };
    }
    if (kind === 'DISTRIBUTION') {
      const d = await client.paymentDistribution.findUniqueOrThrow({
        where: { id },
        include: {
          payment_ref: { select: { id: true, amount: true, confirmed_by_director_at: true } },
          subscription_ref: {
            select: { id: true, full_price: true, currency: true, lesson_count: true },
          },
        },
      });
      return {
        paymentId: d.payment_ref.id,
        paymentAmount: d.payment_ref.amount.toFixed(4),
        paymentConfirmedAt: iso(d.payment_ref.confirmed_by_director_at),
        subscriptionId: d.subscription_ref.id,
        subscriptionPrice: d.subscription_ref.full_price.toFixed(4),
        lessonCount: d.subscription_ref.lesson_count,
        preparedByManager: d.manager_prepared,
      };
    }
    if (kind === 'SCHEDULE_EXCEPTION') {
      const a = await client.scheduleChangeApproval.findUniqueOrThrow({ where: { id } });
      const payload = a.payload as Record<string, unknown>;
      const lesson = await client.lessonOccurrence.findUniqueOrThrow({
        where: { id: a.lesson_id },
        select: { id: true, scheduled_at: true, version: true },
      });
      return {
        lessonId: lesson.id,
        lessonStartsAt: lesson.scheduled_at.toISOString(),
        lessonVersion: lesson.version,
        approvalLessonVersion: a.lesson_version,
        action: payload.action ?? null,
        initiator: payload.initiator ?? null,
        reason: payload.reason ?? null,
        newStartsAt: typeof payload.startsAt === 'string' ? payload.startsAt : null,
        chargeable: typeof payload.chargeable === 'boolean' ? payload.chargeable : null,
      };
    }
    if (kind === 'TEMPORARY_ACCESS' || kind === 'REFUND_REQUEST') {
      const r = await client.managerRequest.findUniqueOrThrow({
        where: { id },
        include: {
          subscription: {
            select: { id: true, full_price: true, currency: true, lesson_count: true },
          },
        },
      });
      const paid = await client.paymentDistribution.aggregate({
        where: { subscription_id: r.subscription_id, approved_at: { not: null } },
        _sum: { amount: true },
      });
      const confirmed = new Prisma.Decimal(paid._sum.amount ?? 0);
      return {
        reason: r.reason,
        subscriptionId: r.subscription.id,
        subscriptionPrice: r.subscription.full_price.toFixed(4),
        lessonCount: r.subscription.lesson_count,
        confirmedPaid: confirmed.toFixed(4),
        shortfall: Prisma.Decimal.max(r.subscription.full_price.minus(confirmed), 0).toFixed(4),
        proposedLessons: r.proposed_lessons,
        proposedUntil: iso(r.proposed_until),
      };
    }
    const t = await client.crmTask.findUniqueOrThrow({ where: { id } });
    const decision = (t.decision ?? {}) as Record<string, unknown>;
    return {
      lessonId: t.lesson_id,
      createdAt: t.created_at.toISOString(),
      escalatedAt: iso(t.escalated_at),
      mode: decision.mode ?? null,
      reason: decision.reason ?? null,
      lessons: decision.lessons ?? null,
      taskVersion: t.version,
    };
  }
}
