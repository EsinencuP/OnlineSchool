import { expect, test } from '@jest/globals';
import { createRequire } from 'node:module';
import { homeworkProjectionSql } from '../../apps/api/dist/student/homework/homework.service.js';
import { asOf, fixtureCte, cases, summarize } from '../support/homework-readonly-fixture.mjs';
const { Client } = createRequire(new URL('../../packages/db/package.json', import.meta.url))('pg');
const connectionString = process.env.STU_READONLY_DATABASE_URL;
(connectionString ? test : test.skip)(
  'PostgreSQL 18 read-only homework projection, status, pagination, history, attachments and isolation',
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
        const query = homeworkProjectionSql(item.studentId, item.query, new Date(asOf));
        const [row] = (
          await db.query(fixtureCte + ',' + query.text.trimStart().slice(5), query.values)
        ).rows;
        expect(summarize(row)).toEqual({
          total: item.total,
          ids: item.ids,
          statuses: item.statuses,
        });
        if (item.query.page === 1 && !item.query.status && item.total === 4) {
          expect(row.items[3].draftContent).toBeNull();
          expect(row.items[0].draftContent).toBe('current draft');
          expect(row.items[2].isLate).toBe(true);
          expect(row.items[1].versions[1].teacherComment).toBe('Keep this comment');
          expect(row.items[1].versions[0].attachments).toHaveLength(1);
          expect(row.items[1].versions[1].attachments).toHaveLength(0);
        }
      }
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.end();
    }
  },
);
