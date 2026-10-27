import { expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { DashboardService } from '../../apps/api/dist/student/dashboard/dashboard.service.js';
const requireDb = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const { Client } = requireDb('pg');
const cases = JSON.parse(
  await readFile(new URL('../evidence/stu02-readonly-projections.json', import.meta.url), 'utf8'),
);
const connectionString = process.env.STU_READONLY_DATABASE_URL;
// Supply only the existing working PostgreSQL connection. Never provisions or resets anything.
const live = connectionString ? test : test.skip;
live(
  'actual PostgreSQL 18 evaluates latest homework/skill versions and student isolation in read-only CTEs',
  async () => {
    const client = new Client({ connectionString });
    await client.connect();
    try {
      await client.query('BEGIN READ ONLY');
      expect(
        Math.floor(
          Number((await client.query('SHOW server_version_num')).rows[0].server_version_num) /
            10000,
        ),
      ).toBe(18);
      for (const item of cases) {
        let query;
        const source = new DashboardService({
          client: {
            $queryRaw: async (parts, ...values) => {
              query = parts[0];
              for (let index = 0; index < values.length; index++) {
                const value = values[index];
                query +=
                  (value instanceof Date
                    ? "'" + value.toISOString() + "'::timestamptz"
                    : "'" + String(value).replaceAll("'", "''") + "'") + parts[index + 1];
              }
              return [];
            },
          },
        });
        await source[item.projection === 'homework' ? 'homework' : 'skills'](
          '00000000-0000-4000-8000-000000000001',
          new Date(),
        );
        // The fixture artifact is restricted to SELECT/CTEs; read-only transaction is the DB backstop.
        expect(item.cte.trimStart()).toMatch(/^WITH /i);
        expect((await client.query(item.cte + query)).rows).toEqual(item.expected);
      }
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      await client.end();
    }
  },
);
