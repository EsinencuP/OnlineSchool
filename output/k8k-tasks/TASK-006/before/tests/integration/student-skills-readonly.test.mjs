import { expect, test } from '@jest/globals';
import { createRequire } from 'node:module';
import {
  skillMapSql,
  skillAuditSql,
  skillSnapshotsSql,
} from '../../apps/api/dist/student/skills/skills.sql.js';
import { asOf, fixtureCte, cases, skill } from '../support/skills-readonly-fixture.mjs';
const queries = { maps: skillMapSql, audit: skillAuditSql, snapshots: skillSnapshotsSql };
const { Client } = createRequire(new URL('../../packages/db/package.json', import.meta.url))('pg');
const connectionString = process.env.STU_READONLY_DATABASE_URL;
(connectionString ? test : test.skip)(
  'PostgreSQL source-exact skill maps, counter, ownership, audit, pagination and immutable snapshots',
  async () => {
    const db = new Client({ connectionString });
    await db.connect();
    try {
      await db.query('BEGIN READ ONLY');
      const version = (await db.query('SHOW server_version')).rows[0].server_version;
      expect(version.startsWith('18.')).toBe(true);
      const evidence = [];
      for (const item of cases) {
        const q = queries[item.mode](item.studentId, item.query, new Date(asOf));
        const [row] = (
          await db.query(
            `${fixtureCte(item.count)},projection AS(${q.text}) SELECT * FROM projection`,
            q.values,
          )
        ).rows;
        expect(row.forbidden).toBe(item.forbidden ?? false);
        if (!item.forbidden) {
          expect(JSON.stringify(row.data)).not.toContain('OTHER CHILD');
          if (item.mode === 'maps') {
            if (item.subjects !== undefined) expect(row.data).toHaveLength(item.subjects);
            if (item.expectedNext !== undefined) {
              const map = row.data[0];
              expect(map.nextSnapshotIn).toBe(item.expectedNext);
              expect(map.totalSkills).toBe(3);
              expect(map.skills.find((s) => s.name === 'Decimals')).toMatchObject({
                status: 'NOT_STUDIED',
                lastUpdatedByTeacherName: '',
              });
              expect(map.skills.find((s) => s.skillId === skill).status).toBe('PRACTICING');
              expect(
                map.skills.every((s) =>
                  ['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING'].includes(s.status),
                ),
              ).toBe(true);
              expect(map.learningGoals).toHaveLength(2);
              expect(map.learningGoals[0]).toMatchObject({
                targetDate: '2026-11-01',
                isAchieved: true,
              });
              expect(JSON.stringify(map)).not.toMatch(/rating|badge|basis/);
            }
          } else {
            expect(row.data.total).toBe(item.total);
            expect(row.data.items).toHaveLength(item.items);
            if (item.from) expect(row.data.items[0].fromStatus).toBe(item.from);
            if (item.lesson) expect(row.data.items[0].lessonNumber).toBe(item.lesson);
            if (item.lesson === 4)
              expect(row.data.items[0].skills[0]).toMatchObject({
                skillName: 'Old skill title',
                status: 'FAMILIARIZING',
              });
            if (item.mode === 'audit')
              expect(JSON.stringify(row.data)).not.toContain('Unconfirmed evidence');
          }
        }
        evidence.push({ name: item.name, passed: true });
      }
      if (process.env.STU08_EVIDENCE_PATH) {
        const { writeFile } = await import('node:fs/promises');
        await writeFile(
          process.env.STU08_EVIDENCE_PATH,
          JSON.stringify(
            {
              version,
              role: (await db.query('SELECT current_user AS role')).rows[0].role,
              mode: 'BEGIN READ ONLY; CTE fixtures only; no persistent data or DDL',
              cases: evidence,
            },
            null,
            2,
          ) + '\n',
        );
      }
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.end();
    }
  },
);
