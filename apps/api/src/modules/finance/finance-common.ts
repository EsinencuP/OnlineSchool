import { Prisma } from '@online-school/db';
import { domainError, fail } from '../../core/errors/domain-error.js';

export const Decimal = Prisma.Decimal.clone({ precision: 80 });
export const money = (value: unknown): Prisma.Decimal => {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/.test(value))
    return fail(domainError('INVALID_MONEY', 422));
  const result = new Decimal(value);
  return result.gt(0) ? result : fail(domainError('INVALID_MONEY', 422));
};
export const currency = (value: unknown): string =>
  typeof value === 'string' && /^[A-Z]{3}$/.test(value)
    ? value
    : fail(domainError('INVALID_CURRENCY', 422));
export const count = (value: unknown, min = 1, max = 10000): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : fail(domainError('INVALID_QUANTITY', 422));
export const date = (value: unknown): Date => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
    Number.isNaN(+new Date(value))
  )
    return fail(domainError('INVALID_DATE', 422));
  return new Date(value);
};
export const at = async (tx: Prisma.TransactionClient): Promise<Date> =>
  (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
export const operation = (id: string) => ({ source_operation_id: id });
export function serialize<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}
