import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { DatabaseService } from '../../core/database/database.module.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { object, uuid } from '../identity/input.js';
import { at } from './finance-common.js';
import { FinanceAccess } from './finance-access.service.js';
import {
  openPeriodDisputes,
  periodClosureBlockers,
  periodDisputesRevision,
} from './period-disputes.js';

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
    const { disputesRevision } = object(body ?? {}, ['disputesRevision']);
    if (
      disputesRevision !== undefined &&
      (typeof disputesRevision !== 'string' || !/^[0-9a-f]{64}$/.test(disputesRevision))
    )
      return fail(domainError('INVALID_INPUT', 400));
    const staff = await this.access.staff(ctx, true);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM financial_periods WHERE id=${id}::uuid FOR UPDATE`;
    const period = await ctx.tx.financialPeriod.findUnique({ where: { id } });
    if (!period) return fail(domainError('NOT_FOUND', 404));
    if (period.closed_at) return fail(domainError('PERIOD_ALREADY_CLOSED', 409));
    const now = await at(ctx.tx);
    if (period.ends_at > now) return fail(domainError('PERIOD_NOT_FINISHED', 422));
    const blockers = await periodClosureBlockers(ctx.tx, period);
    if (blockers.drafts) return fail(domainError('PERIOD_HAS_DRAFT_ENTRIES', 422));
    if (blockers.lessons || blockers.attempts)
      return fail(domainError('PERIOD_HAS_UNRESOLVED_FACTS', 422));
    const disputes = await openPeriodDisputes(ctx.tx, period);
    if (disputes.length && disputesRevision === undefined)
      return fail(domainError('PERIOD_DISPUTES_CONFIRMATION_REQUIRED', 409));
    if (disputesRevision !== undefined && disputesRevision !== periodDisputesRevision(id, disputes))
      return fail(domainError('PERIOD_DISPUTES_CHANGED', 409));
    if (disputes.length)
      await ctx.tx.financialPeriodDispute.createMany({
        data: disputes.map((source) => ({
          ...source,
          period_id: id,
          registered_at: now,
        })),
      });
    return ctx.tx.financialPeriod.update({
      where: { id },
      data: { closed_at: now, closed_by_id: staff, closure_operation_id: ctx.operationId },
    });
  }
}
