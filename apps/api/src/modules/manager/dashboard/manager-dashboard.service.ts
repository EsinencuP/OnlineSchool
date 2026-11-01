import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerContext } from '../context/manager-context.js';
import type {
  DashboardQueryDto,
  ManagerDashboardDto,
  DashboardCurrencyTotalDto,
} from '../dto/manager-dashboard.dto.js';
import { ManagerDashboardRead } from './dashboard.read.js';
import { dashboardOverviewSql, dashboardSubscriptionsSql } from './dashboard.sql.js';
import { pendingReceiptTotalsSql } from '../../finance/manager-payments/pending-totals.sql.js';
import { subscriptionExpiryUntil } from '../../finance/manager-subscriptions/read-spec.js';
@Injectable()
export class ManagerDashboardService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly scope: ManagerScopeService,
    private readonly reader: ManagerDashboardRead,
  ) {}
  get(
    ctx: ManagerContext,
    q: DashboardQueryDto,
  ): Promise<Result<ManagerDashboardDto, DomainError>> {
    return this.transactions.runReadOnly(async (tx) => {
      const stamp = unwrap(
          await this.reader.read<{ now: Date }>(
            tx,
            Prisma.sql`SELECT transaction_timestamp() AS now`,
          ),
        ),
        now = stamp.now;
      const activeRole = {
        valid_from: { lte: now },
        OR: [{ valid_to: null }, { valid_to: { gt: now } }],
      };
      const profile = await tx.staffAccount.findFirst({
        where: {
          id: ctx.managerId,
          account_id: ctx.accountId,
          account_kind: 'STAFF',
          account: {
            disabled_at: null,
            role_assignments: {
              some: { ...activeRole, role: { code: 'MANAGER' } },
              none: { ...activeRole, role: { code: { not: 'MANAGER' } } },
            },
          },
        },
        select: { deactivated_at: true },
      });
      if (!profile) return err(domainError('FORBIDDEN_ROLE', 403));
      if (profile.deactivated_at) return err(domainError('MANAGER_INACTIVE', 403));
      const scope = this.scope.portfolioSql(ctx, now),
        lessonsUntil = new Date(+now + q.lessonsHorizonHours * 3600000),
        expiryUntil = subscriptionExpiryUntil(now, q.expiringDays);
      const overview = unwrap(
        await this.reader.read<
          Pick<ManagerDashboardDto, 'students' | 'upcomingLessons' | 'overdueTasks'>
        >(tx, dashboardOverviewSql(scope, now, lessonsUntil)),
      );
      const students = overview.students,
        tasks = overview.overdueTasks;
      const subscriptions = unwrap(
        await this.reader.read<{ items: ManagerDashboardDto['expiringSubscriptions'] }>(
          tx,
          dashboardSubscriptionsSql(scope, now, expiryUntil),
        ),
      );
      const payments = unwrap(
        await this.reader.read<{ count: number; totals: DashboardCurrencyTotalDto[] }>(
          tx,
          pendingReceiptTotalsSql(scope, now),
        ),
      );
      return ok({
        generatedAt: now.toISOString(),
        students,
        upcomingLessons: overview.upcomingLessons.map((x) => ({
          ...x,
          startsAt: new Date(x.startsAt).toISOString(),
        })),
        overdueTasks: {
          count: tasks.count,
          top: tasks.top.map((x) => ({ ...x, dueAt: new Date(x.dueAt).toISOString() })),
        },
        expiringSubscriptions: subscriptions.items.map((x) => ({
          ...x,
          endsAt: new Date(x.endsAt).toISOString(),
        })),
        pendingPayments: {
          count: payments.count,
          totalsByCurrency: payments.totals.map((x) => ({
            currency: x.currency,
            amount: new Prisma.Decimal(x.amount).toFixed(4),
          })),
        },
      });
    });
  }
}
