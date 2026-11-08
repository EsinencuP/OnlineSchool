import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { databaseError } from '../../core/errors/database-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import { leadSummarySql } from '../manager/leads/summary.sql.js';
import type { LeadSummaryDto } from '../manager/dto/manager-lead.dto.js';

// These fixed SQL operations belong to CRM data access. Callers supply a scoped,
// parameterized portfolio predicate; this boundary accepts no SQL mutation text.
export async function lockLead(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<Result<void, DomainError>> {
  try {
    await tx.$queryRaw`SELECT id FROM leads WHERE id=${id}::uuid FOR UPDATE`;
    return ok(undefined);
  } catch (e: unknown) {
    return err(databaseError(e));
  }
}
export async function lockLeadCreation(
  tx: Prisma.TransactionClient,
  managerId: string,
): Promise<Result<void, DomainError>> {
  try {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`lead-create:${managerId}`},0))`;
    return ok(undefined);
  } catch (e: unknown) {
    return err(databaseError(e));
  }
}
export async function duplicateLeadContact(
  tx: Prisma.TransactionClient,
  input: {
    managerId: string;
    now: Date;
    studentScope: Prisma.Sql;
    phone: string | null;
    email: string | null;
    excludeLead: string | null;
    excludeStudent: string | null;
  },
): Promise<Result<string | null, DomainError>> {
  try {
    const { managerId, now, studentScope, phone, email, excludeLead, excludeStudent } = input;
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT x.id FROM (
      SELECT l.id,l.phone,l.email FROM leads l JOIN assigned_managers a ON a.lead_id=l.id WHERE a.manager_id=${managerId}::uuid AND a.assigned_at<=${now} AND (a.ended_at IS NULL OR a.ended_at>${now}) AND (${excludeLead}::uuid IS NULL OR l.id<>${excludeLead}::uuid)
      UNION ALL SELECT st.id,st.phone,st.email FROM students st WHERE (${excludeStudent}::uuid IS NULL OR st.id<>${excludeStudent}::uuid) AND ${studentScope}
    )x WHERE (${phone}::text IS NOT NULL AND regexp_replace(x.phone,'[^0-9]','','g')=${phone}) OR (${email}::text IS NOT NULL AND lower(trim(x.email))=${email}) ORDER BY x.id LIMIT 1`);
    return ok(rows[0]?.id ?? null);
  } catch (e: unknown) {
    return err(databaseError(e));
  }
}
export async function readLeadSummary(
  tx: Prisma.TransactionClient,
  scope: Prisma.Sql,
  now: Date,
  zone: string,
): Promise<Result<LeadSummaryDto, DomainError>> {
  try {
    const rows = await tx.$queryRaw<LeadSummaryDto[]>(leadSummarySql(scope, now, zone));
    return rows[0]
      ? ok(rows[0])
      : err({ code: 'DATABASE_ERROR', message: 'DATABASE_ERROR', status: 503 });
  } catch (e: unknown) {
    return err(databaseError(e));
  }
}
