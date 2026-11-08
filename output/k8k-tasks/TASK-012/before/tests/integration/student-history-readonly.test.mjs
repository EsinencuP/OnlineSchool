import { expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { StudentHistoryService } from '../../apps/api/dist/student/history/history.service.js';
const requireDb = createRequire(new URL('../../packages/db/package.json', import.meta.url)),
  { Client } = requireDb('pg');
const fixture = JSON.parse(
  await readFile(new URL('../evidence/stu04-readonly-projections.json', import.meta.url), 'utf8'),
);
const connectionString = process.env.STU_READONLY_DATABASE_URL,
  live = connectionString ? test : test.skip;
live(
  'actual PostgreSQL history: published/current deductions, Decimal snapshots, open cases, exact window and isolation',
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
      for (const item of fixture.cases) {
        const service = new StudentHistoryService({
          client: {
            $queryRaw: (query) =>
              db
                .query(fixture.fixtureCte + ',' + query.text.trimStart().slice(5), query.values)
                .then((result) => result.rows),
          },
        });
        const rows = await service.read(item.studentId, item.page, new Date(fixture.asOf));
        expect(
          rows
            .filter((row) => row.id !== null)
            .map((row) => ({
              id: row.id,
              status: row.attendance_status,
              deducted: row.consumption_id !== null,
              before: row.balance_before,
              after: row.balance_after,
              canDispute: row.can_dispute,
            })),
        ).toEqual(item.expected);
        expect(rows[0].total).toBe(item.total);
      }
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.end();
    }
  },
);
