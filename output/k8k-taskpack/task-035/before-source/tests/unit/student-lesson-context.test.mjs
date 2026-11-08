import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { HomeworkQueryPipe } from '../../apps/api/dist/student/homework/homework.dto.js';
import { homeworkProjectionSql } from '../../apps/api/dist/student/homework/homework.service.js';
import { MaterialsQueryPipe } from '../../apps/api/dist/student/materials/materials.dto.js';
import { materialsProjectionSql } from '../../apps/api/dist/student/materials/materials.service.js';

const student = { userId: randomUUID(), studentProfileId: randomUUID() };
const lessonId = randomUUID();
test('issued homework is filtered to the owned lesson and its enrollment before pagination', () => {
  const page = new HomeworkQueryPipe().transform({ lessonId, page: '2' });
  expect(page).toEqual({ lessonId, page: 2, pageSize: 20 });
  const sql = homeworkProjectionSql(student.studentProfileId, page, new Date());
  expect(sql.values).toContain(lessonId);
  expect(sql.values).toContain(student.studentProfileId);
  expect(sql.sql).toContain('a.lesson_occurrence_id=');
  expect(sql.sql).toContain('le.id=e.id');
  expect(sql.sql).toContain('d.cancelled_at IS NULL');
  expect(sql.sql.indexOf('a.lesson_occurrence_id=')).toBeLessThan(
    sql.sql.indexOf('FROM filtered ORDER BY'),
  );
});
test('lesson materials retain all explicit permission, verified file and owner checks', () => {
  const page = new MaterialsQueryPipe().transform({ lessonId, page: '2' });
  const sql = materialsProjectionSql(student, page, new Date());
  expect(page).toEqual({ lessonId, page: 2, pageSize: 30 });
  expect(sql.values).toEqual(
    expect.arrayContaining([student.userId, student.studentProfileId, lessonId]),
  );
  for (const predicate of [
    "p.subject_type='STUDENT'",
    'p.revoked_at IS NULL',
    "o.status='VERIFIED'",
    'p.expires_at>',
    'p.lesson_occurrence_id=',
  ])
    expect(sql.sql).toContain(predicate);
  expect(sql.sql).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/);
});
test.each([HomeworkQueryPipe, MaterialsQueryPipe])(
  'lesson resource filters validate UUID and preserve old defaults in %p',
  (Pipe) => {
    const pipe = new Pipe();
    expect(pipe.transform({})).not.toHaveProperty('lessonId');
    for (const lessonId of ['invalid', ['a', 'b'], ''])
      expect(() => pipe.transform({ lessonId })).toThrow();
    expect(() => pipe.transform({ studentId: randomUUID() })).toThrow();
  },
);
