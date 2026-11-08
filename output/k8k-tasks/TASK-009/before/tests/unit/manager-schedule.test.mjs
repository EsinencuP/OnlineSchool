import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { Prisma } from '../../packages/db/dist/index.js';
import {
  interval,
  scheduleFailure,
  schedulePolicy,
} from '../../apps/api/dist/modules/schedule/manager/policy.js';
import { redactMeet } from '../../apps/api/dist/modules/schedule/meet-link.js';
import { UnavailableMeetLink } from '../../apps/api/dist/modules/schedule/manager/meet-link.port.js';
import { ManagerScopeService } from '../../apps/api/dist/modules/manager/scope/manager-scope.service.js';
import { ESLint } from 'eslint';

test('owner defaults are60-minute lead and24-hour timely boundary; malformed settings fail closed', () => {
  const keys = ['LESSON_MIN_LEAD_MINUTES', 'LESSON_FREE_CHANGE_HOURS'],
    prior = keys.map((k) => process.env[k]);
  try {
    for (const k of keys) delete process.env[k];
    expect(schedulePolicy().value).toEqual({ leadMinutes: 60, freeHours: 24 });
    for (const value of ['-1', 'NaN', '1.5', '10081']) {
      process.env.LESSON_MIN_LEAD_MINUTES = value;
      expect(schedulePolicy().error.code).toBe('INVALID_SCHEDULE_CONFIGURATION');
    }
    process.env.LESSON_MIN_LEAD_MINUTES = '120';
    process.env.LESSON_FREE_CHANGE_HOURS = '48';
    expect(schedulePolicy().value).toEqual({ leadMinutes: 120, freeHours: 48 });
  } finally {
    keys.forEach((k, i) =>
      prior[i] === undefined ? delete process.env[k] : (process.env[k] = prior[i]),
    );
  }
});
test.each([
  ['2026-10-25T02:30:00+03:00', '2026-10-25T02:30:00+02:00', 60],
  ['2027-03-28T02:30:00+02:00', '2027-03-28T04:30:00+03:00', 60],
])('explicit offsets across DST %s→%s preserve elapsed UTC time', (from, to, minutes) => {
  const range = interval(from, to);
  expect(range.ok).toBe(true);
  expect(+range.value.to - +range.value.from).toBe(minutes * 60000);
});
test.each([
  ['2026-11-01', '2026-11-02'],
  ['2026-11-02T00:00:00Z', '2026-11-01T00:00:00Z'],
  ['invalid', '2026-11-01T00:00:00Z'],
])('invalid range %s→%s is rejected', (a, b) =>
  expect(interval(a, b).error.code).toBe('INVALID_RANGE'),
);
test.each([{ code: '23P01' }, { driverAdapterError: { cause: { originalCode: '23P01' } } }])(
  'PostgreSQL exclusion adapter shape %p maps to a safe domain conflict',
  (meta) => {
    const error = new Prisma.PrismaClientKnownRequestError('foreign portfolio data', {
      code: 'P2010',
      clientVersion: '7.10.1',
      meta,
    });
    expect(scheduleFailure(error)).toMatchObject({ code: 'SLOT_CONFLICT', status: 409 });
    expect(scheduleFailure(error).details).toBeUndefined();
  },
);
test('serialization failure keeps retryability through both Schedule and portfolio data access', async () => {
  const error = new Prisma.PrismaClientKnownRequestError('serialization', {
    code: 'P2034',
    clientVersion: '7.10.1',
  });
  expect(scheduleFailure(error).retryable).toBe(true);
  const scope = new ManagerScopeService({
    client: {
      student: {
        findFirst: jest.fn(async () => {
          throw error;
        }),
      },
    },
  });
  expect(
    (
      await scope.assertStudentInPortfolio(
        { managerId: 'm' },
        '00000000-0000-4000-8000-000000000001',
      )
    ).error.retryable,
  ).toBe(true);
});
test('Meet masking covers nested calendar snapshots and reasons', () => {
  const url = 'https://meet.google.com/abc-defg-hij';
  expect(redactMeet({ link: url, changes: [{ reason: `replace ${url}` }] })).toEqual({
    link: 'https://meet.google.com/***',
    changes: [{ reason: 'replace https://meet.google.com/***' }],
  });
  expect(redactMeet('https://MEET.GOOGLE.COM/abc-defg-hij')).toBe('https://meet.google.com/***');
});
test('Meet port feature flag never invents a working conference', async () => {
  const prior = process.env.MEET_AUTO_GENERATION_ENABLED;
  try {
    delete process.env.MEET_AUTO_GENERATION_ENABLED;
    expect((await new UnavailableMeetLink().generate({ id: 'l' })).error.code).toBe(
      'MEET_GENERATION_DISABLED',
    );
    process.env.MEET_AUTO_GENERATION_ENABLED = 'true';
    expect((await new UnavailableMeetLink().generate({ id: 'l' })).error.code).toBe(
      'MEET_ADAPTER_NOT_CONFIGURED',
    );
  } finally {
    if (prior === undefined) delete process.env.MEET_AUTO_GENERATION_ENABLED;
    else process.env.MEET_AUTO_GENERATION_ENABLED = prior;
  }
});
test('manager workflow delegates all calendar mutations to canonical BookingService', async () => {
  const source = await readFile(
    'apps/api/src/modules/schedule/manager/workflow.service.ts',
    'utf8',
  );
  for (const method of ['one', 'reschedule', 'cancel'])
    expect(source).toContain(`this.booking.${method}(`);
  expect(source).not.toContain('lessonOccurrence.create(');
  expect(source).not.toContain('lessonActualOutcome.create(');
});
test('migration preserves lesson IDs and EXCLUDE while requiring immutable specific director decisions', async () => {
  const sql = await readFile(
    'packages/db/prisma/migrations/20261031140000_mgr06_schedule/migration.sql',
    'utf8',
  );
  expect(sql).toContain('reschedule_history_verified boolean NOT NULL DEFAULT false');
  expect(sql).toContain('public.t03_assert_director');
  expect(sql).toContain('uq_mgr06_change_request');
  expect(sql).not.toMatch(/DROP CONSTRAINT|UPDATE lesson_occurrences SET id|DELETE FROM|TRUNCATE/);
  const foundation = await readFile(
    'packages/db/prisma/migrations/20261026020000_init/migration.sql',
    'utf8',
  );
  expect(foundation).toContain('EXCLUDE USING gist');
  expect(foundation).toContain("NEW.basis='APPROVED_CANCELLATION'");
});
test('manager services cannot import the new Finance rights writer outside the canonical facade', async () => {
  const eslint = new ESLint();
  const [{ messages }] = await eslint.lintText(
    "import { ManagerLessonRights } from '../../finance/manager-payments/lesson-rights.service.js';",
    { filePath: 'apps/api/src/modules/manager/schedule/probe.ts' },
  );
  expect(messages.some((m) => m.ruleId === 'manager/finance-facade-only')).toBe(true);
});
