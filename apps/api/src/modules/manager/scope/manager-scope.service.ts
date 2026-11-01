import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../../core/database/database.module.js';
import { domainError } from '../../../core/errors/domain-error.js';
import { databaseError } from '../../../core/errors/database-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { UUID } from '../../../core/http.js';
import type { ManagerContext, SessionPrincipal } from '../context/manager-context.js';

@Injectable()
export class ManagerScopeService {
  constructor(private readonly db: DatabaseService) {}

  async resolveContext(
    principal: SessionPrincipal,
    tx?: Prisma.TransactionClient,
  ): Promise<Result<ManagerContext, DomainError>> {
    if (
      principal.kind !== 'STAFF' ||
      principal.roles.length !== 1 ||
      principal.roles[0] !== 'MANAGER'
    )
      return err(domainError('FORBIDDEN_ROLE', 403));
    try {
      const profile = await (tx ?? this.db.client).staffAccount.findFirst({
        where: { account_id: principal.accountId, account_kind: 'STAFF' },
        select: { id: true, deactivated_at: true },
      });
      if (!profile) return err(domainError('MANAGER_PROFILE_NOT_FOUND', 403));
      if (profile.deactivated_at) return err(domainError('MANAGER_INACTIVE', 403));
      return ok(
        Object.freeze({
          accountId: principal.accountId,
          managerId: profile.id,
          sessionId: principal.sessionId,
          requestId: principal.requestId,
        }),
      );
    } catch (error: unknown) {
      return err(databaseError(error));
    }
  }

  portfolioWhere(ctx: ManagerContext, now = new Date()): Prisma.StudentWhereInput {
    return {
      manager_assignments: {
        some: {
          manager_id: ctx.managerId,
          assigned_at: { lte: now },
          OR: [{ ended_at: null }, { ended_at: { gt: now } }],
        },
      },
    };
  }

  // Fixed SQL identifier st is private to the manager read model; all values stay bound.
  portfolioSql(ctx: ManagerContext, now: Date): Prisma.Sql {
    // Use the very same canonical temporal predicate as Prisma callers.
    const filter = this.portfolioWhere(ctx, now).manager_assignments!.some!;
    return Prisma.sql`EXISTS(SELECT 1 FROM assigned_managers am WHERE am.student_id=st.id
      AND am.manager_id=${filter.manager_id as string}::uuid AND am.assigned_at<=${now}
      AND (am.ended_at IS NULL OR am.ended_at>${now}))`;
  }

  async assertStudentInPortfolio(
    ctx: ManagerContext,
    studentId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Result<void, DomainError>> {
    if (!UUID.test(studentId)) return err(domainError('STUDENT_NOT_FOUND', 404));
    try {
      // Identical indexed, scoped existence query for both missing and foreign UUIDs.
      // Never load an unscoped student or their contacts to decide membership.
      const student = await (tx ?? this.db.client).student.findFirst({
        where: { AND: [{ id: studentId }, this.portfolioWhere(ctx)] },
        select: { id: true },
      });
      return student ? ok(undefined) : err(domainError('STUDENT_NOT_FOUND', 404));
    } catch (error: unknown) {
      return err(databaseError(error));
    }
  }
}
