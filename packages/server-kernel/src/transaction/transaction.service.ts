import { setTimeout as delay } from 'node:timers/promises';
import { Injectable, Module } from '@nestjs/common';
import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../database/database.module.js';
import { AppException, domainError } from '../errors/domain-error.js';
import type { DomainError } from '../errors/domain-error.js';

export type PrismaTransaction = Prisma.TransactionClient;
@Injectable()
export class TransactionService {
  constructor(private readonly db: DatabaseService) {}
  async runCritical<T>(
    fn: (tx: PrismaTransaction) => Promise<T>,
    options?: { maxRetries?: number },
  ): Promise<Result<T, DomainError>> {
    // maxRetries is kept for the requested API; the hard limit is three total attempts.
    const requested = options?.maxRetries ?? 3;
    if (!Number.isInteger(requested) || requested < 1 || requested > 3)
      return err(domainError('INVALID_RETRY_LIMIT', 400));
    for (let attempt = 1; attempt <= requested; attempt++) {
      try {
        return ok(
          await this.db.client.$transaction(fn, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15000,
            maxWait: 5000,
          }),
        );
      } catch (error: unknown) {
        if (error instanceof AppException) return err(error.domain);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          const meta = error.meta as
            | { code?: string; driverAdapterError?: { cause?: { originalCode?: string } } }
            | undefined;
          const retryable =
            error.code === 'P2034' ||
            meta?.code === '40001' ||
            meta?.code === '40P01' ||
            ['40001', '40P01'].includes(meta?.driverAdapterError?.cause?.originalCode ?? '');
          if (retryable) {
            if (attempt < requested) {
              await delay(25 * 2 ** (attempt - 1) + Math.floor(Math.random() * 25));
              continue;
            }
            return err(domainError('TRANSACTION_RETRY_EXHAUSTED', 503));
          }
          if (error.code === 'P2002') return err(domainError('CONFLICT', 409));
          if (error.code === 'P2003') return err(domainError('INVALID_REFERENCE', 422));
          if (meta?.code === '23P01' || meta?.driverAdapterError?.cause?.originalCode === '23P01')
            return err({
              ...domainError('CALENDAR_CONFLICT', 409),
              details: { constraint: 'resource_interval_exclusion' },
            });
        }
        return err(domainError('DATABASE_ERROR', 503));
      }
    }
    return err(domainError('TRANSACTION_RETRY_EXHAUSTED', 503));
  }
}
@Module({ providers: [TransactionService], exports: [TransactionService] })
export class TransactionModule {}
