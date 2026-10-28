import { expect, test } from '@jest/globals';
import { createRequire } from 'node:module';
import {
  subscriptionDetailsSql,
  subscriptionPaymentsSql,
  subscriptionLedgerSql,
} from '../../apps/api/dist/student/subscription/subscription.sql.js';
import { asOf, fixtureCte, cases } from '../support/subscription-readonly-fixture.mjs';
const queries = {
  details: subscriptionDetailsSql,
  payments: subscriptionPaymentsSql,
  ledger: subscriptionLedgerSql,
};
const { Client } = createRequire(new URL('../../packages/db/package.json', import.meta.url))('pg'),
  connectionString = process.env.STU_READONLY_DATABASE_URL;
export function verifySubscriptionCase(item, row) {
  expect(row.forbidden).toBe(item.forbidden ?? false);
  if (item.forbidden) return;
  if (item.expected === null) {
    expect(row.data).toBeNull();
    return;
  }
  const expected = item.expected;
  if (item.mode === 'details') {
    expect(row.data).toMatchObject(expected);
    return;
  }
  expect(row.data.total).toBe(expected.total);
  if (expected.items !== undefined) expect(row.data.items).toHaveLength(expected.items);
  for (const key of ['amount', 'currency', 'lessonsAdded'])
    if (Object.hasOwn(expected, key)) expect(row.data.items[0][key]).toEqual(expected[key]);
  if (expected.latestBalance) expect(row.data.items[0].balanceAfter).toBe(expected.latestBalance);
  if (expected.types) expect(row.data.items.map((x) => x.type)).toEqual(expected.types);
}
(connectionString ? test : test.skip)(
  'PostgreSQL 18 subscription paid balance, confirmed allocations, lifecycle, history, correction and isolation',
  async () => {
    const db = new Client({ connectionString });
    await db.connect();
    try {
      await db.query('BEGIN READ ONLY');
      expect(
        Math.floor(
          Number((await db.query('SHOW server_version_num')).rows[0].server_version_num) / 10000,
        ),
      ).toBe(18);
      for (const item of cases) {
        const q = queries[item.mode](item.studentId, item.query, new Date(asOf));
        const [row] = (
          await db.query(
            `${fixtureCte},projection AS(${q.text}) SELECT * FROM projection`,
            q.values,
          )
        ).rows;
        verifySubscriptionCase(item, row);
      }
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.end();
    }
  },
);
