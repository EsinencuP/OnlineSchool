import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
@Injectable()
export class ManagerDashboardRead {
  // Called exclusively with the core READ ONLY transaction, never the root client.
  async read<T>(tx: Prisma.TransactionClient, sql: Prisma.Sql): Promise<Result<T, DomainError>> {
    try {
      const rows = await tx.$queryRaw<T[]>(sql);
      return rows[0] ? ok(rows[0]) : err(domainError('DASHBOARD_UNAVAILABLE', 503));
    } catch {
      return err(domainError('DASHBOARD_UNAVAILABLE', 503));
    }
  }
}
