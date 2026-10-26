import { PrismaPg } from '@prisma/adapter-pg';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { PrismaClient } from './generated/prisma/client.js';

export { PrismaClient, Prisma } from './generated/prisma/client.js';
export type * from './generated/prisma/models.js';
export type * from './generated/prisma/client.js';
export * from './generated/prisma/enums.js';

export type DatabaseEnvironment = Readonly<{
  DATABASE_URL?: string;
  DIRECT_URL?: string;
}>;

export type DatabaseClientError = {
  code: 'DATABASE_URL_MISSING' | 'DATABASE_URL_INVALID' | 'DATABASE_CLIENT_INIT_FAILED';
  variable: 'DATABASE_URL' | 'DIRECT_URL';
};

function createClient(
  environment: DatabaseEnvironment,
  variable: DatabaseClientError['variable'],
): Result<PrismaClient, DatabaseClientError> {
  const connectionString = environment[variable];
  if (!connectionString?.trim()) return err({ code: 'DATABASE_URL_MISSING', variable });

  try {
    const url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
      return err({ code: 'DATABASE_URL_INVALID', variable });
    }
  } catch {
    return err({ code: 'DATABASE_URL_INVALID', variable });
  }

  try {
    const adapter = new PrismaPg({
      connectionString,
      max: variable === 'DIRECT_URL' ? 1 : 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
    return ok(new PrismaClient({ adapter }));
  } catch {
    // Do not expose driver errors: they may contain connection credentials.
    return err({ code: 'DATABASE_CLIENT_INIT_FAILED', variable });
  }
}

export function createPoolClient(
  environment: DatabaseEnvironment = process.env,
): Result<PrismaClient, DatabaseClientError> {
  return createClient(environment, 'DATABASE_URL');
}

export function createDirectClient(
  environment: DatabaseEnvironment = process.env,
): Result<PrismaClient, DatabaseClientError> {
  return createClient(environment, 'DIRECT_URL');
}
