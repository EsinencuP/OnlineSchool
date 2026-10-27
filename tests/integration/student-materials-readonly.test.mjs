import { expect, test } from '@jest/globals';
import { createRequire } from 'node:module';
import {
  materialsProjectionSql,
  materialAccessSql,
} from '../../apps/api/dist/student/materials/materials.service.js';
import {
  asOf,
  fixtureCte,
  listCases,
  accessCases,
} from '../support/materials-readonly-fixture.mjs';
const { Client } = createRequire(new URL('../../packages/db/package.json', import.meta.url))('pg'),
  connectionString = process.env.STU_READONLY_DATABASE_URL;
(connectionString ? test : test.skip)(
  'PostgreSQL 18 materials isolation, subject, revocation/expiry, teacher grants and URL predicates',
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
      for (const item of listCases) {
        const q = materialsProjectionSql(item.student, item.query, new Date(asOf));
        const [row] = (
          await db.query(
            `${fixtureCte},projection AS (${q.text}) SELECT * FROM projection`,
            q.values,
          )
        ).rows;
        expect(row.total).toBe(item.total);
        expect(row.items.map((x) => x.fileId)).toEqual(item.ids);
        expect(JSON.stringify(row)).not.toContain('never-return-this-key');
        if (item.name.startsWith('only explicit')) {
          expect(row.items[0].subjectName).toBe('Без предмета');
          expect(row.items[0].fileName).toBe('Материал');
          expect(row.items[2].lessonTitle).toBe('Fractions');
        }
      }
      for (const item of accessCases) {
        const q = materialAccessSql(item.student, item.id, new Date(asOf));
        // A CTE has no lockable base row. Verify identical policy predicates; lock races remain separate acceptance.
        const rows = (
          await db.query(`${fixtureCte} ${q.text.replace(/ FOR SHARE OF p,o\s*$/, '')}`, q.values)
        ).rows;
        expect(rows.length === 1).toBe(item.allowed);
      }
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.end();
    }
  },
);
