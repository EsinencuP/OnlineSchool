import { expect, test } from '@jest/globals';
import { createRequire } from 'node:module';
import {
  notificationSqlCases,
  notificationFixtureCte,
  notificationFixtureQuery,
} from '../support/notifications-readonly-fixture.mjs';
const { Client } = createRequire(new URL('../../packages/db/package.json', import.meta.url))('pg');
const connectionString = process.env.STU_READONLY_DATABASE_URL;
(connectionString ? test : test.skip)(
  'read-only PostgreSQL notification isolation, paging,500 bound,90-day TTL and timezone expiry',
  async () => {
    const db = new Client({ connectionString });
    await db.connect();
    try {
      await db.query('BEGIN READ ONLY');
      for (const item of notificationSqlCases) {
        const { tables, query } = await notificationFixtureQuery(item);
        const { rows } = await db.query(
          `${notificationFixtureCte(tables)},projection AS(${query.text}) SELECT * FROM projection`,
          query.values,
        );
        if (item.mode === 'list') {
          expect(rows[0].total).toBe(item.total);
          expect(rows[0].unreadCount).toBe(item.unread);
          expect(rows[0].items.map((n) => n.notificationId)).toEqual(item.ids);
        } else if (item.mode === 'archive')
          expect(rows.map((n) => n.id).sort()).toEqual([...item.ids].sort());
        else expect(rows).toHaveLength(item.events);
      }
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.end();
    }
  },
);
