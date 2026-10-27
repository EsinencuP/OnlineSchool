import { expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { StudentLessonsService } from '../../apps/api/dist/student/lessons/lessons.service.js';
import { lessonPeriod } from '../../apps/api/dist/student/lessons/lesson-period.js';
const requireDb = createRequire(new URL('../../packages/db/package.json', import.meta.url)),
  { Client } = requireDb('pg');
const fixture = JSON.parse(
  await readFile(new URL('../evidence/stu03-readonly-projections.json', import.meta.url), 'utf8'),
);
const connectionString = process.env.STU_READONLY_DATABASE_URL,
  live = connectionString ? test : test.skip;
live(
  'PostgreSQL 18 read-only: student day, confirmed archive/status, pagination and cross-student isolation',
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
      for (const item of fixture.cases) {
        const source = new StudentLessonsService(
          {
            client: {
              $queryRaw: async (query) => {
                const sql = fixture.fixtureCte + ',' + query.text.trimStart().slice(5);
                return (await client.query(sql, query.values)).rows;
              },
            },
          },
          {},
          {},
        );
        const time = new Date(fixture.asOf),
          period = lessonPeriod(item.query, time, fixture.timeZone);
        const rows = await source.read(
          fixture.studentId,
          item.query,
          period.from,
          period.until,
          time,
        );
        expect(rows.filter((r) => r.id !== null).map((r) => r.id)).toEqual(item.ids);
        expect(rows.filter((r) => r.id !== null).map((r) => r.student_status)).toEqual(
          item.statuses,
        );
        expect(rows[0].total).toBe(item.total);
      }
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      await client.end();
    }
  },
);
