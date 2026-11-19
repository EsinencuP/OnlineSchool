import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Decimal } from '../../apps/api/dist/modules/finance/finance-common.js';
import { DirectorSaleConditionsService } from '../../apps/api/dist/modules/director/director-sale-conditions.service.js';

const input = {
  code: 'LESSONS_8',
  expectedVersion: 1,
  lessonCount: 8,
  durationDays: 56,
  priceBeforeDiscount: '2800',
  discount: '280',
  basis: 'Approved autumn conditions',
};

function fixture() {
  const director = randomUUID();
  const now = new Date('2026-11-18T15:15:00Z');
  const row = {
    id: randomUUID(),
    code: input.code,
    version: 1,
    lesson_count: 8,
    duration_days: 56,
    valid_from: new Date('2026-10-01T00:00:00Z'),
    valid_to: null,
    currency: 'MDL',
    list_price: new Decimal(2400),
    discount_amount: new Decimal(0),
    price: new Decimal(2400),
    lesson_unit_price: new Decimal(300),
    published_by_id: null,
    publication_basis: null,
    retired_by_id: null,
    retirement_basis: null,
  };
  const tx = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(async (sql) => (sql.join('').includes('clock_timestamp') ? [{ now }] : [])),
    saleCondition: {
      findMany: jest.fn(async () => [row]),
      findUnique: jest.fn(async () => row),
      create: jest.fn(async ({ data }) => ({
        ...data,
        id: randomUUID(),
        valid_to: null,
        retired_by_id: null,
        retirement_basis: null,
      })),
      update: jest.fn(async ({ data }) => ({ ...row, ...data })),
    },
  };
  const ctx = { tx, actor: { role: 'DIRECTOR', mfaCompleted: true }, operationId: randomUUID() };
  return {
    service: new DirectorSaleConditionsService({}, { staff: async () => director }),
    tx,
    ctx,
    director,
    now,
    row,
  };
}

test('a new price version closes the previous catalog interval and preserves its price', async () => {
  const { service, ctx, tx, director, now, row } = fixture();
  const published = await service.publish(ctx, input);
  expect(published).toMatchObject({
    code: input.code,
    version: 2,
    price: '2520.0000',
    unitPrice: '315.0000',
    status: 'ACTIVE',
  });
  expect(tx.saleCondition.update).toHaveBeenCalledWith({
    where: { id: row.id },
    data: { valid_to: now, retired_by_id: director, retirement_basis: input.basis },
  });
  expect(tx.saleCondition.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      valid_from: now,
      version: 2,
      source_operation_id: ctx.operationId,
      published_by_id: director,
    }),
  });
  expect(row.price.toFixed(4)).toBe('2400.0000');
});

test('stale versions and fractional allocations require review before changing the catalog', async () => {
  const { service, ctx, tx, row } = fixture();
  await expect(service.publish(ctx, { ...input, expectedVersion: 0 })).rejects.toMatchObject({
    domain: { code: 'SALE_VERSION_CHANGED' },
  });
  await expect(service.publish(ctx, { ...input, discount: '279.9999' })).rejects.toMatchObject({
    domain: { code: 'SALE_PRICE_ALLOCATION_REQUIRES_REVIEW' },
  });
  row.valid_from = new Date('2026-12-01T00:00:00Z');
  await expect(service.publish(ctx, input)).rejects.toMatchObject({
    domain: { code: 'SALE_HISTORY_REQUIRES_REVIEW' },
  });
  expect(tx.saleCondition.update).not.toHaveBeenCalled();
  expect(tx.saleCondition.create).not.toHaveBeenCalled();
});

test('only a director with verified MFA can retire a version without replacing it', async () => {
  const { service, ctx, tx, row, now } = fixture();
  ctx.actor.mfaCompleted = false;
  await expect(service.retire(ctx, row.id, input.basis)).rejects.toMatchObject({
    domain: { code: 'FORBIDDEN' },
  });
  expect(tx.saleCondition.update).not.toHaveBeenCalled();
  ctx.actor.mfaCompleted = true;
  await expect(service.retire(ctx, row.id, input.basis)).resolves.toMatchObject({
    version: 1,
    status: 'RETIRED',
    validTo: now.toISOString(),
    retirementBasis: input.basis,
  });
  expect(tx.saleCondition.create).not.toHaveBeenCalled();
});
