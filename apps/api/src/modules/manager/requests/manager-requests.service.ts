import { Injectable } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import type { ManagerRequest } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { databaseError } from '../../../core/errors/database-error.js';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { UUID } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { at } from '../../finance/finance-common.js';
import type { ManagerContext } from '../context/manager-context.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type {
  CreateRequestDto,
  ListRequestsQueryDto,
  ManagerRequestDto,
  ManagerRequestPageDto,
  RequestKind,
  RequestStatus,
} from './manager-requests.dto.js';

export const requestView = (r: ManagerRequest): ManagerRequestDto => ({
  requestId: r.id,
  kind: r.kind as RequestKind,
  studentId: r.student_id,
  subscriptionId: r.subscription_id,
  reason: r.reason,
  proposedLessons: r.proposed_lessons,
  proposedUntil: r.proposed_until?.toISOString() ?? null,
  status: r.status as RequestStatus,
  requestedAt: r.requested_at.toISOString(),
  decidedAt: r.decided_at?.toISOString() ?? null,
  decisionNote: r.decision_note,
  permissionId: r.permission_id,
});
const encode = (r: { requested_at: Date; id: string }) =>
  Buffer.from(JSON.stringify([r.requested_at.toISOString(), r.id])).toString('base64url');
function decode(cursor: string): { at: Date; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      UUID.test(parsed[1]) &&
      Number.isFinite(Date.parse(parsed[0]))
    )
      return { at: new Date(parsed[0]), id: parsed[1] };
  } catch {
    /* invalid */
  }
  return null;
}

/** DEV-17/C and DEV-21/B: the manager formalises the family's request; the director decides. */
@Injectable()
export class ManagerRequestsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly scope: ManagerScopeService,
  ) {}

  private async authorize(
    ctx: ManagerContext,
    c: CriticalContext,
  ): Promise<Result<void, DomainError>> {
    const current = await this.scope.resolveContext({ ...c.actor, requestId: c.requestId }, c.tx);
    if (!current.ok) return current;
    return current.value.managerId === ctx.managerId && current.value.accountId === ctx.accountId
      ? ok(undefined)
      : err(domainError('FORBIDDEN_ROLE', 403));
  }

  async create(
    ctx: ManagerContext,
    studentId: string,
    input: CreateRequestDto,
    c: CriticalContext,
  ): Promise<Result<ManagerRequestDto, DomainError>> {
    const actor = await this.authorize(ctx, c);
    if (!actor.ok) return actor;
    const allowed = await this.scope.assertStudentInPortfolio(ctx, studentId, c.tx);
    if (!allowed.ok) return allowed;
    try {
      const tx = c.tx;
      const now = await at(tx);
      const subscription = await tx.subscription.findFirst({
        where: { id: input.subscriptionId, enrollment_ref: { student_id: studentId } },
        select: { id: true, full_price: true },
      });
      if (!subscription) return err(domainError('SUBSCRIPTION_NOT_FOUND', 404));
      const paid = new Prisma.Decimal(
        (
          await tx.paymentDistribution.aggregate({
            where: { subscription_id: subscription.id, approved_at: { not: null } },
            _sum: { amount: true },
          })
        )._sum.amount ?? 0,
      );
      if (input.kind === 'TEMPORARY_ACCESS') {
        if (paid.gte(subscription.full_price))
          return err(domainError('FULLY_PAID_USES_NORMAL_ACCESS', 422));
        if (input.proposedUntil && new Date(input.proposedUntil) <= now)
          return err(domainError('INVALID_ACCESS_EXPIRY', 422));
      } else {
        if (paid.lte(0)) return err(domainError('NOTHING_TO_REFUND', 422));
        if (input.proposedLessons !== undefined || input.proposedUntil !== undefined)
          return err(domainError('INVALID_INPUT', 422));
      }
      const pending = await tx.managerRequest.findFirst({
        where: { subscription_id: subscription.id, kind: input.kind, status: 'PENDING' },
        select: { id: true },
      });
      if (pending) return err(domainError('REQUEST_ALREADY_PENDING', 409));
      const row = await tx.managerRequest.create({
        data: {
          kind: input.kind,
          student_id: studentId,
          subscription_id: subscription.id,
          requested_by_id: ctx.managerId,
          reason: input.reason.trim(),
          proposed_lessons: input.proposedLessons ?? null,
          proposed_until: input.proposedUntil ? new Date(input.proposedUntil) : null,
          requested_at: now,
        },
      });
      return ok(requestView(row));
    } catch (error: unknown) {
      return err(databaseError(error));
    }
  }

  list(
    ctx: ManagerContext,
    q: ListRequestsQueryDto,
  ): Promise<Result<ManagerRequestPageDto, DomainError>> {
    return this.transactions.runReadOnly(async (tx) => {
      if (q.studentId) {
        const allowed = await this.scope.assertStudentInPortfolio(ctx, q.studentId, tx);
        if (!allowed.ok) return allowed;
      }
      const cursor = q.cursor ? decode(q.cursor) : null;
      if (q.cursor && !cursor) return err(domainError('INVALID_CURSOR', 422));
      const limit = q.limit ?? 20;
      const rows = await tx.managerRequest.findMany({
        where: {
          student: this.scope.portfolioWhere(ctx),
          ...(q.studentId ? { student_id: q.studentId } : {}),
          ...(q.status ? { status: q.status } : {}),
          ...(cursor
            ? {
                OR: [
                  { requested_at: { lt: cursor.at } },
                  { requested_at: cursor.at, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ requested_at: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      });
      const page = rows.slice(0, limit);
      const last = page[page.length - 1];
      return ok({
        items: page.map(requestView),
        nextCursor: rows.length > limit && last ? encode(last) : null,
      });
    });
  }

  async withdraw(
    ctx: ManagerContext,
    id: string,
    note: string | undefined,
    c: CriticalContext,
  ): Promise<Result<ManagerRequestDto, DomainError>> {
    const actor = await this.authorize(ctx, c);
    if (!actor.ok) return actor;
    if (!UUID.test(id)) return err(domainError('REQUEST_NOT_FOUND', 404));
    try {
      const tx = c.tx;
      const row = await tx.managerRequest.findFirst({
        where: { id, student: this.scope.portfolioWhere(ctx) },
      });
      if (!row) return err(domainError('REQUEST_NOT_FOUND', 404));
      if (row.status !== 'PENDING') return err(domainError('REQUEST_NOT_PENDING', 409));
      const changed = await tx.managerRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'WITHDRAWN',
          decided_by_id: ctx.managerId,
          decided_at: await at(tx),
          decision_note: note?.trim() ?? null,
        },
      });
      if (changed.count !== 1) return err(domainError('REQUEST_NOT_PENDING', 409));
      return ok(requestView(await tx.managerRequest.findUniqueOrThrow({ where: { id } })));
    } catch (error: unknown) {
      return err(databaseError(error));
    }
  }
}
