import { expect, test } from '@jest/globals';
import { createRequire } from 'node:module';
import { studentReportsSql } from '../../apps/api/dist/student/reports/reports.sql.js';
import { educationPdfDataSql } from '../../apps/api/dist/student/reports/export-data.js';
import {
  reportAsOf,
  reportFixtureCte,
  reportSqlCases,
} from '../support/reports-readonly-fixture.mjs';
const { Client } = createRequire(new URL('../../packages/db/package.json', import.meta.url))('pg');
const connectionString = process.env.STU_READONLY_DATABASE_URL;
(connectionString ? test : test.skip)(
  'source-exact PostgreSQL report visibility, versions, privacy, attendance, dates and export isolation',
  async () => {
    const db = new Client({ connectionString });
    await db.connect();
    try {
      await db.query('BEGIN READ ONLY');
      expect((await db.query('SHOW server_version')).rows[0].server_version.startsWith('18.')).toBe(
        true,
      );
      for (const item of reportSqlCases) {
        const now = new Date(item.time ?? reportAsOf),
          q =
            item.mode === 'list'
              ? studentReportsSql(item.studentId, item.query, now)
              : educationPdfDataSql(item.studentId, item.query, now, 'Europe/Chisinau');
        const [row] = (
          await db.query(
            `${reportFixtureCte(item)},projection AS(${q.text}) SELECT * FROM projection`,
            q.values,
          )
        ).rows;
        expect(JSON.stringify(row)).not.toContain('OTHER PRIVATE');
        expect(JSON.stringify(row)).not.toContain('INTERNAL_NOT_FOR_FAMILY');
        if (item.mode === 'list') {
          expect(row.total).toBe(item.total);
          expect(row.items).toHaveLength(item.items);
          if (item.first) expect(row.items[0].reportId).toBe(item.first);
          if (item.new !== undefined) expect(row.items[0].isNew).toBe(item.new);
          for (const report of row.items) {
            expect(report.lessonCount).toBe(8);
            expect(Object.keys(report.content).sort()).toEqual(
              ['achievements', 'growthAreas', 'recommendations', 'teacherSignature'].sort(),
            );
          }
        } else {
          expect(row.forbidden).toBe(item.forbidden ?? false);
          if (item.forbidden) continue;
          expect(row.reports).toHaveLength(item.reports);
          expect(row.lessons).toHaveLength(item.lessons);
          expect(row.skills).toHaveLength(item.skills);
          if (item.lessons === 20) {
            expect(new Set(row.lessons.map((l) => l.status))).toEqual(
              new Set(['COMPLETED', 'NO_SHOW', 'CANCELLED', 'NOT_CONFIRMED', 'DISPUTED']),
            );
            expect(row.skills[0].totalSkills).toBe(2);
            expect(row.skills[0].learningGoals[0].text).toBe('Public goal');
          }
        }
      }
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.end();
    }
  },
);
