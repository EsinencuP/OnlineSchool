import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { StudentSkillsService } from '../../apps/api/dist/student/skills/skills.service.js';
import {
  SkillMapQueryPipe,
  SkillAuditQueryPipe,
  skillStatuses,
} from '../../apps/api/dist/student/skills/skills.dto.js';
const student = { studentProfileId: randomUUID() },
  id = randomUUID();
let db, service;
beforeEach(() => {
  db = { $queryRaw: jest.fn(async () => [{ forbidden: false, data: [] }]) };
  service = new StudentSkillsService({ client: db });
});
test('map selection accepts omitted subject and normalizes UUID', () => {
  expect(new SkillMapQueryPipe().transform({})).toEqual({});
  expect(new SkillMapQueryPipe().transform({ subjectId: id.toUpperCase() })).toEqual({
    subjectId: id,
  });
});
test.each([
  { subjectId: 'bad' },
  { subjectId: [id] },
  { studentProfileId: id },
  { page: '1' },
  { subjectId: { id } },
])('rejects map query %j', (input) => {
  expect(() => new SkillMapQueryPipe().transform(input)).toThrow();
});
test('audit requires skill, has bounded paging and explicit four-state contract', () => {
  expect(new SkillAuditQueryPipe().transform({ skillId: id })).toEqual({
    skillId: id,
    page: 1,
    pageSize: 20,
  });
  expect(skillStatuses).toEqual(['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING']);
});
test.each([
  {},
  { skillId: 'bad' },
  { skillId: id, page: '0' },
  { skillId: id, pageSize: '101' },
  { skillId: id, page: '1e2' },
  { skillId: id, studentId: id },
])('rejects audit query %j', (input) => {
  expect(() => new SkillAuditQueryPipe().transform(input)).toThrow();
});
test('map exposes normalized timestamps and keeps date-only goals', async () => {
  db.$queryRaw.mockResolvedValue([
    {
      forbidden: false,
      data: [
        {
          subjectId: id,
          lastSnapshotAt: '2026-10-27T12:00:00+03:00',
          skills: [{ lastUpdatedAt: '2026-10-27T12:00:00+03:00' }],
          learningGoals: [{ targetDate: '2026-11-01' }],
        },
      ],
    },
  ]);
  const [map] = await service.maps(student, {});
  expect(map.lastSnapshotAt).toBe('2026-10-27T09:00:00.000Z');
  expect(map.skills[0].lastUpdatedAt).toBe(map.lastSnapshotAt);
  expect(map.learningGoals[0].targetDate).toBe('2026-11-01');
  expect(db.$queryRaw.mock.calls[0][0].values).toContain(student.studentProfileId);
});
test.each(['maps', 'audit', 'snapshots'])(
  '%s fails closed on absent database row',
  async (method) => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(
      service[method](student, { skillId: id, page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ domain: { code: 'SKILLS_UNAVAILABLE', status: 503 } });
  },
);
test.each(['maps', 'audit'])(
  '%s does not disclose nonexistent versus foreign resource',
  async (method) => {
    db.$queryRaw.mockResolvedValue([{ forbidden: true, data: null }]);
    await expect(
      service[method](student, { skillId: id, subjectId: id, page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ domain: { code: 'SKILLS_FORBIDDEN', status: 403 } });
  },
);
test.each([
  ['audit', 'changedAt'],
  ['snapshots', 'createdAt'],
])(
  '%s serializes dates, preserves immutable content and empty-page total',
  async (method, field) => {
    db.$queryRaw.mockResolvedValue([
      {
        forbidden: false,
        data: {
          items: [{ [field]: '2026-10-27T12:00:00+03:00', skills: [{ status: 'FAMILIARIZING' }] }],
          total: 12,
        },
      },
    ]);
    const result = await service[method](student, { skillId: id, page: 2, pageSize: 1 });
    expect(result).toMatchObject({ total: 12, page: 2, pageSize: 1 });
    expect(result.items[0][field]).toBe('2026-10-27T09:00:00.000Z');
    expect(result.items[0].skills[0].status).toBe('FAMILIARIZING');
    db.$queryRaw.mockResolvedValue([{ forbidden: false, data: { items: [], total: 12 } }]);
    expect(await service[method](student, { skillId: id, page: 99, pageSize: 1 })).toMatchObject({
      total: 12,
      items: [],
    });
  },
);
