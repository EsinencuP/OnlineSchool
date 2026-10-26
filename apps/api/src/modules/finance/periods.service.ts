import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { object, uuid } from '../identity/input.js';
import { at } from './finance-common.js';
import { FinanceAccess } from './finance-access.service.js';

@Injectable()
export class PeriodsService {
  constructor(
    private readonly access: FinanceAccess,
    private readonly db: DatabaseService,
  ) {}
  async list(): Promise<unknown> {
    return this.db.client.financialPeriod.findMany({
      orderBy: { starts_at: 'desc' },
      take: 100,
      select: { id: true, starts_at: true, ends_at: true, closed_at: true },
    });
  }
  async close(ctx: CriticalContext, id: string, body: unknown) {
    object(body ?? {}, []);
    const staff = await this.access.staff(ctx, true);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM financial_periods WHERE id=${id}::uuid FOR UPDATE`;
    const period = await ctx.tx.financialPeriod.findUnique({ where: { id } });
    if (!period) return fail(domainError('NOT_FOUND', 404));
    if (period.closed_at) return fail(domainError('PERIOD_ALREADY_CLOSED', 409));
    const now = await at(ctx.tx);
    if (period.ends_at > now) return fail(domainError('PERIOD_NOT_FINISHED', 422));
    if (
      await ctx.tx.ledgerEntry.findFirst({ where: { financial_period_id: id, published_at: null } })
    )
      return fail(domainError('PERIOD_HAS_DRAFT_ENTRIES', 422));
    const unresolved = await ctx.tx.$queryRaw<{ blocked: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM lesson_occurrences l LEFT JOIN lesson_actual_outcomes o ON o.lesson_occurrence_id=l.id LEFT JOIN teacher_accruals a ON a.lesson_actual_outcome_id=o.id WHERE l.scheduled_at>=${period.starts_at} AND l.scheduled_at<${period.ends_at} AND (l.status='DISPUTED' OR (l.status='CONDUCTED' AND (o.id IS NULL OR a.id IS NULL))))
       OR EXISTS(SELECT 1 FROM payout_attempts WHERE attempted_at>=${period.starts_at} AND attempted_at<${period.ends_at} AND status IN ('PENDING','UNKNOWN')) AS blocked`;
    if (unresolved[0]!.blocked) return fail(domainError('PERIOD_HAS_UNRESOLVED_FACTS', 422));
    return ctx.tx.financialPeriod.update({
      where: { id },
      data: { closed_at: now, closed_by_id: staff, closure_operation_id: ctx.operationId },
    });
  }
}
