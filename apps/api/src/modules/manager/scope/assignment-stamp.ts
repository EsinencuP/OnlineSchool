import type { Prisma } from '@online-school/db';
import { at } from '../../finance/finance-common.js';

/**
 * Start of a new assignment. Same-request scope checks read the database clock while portfolio reads
 * use the API clock, so the earlier of the two keeps a fresh assignment visible to both.
 */
export async function assignmentStamp(tx: Prisma.TransactionClient): Promise<Date> {
  const database = await at(tx);
  const api = new Date();
  return database < api ? database : api;
}
