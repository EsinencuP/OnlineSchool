import type { Prisma } from '@online-school/db';

export const databaseNow = async (tx: Prisma.TransactionClient): Promise<Date> =>
  (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
