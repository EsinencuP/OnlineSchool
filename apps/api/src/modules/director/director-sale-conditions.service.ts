import { Injectable } from '@nestjs/common';
import type { Prisma, SaleCondition } from '@online-school/db';
import { ok } from '@online-school/shared';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { AccountContext, CriticalContext } from '../../core/http.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { FinanceAccess } from '../finance/finance-access.service.js';
import { at, Decimal, money } from '../finance/finance-common.js';
import { string, uuid } from '../identity/input.js';
import type {
  PublishSaleConditionDto,
  SaleConditionsQueryDto,
} from './dto/director-sale-conditions.dto.js';

const active = (row: SaleCondition, now: Date) =>
  row.valid_from <= now && (!row.valid_to || row.valid_to > now);

function view(row: SaleCondition, now: Date) {
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    lessonCount: row.lesson_count,
    durationDays: row.duration_days,
    priceBeforeDiscount: row.list_price.toFixed(4),
    discount: row.discount_amount.toFixed(4),
    price: row.price.toFixed(4),
    unitPrice: row.lesson_unit_price.toFixed(4),
    currency: row.currency,
    validFrom: row.valid_from.toISOString(),
    validTo: row.valid_to?.toISOString() ?? null,
    status: active(row, now) ? 'ACTIVE' : row.valid_from > now ? 'SCHEDULED' : 'RETIRED',
    publishedById: row.published_by_id,
    publicationBasis: row.publication_basis,
    retiredById: row.retired_by_id,
    retirementBasis: row.retirement_basis,
  };
}

@Injectable()
export class DirectorSaleConditionsService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly access: FinanceAccess,
  ) {}

  private director(ctx: CriticalContext) {
    if (ctx.actor.role !== 'DIRECTOR' || !ctx.actor.mfaCompleted)
      return fail(domainError('FORBIDDEN', 403));
    return this.access.staff(ctx, true);
  }

  async list(actor: AccountContext, query: SaleConditionsQueryDto) {
    return unwrap(
      await this.transactions.runReadOnly(async (tx) => {
        await this.director({ actor, tx, requestId: '', operationId: '' });
        const now = await at(tx);
        const limit = 50;
        const rows = await tx.saleCondition.findMany({
          where: {
            ...(query.code ? { code: query.code } : {}),
            ...(query.after ? { id: { gt: uuid(query.after) } } : {}),
          },
          take: limit + 1,
          orderBy: { id: 'asc' },
        });
        return ok({
          items: rows.slice(0, limit).map((row) => view(row, now)),
          next: rows.length > limit ? rows[limit - 1]!.id : null,
        });
      }),
    );
  }

  private async lockCode(tx: Prisma.TransactionClient, code: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`sale-condition:${code}`},0))`;
  }

  private async close(
    tx: Prisma.TransactionClient,
    row: SaleCondition,
    staff: string,
    now: Date,
    reason: string,
  ) {
    if (!active(row, now) || row.valid_from >= now)
      return fail(domainError('SALE_CONDITION_NOT_RETIRABLE', 409));
    return tx.saleCondition.update({
      where: { id: row.id },
      data: { valid_to: now, retired_by_id: staff, retirement_basis: reason },
    });
  }

  async publish(ctx: CriticalContext, dto: PublishSaleConditionDto) {
    const staff = await this.director(ctx);
    const basis = string(dto.basis, 5, 500);
    const listPrice = money(dto.priceBeforeDiscount);
    const discount = new Decimal(dto.discount);
    const price = listPrice.sub(discount);
    if (discount.lt(0) || !price.gt(0))
      return fail(domainError('INVALID_SALE_CONDITION_PRICE', 422));
    const unit = price.div(dto.lessonCount);
    if (unit.decimalPlaces() > 4 || !unit.mul(dto.lessonCount).eq(price))
      return fail(domainError('SALE_PRICE_ALLOCATION_REQUIRES_REVIEW', 422));
    await this.lockCode(ctx.tx, dto.code);
    const now = await at(ctx.tx);
    const history = await ctx.tx.saleCondition.findMany({
      where: { code: dto.code },
      orderBy: { version: 'desc' },
    });
    const latest = history[0]?.version ?? 0;
    if (dto.expectedVersion !== latest) return fail(domainError('SALE_VERSION_CHANGED', 409));
    const current = history.filter((row) => active(row, now));
    if (current.length > 1 || history.some((row) => row.valid_from > now))
      return fail(domainError('SALE_HISTORY_REQUIRES_REVIEW', 409));
    if (current[0]) await this.close(ctx.tx, current[0], staff, now, basis);
    const created = await ctx.tx.saleCondition.create({
      data: {
        code: dto.code,
        version: latest + 1,
        lesson_count: dto.lessonCount,
        duration_days: dto.durationDays,
        list_price: listPrice,
        discount_amount: discount,
        price,
        lesson_unit_price: unit,
        currency: 'MDL',
        valid_from: now,
        published_by_id: staff,
        publication_basis: basis,
        source_operation_id: ctx.operationId,
      },
    });
    return view(created, now);
  }

  async retire(ctx: CriticalContext, rawId: string, rawBasis: string) {
    const staff = await this.director(ctx);
    const basis = string(rawBasis, 5, 500);
    const id = uuid(rawId);
    const row = await ctx.tx.saleCondition.findUnique({ where: { id } });
    if (!row) return fail(domainError('SALE_CONDITION_NOT_FOUND', 404));
    await this.lockCode(ctx.tx, row.code);
    const now = await at(ctx.tx);
    return view(await this.close(ctx.tx, row, staff, now, basis), now);
  }
}
