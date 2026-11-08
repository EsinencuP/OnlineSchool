import { taskOpenSql, taskVisibleSql } from '../tasks/task-read.spec.js';
import { studentCrmStatusSql } from './student-status.sql.js';
import {
  expiringSubscriptionSql,
  subscriptionExpiryUntil,
} from '../../finance/manager-subscriptions/read-spec.js';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { DatabaseService } from '../../../core/database/database.module.js';
import { subscriptionFacts } from '../../../student/subscription/subscription.sql.js';
import { studentLedgerBalanceSql } from '../../finance/student-ledger-balance.sql.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerContext } from '../context/manager-context.js';
import { ListStudentsQueryDto, StudentCrmStatus } from '../dto/student-crm.dto.js';
import type { StudentCardDto, StudentListItemDto } from '../dto/student-crm.dto.js';
import type { StudentCursor } from './student-cursor.js';

export const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');
const openTasks = Prisma.sql`${taskOpenSql()} AND ${taskVisibleSql()}`;
function facts(scope: Prisma.Sql, q: ListStudentsQueryDto, now: Date, id?: string): Prisma.Sql {
  const search = q.search ? `%${escapeLike(q.search.toLowerCase())}%` : undefined;
  const currency = process.env.SCHOOL_CURRENCY ?? 'MDL';
  return Prisma.sql`WITH facts AS (
    SELECT st.id,st.full_name,st.version,
      ${studentCrmStatusSql(now)} AS status,
      EXISTS(SELECT 1 FROM student_accounts a WHERE a.student_id=st.id AND a.deactivated_at IS NULL) AS has_account,
      CASE WHEN st.phone IS NULL THEN NULL ELSE '***'||right(regexp_replace(st.phone,'[^0-9]','','g'),2) END AS masked_phone,
      CASE WHEN sub.id IS NOT NULL AND (sub.valid_to IS NULL OR sub.valid_to>${now}) THEN
        jsonb_build_object('id',sub.id,'endsAt',sub.valid_to,'remainingLessons',sub.remaining,'currency',sub.currency) ELSE NULL END AS active_subscription,
      coalesce((SELECT b->>'amount' FROM jsonb_array_elements(money.balances) b WHERE b->>'currency'=${currency}),'0.0000') AS balance,
      ${currency}::text AS currency,money.balances,sub.valid_to AS subscription_end,n.next_lesson_at,tasks.open_count,tasks.overdue_count
    FROM students st
    LEFT JOIN LATERAL (${subscriptionFacts(Prisma.sql`st.id`, {}, now, { startedOnly: true })}
      SELECT s.id,s.valid_to,s.frozen_from,s.frozen_until,s.currency,
        (SELECT coalesce(sum(delta),0)::int FROM events) AS remaining
      FROM selected s) sub ON true
    CROSS JOIN LATERAL (${studentLedgerBalanceSql(Prisma.sql`st.id`, now)}) money
    LEFT JOIN LATERAL (SELECT min(l.scheduled_at) AS next_lesson_at FROM lesson_occurrences l
      JOIN student_subject_enrollments e ON e.id=l.enrollment_id
      WHERE e.student_id=st.id AND l.status='SCHEDULED' AND l.scheduled_at>=${now}) n ON true
    CROSS JOIN LATERAL (SELECT count(*)::int AS open_count,count(*) FILTER(WHERE t.due_at<${now})::int AS overdue_count
      FROM crm_tasks t WHERE t.student_id=st.id AND ${openTasks}) tasks
    WHERE ${scope} ${id ? Prisma.sql`AND st.id=${id}::uuid` : Prisma.empty}
      ${search ? Prisma.sql`AND (lower(st.full_name) LIKE ${search} ESCAPE '\\' OR lower(st.phone) LIKE ${search} ESCAPE '\\' OR lower(st.email) LIKE ${search} ESCAPE '\\')` : Prisma.empty}
  ), filtered AS (SELECT * FROM facts f WHERE true
    ${q.status ? Prisma.sql`AND f.status=${q.status}` : Prisma.empty}
    ${q.hasOverdueTask !== undefined ? Prisma.sql`AND (f.overdue_count>0)=${q.hasOverdueTask}` : Prisma.empty}
    ${q.subscriptionExpiringSoon !== undefined ? Prisma.sql`AND EXISTS(SELECT 1 FROM manager_subscriptions ms JOIN student_subject_enrollments e ON e.id=ms.enrollment_id WHERE e.student_id=f.id AND ${expiringSubscriptionSql(now, subscriptionExpiryUntil(now, 7))})=${q.subscriptionExpiringSoon}` : Prisma.empty}
  )`;
}
const item = Prisma.sql`jsonb_build_object('studentId',f.id,'fullName',f.full_name,'status',f.status,'hasAccount',f.has_account,
  'maskedPhone',f.masked_phone,'activeSubscription',f.active_subscription,'balance',f.balance,'balanceCurrency',f.currency,'balances',f.balances,
  'nextLessonAt',f.next_lesson_at,'openTasksCount',f.open_count,'overdueTasksCount',f.overdue_count)`;
export function listStudentsSql(
  scope: Prisma.Sql,
  q: ListStudentsQueryDto,
  cursor: StudentCursor,
): Prisma.Sql {
  const key =
    q.sort === 'nextLesson'
      ? Prisma.sql`f.next_lesson_at`
      : q.sort === 'subscriptionEnd'
        ? Prisma.sql`f.subscription_end`
        : Prisma.sql`lower(f.full_name) COLLATE "C"`;
  const pivot =
    q.sort === 'nextLesson'
      ? Prisma.sql`p.next_lesson_at`
      : q.sort === 'subscriptionEnd'
        ? Prisma.sql`p.subscription_end`
        : Prisma.sql`lower(p.full_name) COLLATE "C"`;
  const after = cursor.studentId
    ? Prisma.sql`AND EXISTS(SELECT 1 FROM filtered p WHERE p.id=${cursor.studentId}::uuid AND (
    (${key}>${pivot}) OR (${key} IS NULL AND ${pivot} IS NOT NULL) OR (${key} IS NOT DISTINCT FROM ${pivot} AND f.id>p.id)))`
    : Prisma.empty;
  return Prisma.sql`${facts(scope, q, cursor.now)}, page AS (
    SELECT f.*,row_number() OVER(ORDER BY ${key} ASC NULLS LAST,f.id) AS page_order
    FROM filtered f WHERE true ${after} ORDER BY ${key} ASC NULLS LAST,f.id LIMIT ${q.limit + 1}
  ) SELECT ${cursor.studentId ? Prisma.sql`EXISTS(SELECT 1 FROM filtered WHERE id=${cursor.studentId}::uuid)` : Prisma.sql`true`} AS cursor_valid,
    coalesce((SELECT jsonb_agg(${item} ORDER BY f.page_order) FROM page f),'[]'::jsonb) AS items`;
}
export function studentCardSql(scope: Prisma.Sql, studentId: string, now: Date): Prisma.Sql {
  return Prisma.sql`${facts(scope, new ListStudentsQueryDto(), now, studentId)}
    SELECT jsonb_build_object('studentId',f.id,'version',f.version,'fullName',f.full_name,'status',f.status,'hasAccount',f.has_account,
      'contacts',jsonb_build_object('phone',st.phone,'email',st.email,'guardianName',guardian.full_name,'guardianPhone',guardian.phone),
      'managerNote',st.manager_note,'subscription',f.active_subscription,'balance',f.balance,'balanceCurrency',f.currency,'balances',f.balances,
      'upcomingLessons',(SELECT coalesce(jsonb_agg(x.data ORDER BY x.at,x.id),'[]'::jsonb) FROM (
        SELECT l.id,l.scheduled_at AS at,jsonb_build_object('id',l.id,'startsAt',l.scheduled_at,'subjectName',s.name,'teacherName',t.full_name) AS data
        FROM lesson_occurrences l JOIN student_subject_enrollments e ON e.id=l.enrollment_id
        JOIN subjects s ON s.id=e.subject_id JOIN teacher_accounts t ON t.id=l.scheduled_teacher_id
        WHERE e.student_id=f.id AND l.status='SCHEDULED' AND l.scheduled_at>=${now} ORDER BY l.scheduled_at,l.id LIMIT 5) x),
      'openTasks',(SELECT coalesce(jsonb_agg(x.data ORDER BY x.due_at,x.id),'[]'::jsonb) FROM (
        SELECT t.id,t.due_at,jsonb_build_object('id',t.id,'type',t.type,'status',t.status,'title',t.title,'dueAt',t.due_at) AS data
        FROM crm_tasks t WHERE t.student_id=f.id AND ${openTasks} ORDER BY t.due_at,t.id LIMIT 101) x),
      'recentPayments',(SELECT coalesce(jsonb_agg(x.data ORDER BY x.at DESC,x.id DESC),'[]'::jsonb) FROM (
        SELECT d.id,d.created_at AS at,jsonb_build_object('id',d.id,'distributionId',d.id,'paymentId',p.id,'amount',d.amount::text,
          'currency',d.currency,'registeredAt',d.created_at,'confirmedAt',d.approved_at,
          'status',CASE WHEN p.confirmed_by_director_at IS NULL OR d.approved_at IS NULL THEN 'AWAITING_APPROVAL'
            WHEN NOT EXISTS(SELECT 1 FROM ledger_documents pd JOIN ledger_entries pe ON pe.document_id=pd.id WHERE pd.payment_id=p.id AND pe.published_at<=${now})
              OR NOT EXISTS(SELECT 1 FROM ledger_documents dd JOIN ledger_entries de ON de.document_id=dd.id WHERE dd.distribution_id=d.id AND de.published_at<=${now})
              THEN 'PENDING' ELSE 'CONFIRMED' END) AS data
        FROM payment_distributions d JOIN payment_receipts p ON p.id=d.payment_id
        JOIN subscriptions s ON s.id=d.subscription_id JOIN student_subject_enrollments e ON e.id=s.enrollment_id
        WHERE e.student_id=f.id AND EXISTS(SELECT 1 FROM students st WHERE st.id=p.student_id AND ${scope})
        ORDER BY d.created_at DESC,d.id DESC LIMIT 10) x),
      'learning',jsonb_build_object('skillsMastered',skills.mastered,'skillsTotal',skills.total,
        'homeworkSubmitted',hw.submitted,'homeworkPending',hw.pending,'homeworkOverdue',hw.overdue,
        'lastReportAt',report.at,'lastReportStatus',report.status)) AS card
    FROM filtered f JOIN students st ON st.id=f.id
    LEFT JOIN LATERAL (SELECT r.full_name,r.phone FROM student_representative_links link JOIN representatives r ON r.id=link.representative_id
      WHERE link.student_id=f.id AND r.archived_at IS NULL AND link.valid_from<=${now} AND (link.valid_to IS NULL OR link.valid_to>${now})
        AND (link.verification_status='VERIFIED' OR (link.basis='CRM_CONTACT_ONLY' AND link.verification_status='PENDING'))
      ORDER BY (link.basis='CRM_CONTACT_ONLY') DESC,link.valid_from DESC,link.id DESC LIMIT 1) guardian ON true
    CROSS JOIN LATERAL (SELECT count(*)::int AS total,count(*) FILTER(WHERE latest.level='APPLYING')::int AS mastered
      FROM skill_entries sk LEFT JOIN LATERAL (SELECT sa.level FROM skill_assessments sa JOIN student_subject_enrollments e ON e.id=sa.enrollment_id
        WHERE e.student_id=f.id AND e.valid_from<=${now} AND sa.skill_id=sk.id AND sa.assessed_at<=${now}
          AND (sa.lesson_ref IS NULL OR EXISTS(SELECT 1 FROM lesson_actual_outcomes o JOIN lesson_occurrences l ON l.id=o.lesson_occurrence_id
            WHERE l.id=sa.lesson_ref AND l.status='CONDUCTED' AND o.confirmed_at<=${now}))
        ORDER BY sa.assessed_at DESC,sa.version DESC,sa.id DESC LIMIT 1) latest ON true
      WHERE sk.archived_at IS NULL AND sk.created_at<=${now} AND (sk.student_id IS NULL OR sk.student_id=f.id)
        AND EXISTS(SELECT 1 FROM student_subject_enrollments e WHERE e.student_id=f.id AND e.subject_id=sk.subject_id AND e.valid_from<=${now})) skills
    CROSS JOIN LATERAL (SELECT count(*) FILTER(WHERE h.submitted)::int AS submitted,
      count(*) FILTER(WHERE NOT h.submitted AND (h.due_at IS NULL OR h.due_at>=${now}))::int AS pending,
      count(*) FILTER(WHERE NOT h.submitted AND h.due_at<${now})::int AS overdue FROM (
        SELECT coalesce(d.due_at,a.due_at) AS due_at,EXISTS(SELECT 1 FROM homework_submissions hs WHERE hs.delivery_id=d.id AND hs.student_id=f.id AND hs.submitted_at<=${now}) AS submitted
        FROM homework_deliveries d JOIN homework_assignments a ON a.id=d.assignment_id JOIN student_subject_enrollments e ON e.id=d.enrollment_id
        WHERE e.student_id=f.id AND d.issued_at<=${now} AND d.cancelled_at IS NULL AND a.archived_at IS NULL) h) hw
    LEFT JOIN LATERAL (SELECT coalesce(r.published_at,r.generated_at,r.created_at) AS at,r.status FROM education_reports r
      JOIN progress_checkpoints pc ON pc.id=r.checkpoint_id JOIN student_subject_enrollments e ON e.id=pc.enrollment_id
      WHERE e.student_id=f.id AND r.created_at<=${now} ORDER BY r.created_at DESC,r.version DESC,r.id DESC LIMIT 1) report ON true`;
}
function dates<T>(value: T): T {
  if (Array.isArray(value)) return value.map(dates) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        typeof v === 'string' && /(?:At|endsAt)$/.test(k) ? new Date(v).toISOString() : dates(v),
      ]),
    ) as T;
  return value;
}
function subscription(
  row: StudentListItemDto['activeSubscription'],
): StudentListItemDto['activeSubscription'] {
  return row
    ? {
        id: row.id,
        endsAt: row.endsAt,
        remainingLessons: row.remainingLessons,
        currency: row.currency,
      }
    : null;
}
function balances(
  row: Pick<StudentListItemDto, 'balances' | 'balance' | 'balanceCurrency'>,
): StudentListItemDto['balances'] {
  const primary = row.balanceCurrency ?? process.env.SCHOOL_CURRENCY ?? 'MDL';
  const rows = row.balances ?? [{ currency: primary, amount: row.balance }];
  const values = rows.map((x) => ({
    currency: x.currency,
    amount: new Prisma.Decimal(x.amount).toFixed(4),
  }));
  if (!values.some((x) => x.currency === primary))
    values.push({ currency: primary, amount: new Prisma.Decimal(row.balance).toFixed(4) });
  return values.sort((a, b) => a.currency.localeCompare(b.currency));
}
export function projectListItem(row: StudentListItemDto): StudentListItemDto {
  const currency = row.balanceCurrency ?? process.env.SCHOOL_CURRENCY ?? 'MDL';
  return dates({
    studentId: row.studentId,
    fullName: row.fullName,
    status: row.status,
    hasAccount: row.hasAccount,
    maskedPhone: row.maskedPhone,
    activeSubscription: subscription(row.activeSubscription),
    balance: new Prisma.Decimal(row.balance).toFixed(4),
    balanceCurrency: currency,
    balances: balances(row),
    nextLessonAt: row.nextLessonAt,
    openTasksCount: row.openTasksCount,
    overdueTasksCount: row.overdueTasksCount,
  });
}
export function projectCard(row: StudentCardDto): StudentCardDto {
  // Explicit allowlist also protects the response if a future SQL projection accidentally widens.
  const l = row.learning,
    c = row.contacts;
  return dates({
    leadId: row.leadId ?? null,
    studentId: row.studentId,
    version: row.version,
    fullName: row.fullName,
    status: row.status as StudentCrmStatus,
    hasAccount: row.hasAccount,
    contacts: {
      phone: c.phone,
      email: c.email,
      guardianName: c.guardianName,
      guardianPhone: c.guardianPhone,
    },
    managerNote: row.managerNote,
    subscription: subscription(row.subscription),
    balance: new Prisma.Decimal(row.balance).toFixed(4),
    balanceCurrency: row.balanceCurrency ?? process.env.SCHOOL_CURRENCY ?? 'MDL',
    balances: balances(row),
    upcomingLessons: row.upcomingLessons.slice(0, 5).map((x) => ({
      id: x.id,
      startsAt: x.startsAt,
      subjectName: x.subjectName,
      teacherName: x.teacherName,
    })),
    openTasks: row.openTasks
      .slice(0, 100)
      .map((x) => ({ id: x.id, type: x.type, status: x.status, title: x.title, dueAt: x.dueAt })),
    openTasksTruncated: row.openTasks.length > 100,
    recentPayments: row.recentPayments.slice(0, 10).map((x) => ({
      id: x.id,
      amount: new Prisma.Decimal(x.amount).toFixed(4),
      distributionId: x.distributionId,
      paymentId: x.paymentId,
      currency: x.currency,
      status: x.status,
      registeredAt: x.registeredAt,
      confirmedAt: x.confirmedAt,
    })),
    learning: {
      skillsMastered: l.skillsMastered,
      skillsTotal: l.skillsTotal,
      homeworkSubmitted: l.homeworkSubmitted,
      homeworkPending: l.homeworkPending,
      homeworkOverdue: l.homeworkOverdue,
      lastReportAt: l.lastReportAt,
      lastReportStatus: l.lastReportStatus,
    },
  });
}
@Injectable()
export class ManagerStudentsRead {
  constructor(
    private readonly db: DatabaseService,
    private readonly scope: ManagerScopeService,
  ) {}
  private async read<T>(
    sql: Prisma.Sql,
    tx?: Prisma.TransactionClient,
  ): Promise<Result<T[], DomainError>> {
    // This one reviewed read-model boundary is the only manager raw-SQL executor.
    if (
      !/^\s*WITH\b/i.test(sql.text) ||
      /\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY)\b/i.test(sql.text)
    )
      return err(domainError('READ_QUERY_REJECTED', 503));
    if (process.env.SCHOOL_CURRENCY && !/^[A-Z]{3}$/.test(process.env.SCHOOL_CURRENCY))
      return err(domainError('MANAGER_CONFIGURATION_INVALID', 503));
    try {
      return ok(await (tx ?? this.db.client).$queryRaw<T[]>(sql));
    } catch {
      return err(domainError('DATABASE_ERROR', 503));
    }
  }
  async list(
    ctx: ManagerContext,
    q: ListStudentsQueryDto,
    cursor: StudentCursor,
  ): Promise<Result<{ cursor_valid: boolean; items: StudentListItemDto[] }[], DomainError>> {
    // Cursor pins data ordering, never portfolio authorization: assignments are checked live.
    return this.read(listStudentsSql(this.scope.portfolioSql(ctx, new Date()), q, cursor));
  }
  async card(
    ctx: ManagerContext,
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Result<StudentCardDto, DomainError>> {
    const now = new Date(),
      result = await this.read<{ card: StudentCardDto }>(
        studentCardSql(this.scope.portfolioSql(ctx, now), id, now),
        tx,
      );
    if (!result.ok) return result;
    try {
      if (!result.value[0]) return err(domainError('STUDENT_NOT_FOUND', 404));
      const lead = await tx.lead.findFirst({
        where: {
          AND: [
            this.scope.leadWhere(ctx),
            { student_links: { some: { student_id: id, unlinked_at: null } } },
          ],
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        select: { id: true },
      });
      return ok({ ...projectCard(result.value[0].card), leadId: lead?.id ?? null });
    } catch {
      return err(domainError('DATABASE_ERROR', 503));
    }
  }
}
