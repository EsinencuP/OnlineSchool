import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { LedgerAccountType, LedgerDirection, LedgerDocument, Prisma } from '@online-school/db';
import { domainError, fail } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { object, string, uuid } from '../identity/input.js';
import { at, currency, Decimal, money } from './finance-common.js';
import { FinanceAccess } from './finance-access.service.js';
import { FinanceEvents } from './finance-events.service.js';
import { LedgerPublicationService } from './ledger-publication.service.js';

export type JournalLine = {
  account_type: LedgerAccountType;
  direction: LedgerDirection;
  amount: Prisma.Decimal;
  currency: string;
};
const accounts = [
  'UNALLOCATED_FUNDS',
  'CASH',
  'CUSTOMER_ADVANCE',
  'LESSON_REVENUE',
  'TEACHER_EXPENSE',
  'TEACHER_PAYABLE',
  'REFUND_PAYABLE',
  'CORRECTION',
];
export const pair = (
  amount: Prisma.Decimal,
  unit: string,
  debit: LedgerAccountType,
  credit: LedgerAccountType,
): JournalLine[] => [
  { account_type: debit, direction: 'DEBIT', amount, currency: unit },
  { account_type: credit, direction: 'CREDIT', amount, currency: unit },
];
@Injectable()
export class FinanceLedger {
  constructor(
    private readonly publisher: LedgerPublicationService,
    private readonly access: FinanceAccess,
    private readonly events: FinanceEvents,
  ) {}
  async period(tx: Prisma.TransactionClient, time: Date, id?: string) {
    const rows = await tx.$queryRaw<
      { id: string; closed_at: Date | null }[]
    >`SELECT id,closed_at FROM financial_periods WHERE starts_at<=${time} AND ends_at>${time} FOR UPDATE`;
    if (!rows.length || rows[0]!.closed_at || (id && id !== rows[0]!.id))
      return fail(domainError('CLOSED_PERIOD', 422));
    return rows[0]!.id;
  }
  parseLines(value: unknown): JournalLine[] {
    if (!Array.isArray(value) || value.length < 2 || value.length > 500)
      return fail(domainError('INVALID_LEDGER_LINES', 422));
    const lines = value.map((value) => {
      const row = object(value, ['accountType', 'direction', 'amount', 'currency']);
      if (
        !accounts.includes(row.accountType as string) ||
        !['DEBIT', 'CREDIT'].includes(row.direction as string)
      )
        return fail(domainError('INVALID_LEDGER_LINES', 422));
      return {
        account_type: row.accountType as LedgerAccountType,
        direction: row.direction as LedgerDirection,
        amount: money(row.amount),
        currency: currency(row.currency),
      };
    });
    const sums = new Map<string, Prisma.Decimal>();
    for (const line of lines)
      sums.set(
        line.currency,
        (sums.get(line.currency) ?? new Decimal(0)).add(
          line.direction === 'DEBIT' ? line.amount : line.amount.negated(),
        ),
      );
    if ([...sums.values()].some((sum) => !sum.isZero()))
      return fail(domainError('LEDGER_UNBALANCED', 422));
    return lines;
  }
  same(a: JournalLine[], b: JournalLine[]): boolean {
    const rows = (lines: JournalLine[]) =>
      lines
        .map((l) => `${l.currency}:${l.account_type}:${l.direction}:${l.amount.toFixed(4)}`)
        .sort();
    return JSON.stringify(rows(a)) === JSON.stringify(rows(b));
  }
  async expected(tx: Prisma.TransactionClient, doc: LedgerDocument): Promise<JournalLine[]> {
    if (doc.payment_id) {
      const r = await tx.paymentReceipt.findUniqueOrThrow({ where: { id: doc.payment_id } });
      if (!r.confirmed_by_director_at) return fail(domainError('PAYMENT_NOT_CONFIRMED', 422));
      return pair(r.amount, r.currency, 'CASH', 'UNALLOCATED_FUNDS');
    }
    if (doc.distribution_id) {
      const r = await tx.paymentDistribution.findUniqueOrThrow({
        where: { id: doc.distribution_id },
      });
      if (!r.approved_at) return fail(domainError('DISTRIBUTION_NOT_APPROVED', 422));
      return pair(r.amount, r.currency, 'UNALLOCATED_FUNDS', 'CUSTOMER_ADVANCE');
    }
    if (doc.consumption_id) {
      const r = await tx.entitlementConsumption.findUniqueOrThrow({
        where: { id: doc.consumption_id },
      });
      const sub = await tx.subscription.findUniqueOrThrow({ where: { id: r.subscription_id } });
      if (r.cancelled_at) return fail(domainError('CONSUMPTION_CANCELLED', 422));
      return pair(
        new Decimal(sub.original_paid_unit_price).mul(r.quantity),
        sub.currency,
        'CUSTOMER_ADVANCE',
        'LESSON_REVENUE',
      );
    }
    if (doc.accrual_id) {
      const r = await tx.teacherAccrual.findUniqueOrThrow({ where: { id: doc.accrual_id } });
      if (!r.amount.gt(0)) return fail(domainError('ZERO_ACCRUAL_HAS_NO_ENTRY', 422));
      return pair(r.amount, r.currency, 'TEACHER_EXPENSE', 'TEACHER_PAYABLE');
    }
    if (doc.payout_id) {
      const r = await tx.confirmedPayout.findUniqueOrThrow({ where: { id: doc.payout_id } });
      return pair(r.amount, r.currency, 'TEACHER_PAYABLE', 'CASH');
    }
    if (doc.refund_id) {
      const r = await tx.refundRecord.findUniqueOrThrow({ where: { id: doc.refund_id } });
      if (!r.executed_at || !r.executed_amount)
        return fail(domainError('REFUND_NOT_EXECUTED', 422));
      return pair(r.executed_amount, r.currency, 'CUSTOMER_ADVANCE', 'CASH');
    }
    return fail(domainError('LEDGER_SOURCE_INVALID', 422));
  }
  async post(
    ctx: CriticalContext,
    doc: LedgerDocument,
    lines: JournalLine[],
    periodId?: string,
    reversesId?: string,
    entitlementSnapshot?: { before: Prisma.Decimal; after: Prisma.Decimal },
  ) {
    const staff = await this.access.staff(ctx);
    const now = await at(ctx.tx);
    const period = await this.period(ctx.tx, now, periodId);
    const existing = await ctx.tx.ledgerEntry.findUnique({ where: { document_id: doc.id } });
    if (existing?.published_at) return fail(domainError('LEDGER_ALREADY_PUBLISHED', 409));
    const entry =
      existing ??
      (await ctx.tx.ledgerEntry.create({
        data: {
          document_id: doc.id,
          financial_period_id: period,
          effective_at: now,
          currency: lines[0]!.currency,
          reverses_entry_id: reversesId ?? null,
          source_operation_id: randomUUID(),
          ...(entitlementSnapshot
            ? {
                entitlement_balance_before: entitlementSnapshot.before,
                entitlement_balance_after: entitlementSnapshot.after,
              }
            : {}),
        },
      }));
    if (existing) {
      if (existing.financial_period_id !== period) return fail(domainError('CLOSED_PERIOD', 422));
      const prior = await ctx.tx.ledgerLine.findMany({ where: { entry_id: existing.id } });
      if (prior.length && !this.same(prior, lines))
        return fail(domainError('DRAFT_LINES_MISMATCH', 422));
      if (!prior.length)
        await ctx.tx.ledgerLine.createMany({
          data: lines.map((l, i) => ({
            account_type: l.account_type,
            direction: l.direction,
            amount: l.amount,
            currency: l.currency,
            position: i + 1,
            entry_id: entry.id,
          })),
        });
    } else
      await ctx.tx.ledgerLine.createMany({
        data: lines.map((l, i) => ({
          account_type: l.account_type,
          direction: l.direction,
          amount: l.amount,
          currency: l.currency,
          position: i + 1,
          entry_id: entry.id,
        })),
      });
    const published = await this.publisher.publishInTransaction(ctx.tx, {
      entryId: entry.id,
      actorStaffId: staff,
      operationId: randomUUID(),
    });
    if (!published.ok)
      return fail(
        domainError(
          published.error.code === 'UNBALANCED' ? 'LEDGER_UNBALANCED' : published.error.code,
          published.error.code === 'FORBIDDEN' ? 403 : 422,
        ),
      );
    await this.events.record(ctx, 'ledger.published', 'LedgerEntry', entry.id, {
      documentId: doc.id,
    });
    return published.value;
  }
  async event(
    ctx: CriticalContext,
    source: Prisma.LedgerDocumentUncheckedCreateInput,
    entitlementSnapshot?: { before: Prisma.Decimal; after: Prisma.Decimal },
  ) {
    const doc = await ctx.tx.ledgerDocument.create({ data: source });
    return this.post(
      ctx,
      doc,
      await this.expected(ctx.tx, doc),
      undefined,
      undefined,
      entitlementSnapshot,
    );
  }
  async publish(ctx: CriticalContext, body: unknown) {
    await this.access.staff(ctx, true);
    const input = object(body, ['documentId', 'entryId', 'periodId', 'lines']);
    if ((input.documentId !== undefined) === (input.entryId !== undefined))
      return fail(domainError('INVALID_INPUT', 400));
    const supplied = input.lines === undefined ? undefined : this.parseLines(input.lines);
    const old =
      input.entryId === undefined
        ? null
        : await ctx.tx.ledgerEntry.findUnique({ where: { id: uuid(input.entryId) } });
    if (input.entryId !== undefined && !old) return fail(domainError('NOT_FOUND', 404));
    const doc = await ctx.tx.ledgerDocument.findUnique({
      where: { id: input.documentId === undefined ? old!.document_id : uuid(input.documentId) },
    });
    if (!doc) return fail(domainError('NOT_FOUND', 404));
    const expected = await this.expected(ctx.tx, doc);
    if (supplied && !this.same(supplied, expected))
      return fail(domainError('LEDGER_SOURCE_MISMATCH', 422));
    return this.post(
      ctx,
      doc,
      expected,
      input.periodId === undefined ? undefined : uuid(input.periodId),
    );
  }
  async correct(ctx: CriticalContext, body: unknown) {
    await this.access.staff(ctx, true);
    const input = object(body, ['entryId', 'periodId', 'reason', 'replacementLines']);
    const id = uuid(input.entryId),
      reason = string(input.reason, 5, 500);
    await ctx.tx.$queryRaw`SELECT id FROM ledger_entries WHERE id=${id}::uuid FOR UPDATE`;
    const entry = await ctx.tx.ledgerEntry.findUnique({ where: { id } });
    if (!entry?.published_at) return fail(domainError('PUBLISHED_SOURCE_REQUIRED', 422));
    if (await ctx.tx.ledgerEntry.findFirst({ where: { reverses_entry_id: id } }))
      return fail(domainError('LEDGER_ALREADY_CORRECTED', 409));
    const doc = await ctx.tx.ledgerDocument.findUniqueOrThrow({ where: { id: entry.document_id } });
    if (doc.correction_of_document_id)
      return fail(domainError('CORRECTION_CHAIN_REQUIRES_REVIEW', 422));
    const original = await ctx.tx.ledgerLine.findMany({
      where: { entry_id: id },
      orderBy: { position: 'asc' },
    });
    const expected = await this.expected(ctx.tx, doc);
    const replacement =
      input.replacementLines === undefined ? expected : this.parseLines(input.replacementLines);
    if (!this.same(replacement, expected)) return fail(domainError('LEDGER_SOURCE_MISMATCH', 422));
    if (this.same(original, replacement))
      return fail(domainError('LEDGER_NO_CORRECTION_REQUIRED', 422));
    const period = input.periodId === undefined ? undefined : uuid(input.periodId);
    const reversalDoc = await ctx.tx.ledgerDocument.create({
      data: { correction_of_document_id: doc.id, basis: reason, source_operation_id: randomUUID() },
    });
    const reverse = await this.post(
      ctx,
      reversalDoc,
      original.map((l) => ({ ...l, direction: l.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT' })),
      period,
      id,
    );
    const correctedDoc = await ctx.tx.ledgerDocument.create({
      data: { correction_of_document_id: doc.id, basis: reason, source_operation_id: randomUUID() },
    });
    const corrected = await this.post(ctx, correctedDoc, replacement, period);
    return { id: corrected.id, reversalEntryId: reverse.id };
  }
  async reverseConsumption(ctx: CriticalContext, consumptionId: string, reason: string) {
    const doc = await ctx.tx.ledgerDocument.findUnique({
      where: { consumption_id: consumptionId },
    });
    if (!doc) return;
    const entry = await ctx.tx.ledgerEntry.findUnique({ where: { document_id: doc.id } });
    if (!entry?.published_at) return;
    const lines = await ctx.tx.ledgerLine.findMany({ where: { entry_id: entry.id } });
    const reversal = await ctx.tx.ledgerDocument.create({
      data: { correction_of_document_id: doc.id, basis: reason, source_operation_id: randomUUID() },
    });
    return this.post(
      ctx,
      reversal,
      lines.map((l) => ({ ...l, direction: l.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT' })),
      undefined,
      entry.id,
    );
  }
}
