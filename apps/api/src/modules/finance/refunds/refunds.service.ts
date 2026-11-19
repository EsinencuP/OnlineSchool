import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma, RefundRecord, RefundTransfer } from '@online-school/db';
import { ok } from '@online-school/shared';
import { domainError, fail, unwrap } from '../../../core/errors/domain-error.js';
import type { AccountContext, CriticalContext } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { string, uuid } from '../../identity/input.js';
import { FinanceAccess } from '../finance-access.service.js';
import { at, date, Decimal, money } from '../finance-common.js';
import { FinanceLedger } from '../finance-ledger.service.js';
import type {
  DecideRefundDto,
  PrepareRefundDto,
  ReportRefundTransferDto,
  ReviewRefundTransferDto,
} from './refunds.dto.js';
import { readRefundQuote } from './refund-quote.js';

export function refundSettlement(approved: Prisma.Decimal, transfers: RefundTransfer[]) {
  const verified = transfers.filter((row) => row.status === 'VERIFIED');
  const total = verified.reduce(
    (net, row) =>
      row.kind === 'RETURNED'
        ? net.sub(row.amount)
        : row.kind === 'PAID'
          ? net.add(row.amount)
          : net,
    new Decimal(0),
  );
  return {
    net: total,
    remaining: new Decimal(approved).sub(total),
    pendingReview: transfers.some((row) => row.status === 'REPORTED'),
  };
}

const decision = (r: RefundRecord) => ({
  id: r.id,
  version: r.version,
  status: r.declined_at
    ? ('DECLINED' as const)
    : r.approved_by_director_at
      ? ('APPROVED' as const)
      : ('DRAFT' as const),
});

const transferView = (r: RefundTransfer) => ({
  id: r.id,
  kind: r.kind,
  channel: r.channel,
  status: r.status,
  amount: r.amount.toFixed(4),
  occurredAt: r.occurred_at.toISOString(),
  originalTransferId: r.original_transfer_id,
});

@Injectable()
export class RefundsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly access: FinanceAccess,
    private readonly ledger: FinanceLedger,
  ) {}

  private async director(ctx: CriticalContext) {
    if (ctx.actor.role !== 'DIRECTOR' || !ctx.actor.mfaCompleted)
      return fail(domainError('FORBIDDEN', 403));
    return this.access.staff(ctx, true);
  }

  private async request(ctx: CriticalContext, requestId: string, studentId?: string, lock = false) {
    const id = uuid(requestId);
    if (studentId === undefined) await this.director(ctx);
    else {
      if (ctx.actor.role !== 'MANAGER') return fail(domainError('FORBIDDEN', 403));
      await this.access.student(ctx, studentId);
    }
    if (lock)
      await ctx.tx.$queryRaw`SELECT id FROM manager_requests WHERE id=${id}::uuid FOR UPDATE`;
    const request = await ctx.tx.managerRequest.findFirst({
      where: {
        id,
        kind: 'REFUND',
        ...(studentId !== undefined ? { student_id: uuid(studentId) } : {}),
      },
      include: { refund: true },
    });
    if (!request) return fail(domainError('REFUND_REQUEST_NOT_FOUND', 404));
    return request;
  }

  private async quote(ctx: CriticalContext, studentId: string, subscriptionId: string, now: Date) {
    return (
      (await readRefundQuote(ctx.tx, studentId, subscriptionId, now)) ??
      fail(domainError('REFUND_SUBSCRIPTION_NOT_FOUND', 404))
    );
  }

  async cases(actor: AccountContext, after?: string) {
    return unwrap(
      await this.transactions.runReadOnly(async (tx) => {
        await this.director({ actor, tx, requestId: '', operationId: '' });
        const pageSize = 50;
        const rows = await tx.managerRequest.findMany({
          where: {
            kind: 'REFUND',
            status: 'APPROVED',
            ...(after ? { id: { gt: uuid(after) } } : {}),
          },
          orderBy: { id: 'asc' },
          take: pageSize + 1,
          include: {
            refund: {
              include: { _count: { select: { transfers: { where: { status: 'REPORTED' } } } } },
            },
          },
        });
        const page = rows.slice(0, pageSize);
        return ok({
          items: page.map((row) => ({
            requestId: row.id,
            studentId: row.student_id,
            subscriptionId: row.subscription_id,
            requestedAt: row.requested_at.toISOString(),
            decision: row.refund ? decision(row.refund) : null,
            pendingTransfers: row.refund?._count.transfers ?? 0,
          })),
          next: rows.length > pageSize ? page.at(-1)!.id : null,
        });
      }),
    );
  }

  async view(actor: AccountContext, requestId: string, studentId?: string) {
    return unwrap(
      await this.transactions.runReadOnly(async (tx) => {
        const ctx = { actor, tx, requestId: '', operationId: '' };
        const request = await this.request(ctx, requestId, studentId);
        const row = request.refund;
        const transfers = row?.approved_amount ? await this.transfers(tx, row.id) : [];
        const settlement = row?.approved_amount
          ? refundSettlement(row.approved_amount, transfers)
          : null;
        return ok({
          requestId: request.id,
          requestStatus: request.status,
          subscriptionId: request.subscription_id,
          quote:
            !row?.approved_by_director_at &&
            !row?.declined_at &&
            ['PENDING', 'APPROVED'].includes(request.status)
              ? await this.quote(ctx, request.student_id, request.subscription_id, await at(tx))
              : null,
          decision: row
            ? {
                ...decision(row),
                preparedById: row.prepared_by_id,
                preparedAt: row.prepared_at?.toISOString() ?? null,
                quantity: row.paid_unused_quantity,
                calculatedAmount: row.calculated_amount.toFixed(4),
                calculationBasis: row.calculation_basis,
                revision: row.quote_revision,
                calculationSnapshot: row.calculation_snapshot,
                currency: row.currency,
                approvedAmount: row.approved_amount?.toFixed(4) ?? null,
                decidedById: row.approved_by_director_id ?? row.declined_by_id,
                decidedAt: (row.approved_by_director_at ?? row.declined_at)?.toISOString() ?? null,
                decisionBasis: row.approval_basis ?? row.decline_reason,
              }
            : null,
          transfers: transfers.map((transfer) => ({
            ...transferView(transfer),
            reference: transfer.reference,
            evidence: transfer.evidence,
            reportedById: transfer.reported_by_id,
            reportedAt: transfer.reported_at.toISOString(),
            reviewedById: transfer.reviewed_by_id,
            reviewedAt: transfer.reviewed_at?.toISOString() ?? null,
            reviewReason: transfer.review_reason,
          })),
          settlement: settlement
            ? {
                verifiedNet: settlement.net.toFixed(4),
                remaining: settlement.remaining.toFixed(4),
                status: settlement.pendingReview
                  ? ('AWAITING_REVIEW' as const)
                  : settlement.remaining.isZero()
                    ? ('EXECUTED' as const)
                    : settlement.net.gt(0)
                      ? ('PARTIALLY_EXECUTED' as const)
                      : ('AWAITING_EXECUTION' as const),
              }
            : null,
        });
      }),
    );
  }

  async prepare(ctx: CriticalContext, studentId: string, requestId: string, dto: PrepareRefundDto) {
    const request = await this.request(ctx, requestId, studentId, true);
    const row = request.refund;
    if (
      !['PENDING', 'APPROVED'].includes(request.status) ||
      row?.approved_by_director_at ||
      row?.declined_at
    )
      return fail(domainError('REFUND_NOT_EDITABLE', 409));
    if ((row?.version ?? 0) !== dto.version)
      return fail(domainError('REFUND_VERSION_CHANGED', 409));
    const now = await at(ctx.tx);
    const quote = await this.quote(ctx, request.student_id, request.subscription_id, now);
    if (quote.revision !== dto.revision) return fail(domainError('REFUND_QUOTE_CHANGED', 409));
    if (dto.quantity > quote.eligibleQuantity)
      return fail(domainError('REFUND_RIGHTS_UNAVAILABLE', 422));
    const draft = {
      prepared_by_id: await this.access.staff(ctx),
      prepared_at: now,
      version: dto.version + 1,
      paid_unused_quantity: dto.quantity,
      original_paid_unit_price: quote.unitPrice,
      calculated_amount: new Decimal(quote.unitPrice).mul(dto.quantity),
      calculation_snapshot: quote,
      quote_revision: quote.revision,
      calculation_basis: string(dto.basis, 5, 500),
      currency: quote.currency,
    };
    return decision(
      row
        ? await ctx.tx.refundRecord.update({ where: { id: row.id }, data: draft })
        : await ctx.tx.refundRecord.create({
            data: {
              ...draft,
              request_id: request.id,
              subscription_id: request.subscription_id,
              source_operation_id: ctx.operationId,
            },
          }),
    );
  }

  async decide(ctx: CriticalContext, requestId: string, dto: DecideRefundDto) {
    const staffId = await this.director(ctx);
    const request = await this.request(ctx, requestId, undefined, true);
    const row = request.refund;
    if (!row) return fail(domainError('REFUND_DRAFT_REQUIRED', 409));
    if (
      !['PENDING', 'APPROVED'].includes(request.status) ||
      row.approved_by_director_at ||
      row.declined_at
    )
      return fail(domainError('REFUND_NOT_EDITABLE', 409));
    if (row.version !== dto.version) return fail(domainError('REFUND_VERSION_CHANGED', 409));
    const basis = string(dto.basis, 5, 500);
    if (dto.decision === 'DECLINE') {
      if (dto.amount !== undefined) return fail(domainError('INVALID_REFUND_DECISION', 422));
      return decision(
        await ctx.tx.refundRecord.update({
          where: { id: row.id },
          data: {
            declined_by_id: staffId,
            declined_at: await at(ctx.tx),
            decline_reason: basis,
          },
        }),
      );
    }
    if (request.status !== 'APPROVED') return fail(domainError('REFUND_REQUEST_NOT_ACCEPTED', 409));
    if (row.paid_unused_quantity === 0) return fail(domainError('REFUND_RIGHTS_UNAVAILABLE', 422));
    if (!row.calculated_amount.eq(money(dto.amount)))
      return fail(domainError('REFUND_AMOUNT_MISMATCH', 422));
    await ctx.tx
      .$queryRaw`SELECT id FROM subscriptions WHERE id=${row.subscription_id}::uuid FOR UPDATE`;
    await ctx.tx
      .$queryRaw`SELECT id FROM entitlement_grants WHERE subscription_id=${row.subscription_id}::uuid ORDER BY id FOR UPDATE`;
    const now = await at(ctx.tx);
    const quote = await this.quote(ctx, request.student_id, request.subscription_id, now);
    if (quote.revision !== row.quote_revision)
      return fail(domainError('REFUND_QUOTE_CHANGED', 409));
    if (row.paid_unused_quantity > quote.eligibleQuantity)
      return fail(domainError('REFUND_RIGHTS_UNAVAILABLE', 422));
    const periodId = await this.ledger.period(ctx.tx, now);
    const approved = await ctx.tx.refundRecord.update({
      where: { id: row.id },
      data: {
        approved_amount: row.calculated_amount,
        approved_by_director_id: staffId,
        approved_by_director_at: now,
        approval_operation_id: ctx.operationId,
        approval_basis: basis,
      },
    });
    let quantity = row.paid_unused_quantity;
    for (const grant of quote.grants) {
      if (quantity === 0) break;
      const used = Math.min(quantity, grant.remaining);
      if (!used) continue;
      await ctx.tx.entitlementAdjustment.create({
        data: {
          grant_id: grant.id,
          refund_id: row.id,
          kind: 'GRANT_DELTA',
          delta_quantity: -used,
          author_id: staffId,
          reason: 'APPROVED_REFUND',
          effective_at: now,
          financial_period_id: periodId,
          source_operation_id: randomUUID(),
        },
      });
      quantity -= used;
    }
    await this.ledger.event(ctx, {
      refund_approval_id: row.id,
      basis: 'APPROVED_REFUND',
      source_operation_id: randomUUID(),
    });
    return decision(approved);
  }

  private transfers(tx: Prisma.TransactionClient, refundId: string) {
    return tx.refundTransfer.findMany({
      where: { refund_id: refundId },
      orderBy: [{ reported_at: 'asc' }, { id: 'asc' }],
    });
  }

  private assertTransferLimit(
    row: RefundRecord,
    transfer: Pick<RefundTransfer, 'kind' | 'amount' | 'original_transfer_id' | 'occurred_at'>,
    verified: RefundTransfer[],
  ) {
    if (transfer.kind === 'RETURNED') {
      const source = verified.find(
        (r) => r.id === transfer.original_transfer_id && r.kind === 'PAID',
      );
      if (!source || transfer.occurred_at < source.occurred_at)
        return fail(domainError('REFUND_TRANSFER_SOURCE_INVALID', 422));
      const returned = verified
        .filter((r) => r.original_transfer_id === source.id)
        .reduce((total, r) => total.add(r.amount), new Decimal(0));
      if (returned.add(transfer.amount).gt(source.amount))
        return fail(domainError('REFUND_TRANSFER_LIMIT', 422));
    } else if (transfer.original_transfer_id) {
      return fail(domainError('REFUND_TRANSFER_SOURCE_INVALID', 422));
    } else if (
      transfer.kind === 'PAID' &&
      transfer.amount.gt(refundSettlement(row.approved_amount!, verified).remaining)
    ) {
      return fail(domainError('REFUND_TRANSFER_LIMIT', 422));
    }
  }

  async report(
    ctx: CriticalContext,
    studentId: string,
    requestId: string,
    dto: ReportRefundTransferDto,
  ) {
    const request = await this.request(ctx, requestId, studentId, true);
    const row = request.refund;
    if (!row?.approved_amount || !row.approved_by_director_at)
      return fail(domainError('REFUND_NOT_APPROVED', 409));
    const now = await at(ctx.tx);
    const occurredAt = date(dto.occurredAt);
    if (occurredAt < row.approved_by_director_at || occurredAt > now)
      return fail(domainError('INVALID_REFUND_TRANSFER_DATE', 422));
    const fields = {
      kind: dto.kind,
      occurred_at: occurredAt,
      amount: money(dto.amount),
      original_transfer_id: dto.originalTransferId ? uuid(dto.originalTransferId) : null,
    };
    const transfers = await this.transfers(ctx.tx, row.id);
    if (fields.kind === 'RETURNED') {
      const source = transfers.find(
        (r) => r.id === fields.original_transfer_id && r.kind === 'PAID' && r.status === 'VERIFIED',
      );
      if (!source || occurredAt < source.occurred_at)
        return fail(domainError('REFUND_TRANSFER_SOURCE_INVALID', 422));
    } else if (fields.original_transfer_id)
      return fail(domainError('REFUND_TRANSFER_SOURCE_INVALID', 422));
    const reference = string(dto.reference, 1, 160);
    if (transfers.some((r) => r.reference === reference && r.status !== 'REJECTED'))
      return fail(domainError('REFUND_TRANSFER_ALREADY_RECORDED', 409));
    return transferView(
      await ctx.tx.refundTransfer.create({
        data: {
          ...fields,
          channel: string(dto.channel, 2, 40),
          refund_id: row.id,
          reference,
          evidence: string(dto.evidence, 5, 160),
          reported_by_id: await this.access.staff(ctx),
          reported_at: now,
          source_operation_id: ctx.operationId,
        },
      }),
    );
  }

  async reviewTransfer(
    ctx: CriticalContext,
    requestId: string,
    transferId: string,
    dto: ReviewRefundTransferDto,
  ) {
    const staffId = await this.director(ctx);
    const request = await this.request(ctx, requestId, undefined, true);
    const row = request.refund;
    if (!row?.approved_amount) return fail(domainError('REFUND_NOT_APPROVED', 409));
    const transfers = await this.transfers(ctx.tx, row.id);
    const transfer = transfers.find((r) => r.id === uuid(transferId));
    if (!transfer) return fail(domainError('REFUND_TRANSFER_NOT_FOUND', 404));
    if (transfer.status !== 'REPORTED')
      return fail(domainError('REFUND_TRANSFER_ALREADY_REVIEWED', 409));
    const verified = dto.decision === 'VERIFY';
    if (verified)
      this.assertTransferLimit(
        row,
        transfer,
        transfers.filter((r) => r.status === 'VERIFIED'),
      );
    const reviewed = await ctx.tx.refundTransfer.update({
      where: { id: transfer.id },
      data: {
        status: verified ? 'VERIFIED' : 'REJECTED',
        reviewed_at: await at(ctx.tx),
        reviewed_by_id: staffId,
        review_reason: string(dto.basis, 5, 500),
        review_operation_id: ctx.operationId,
      },
    });
    if (verified && transfer.kind !== 'FAILED') {
      await this.ledger.event(ctx, {
        refund_transfer_id: transfer.id,
        basis: transfer.kind === 'RETURNED' ? 'VERIFIED_REFUND_RETURN' : 'VERIFIED_REFUND_TRANSFER',
        source_operation_id: randomUUID(),
      });
    }
    return transferView(reviewed);
  }
}
