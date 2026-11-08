import { Prisma } from '@online-school/db';
import { domainError } from './domain-error.js';
import type { DomainError } from './domain-error.js';
export function databaseError(error: unknown): DomainError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as
      { code?: string; driverAdapterError?: { cause?: { originalCode?: string } } } | undefined;
    if (
      error.code === 'P2034' ||
      ['40001', '40P01'].includes(meta?.code ?? meta?.driverAdapterError?.cause?.originalCode ?? '')
    )
      return { ...domainError('TRANSACTION_CONFLICT', 503), retryable: true };
  }
  return domainError('DATABASE_ERROR', 503);
}
