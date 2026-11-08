import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { DashboardService } from '../../apps/api/dist/student/dashboard/dashboard.service.js';
import { DashboardCacheInterceptor } from '../../apps/api/dist/student/dashboard/dashboard-cache.interceptor.js';
import { serialize } from '../../apps/api/dist/modules/finance/finance-common.js';
import { Prisma } from '../../packages/db/dist/index.js';
import { meetLink } from '../../apps/api/dist/modules/schedule/meet-link.js';
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { of, lastValueFrom, throwError } = requireApi('rxjs');
const { Logger } = requireApi('@nestjs/common');
const { Reflector } = requireApi('@nestjs/core');
const student = {
  userId: randomUUID(),
  studentProfileId: randomUUID(),
  hasActiveAccess: true,
  mustChangePassword: false,
  subjectIds: [],
};
const fixed = new Date('2026-10-27T12:00:00Z');
let service, db, lesson, summary, logs;
beforeEach(() => {
  logs = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  lesson = {
    id: randomUUID(),
    scheduled_at: new Date(+fixed + 9 * 60000),
    scheduled_end_at: new Date(+fixed + 69 * 60000),
    teacher_name: 'Teacher A',
    subject_name: 'Math',
    google_meet_link: 'https://meet.google.com/abc-defg-hij',
  };
  summary = {
    remaining: 10,
    valid_to: new Date('2026-12-01Z'),
    is_frozen: false,
    frozen_until: null,
  };
  db = {
    $queryRaw: jest.fn(async (parts) => {
      const sql = parts.join('?');
      if (sql.includes('SELECT l.id')) return [lesson];
      if (sql.includes('AS "notSubmitted"'))
        return [{ notSubmitted: 1, submitted: 2, needsRevision: 3, total: 6 }];
      if (sql.includes('AS is_frozen')) return [summary];
      if (sql.includes('AS familiarizing'))
        return [{ familiarizing: 1, practicing: 2, applying: 3, notStudied: 4 }];
      if (sql.includes('student_dashboard_revisions')) return [{ revision: '1' }];
      throw Error('Unexpected SQL');
    }),
  };
  service = new DashboardService({ client: db });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
test('four blocks use the authenticated student ID and one server time; Decimal stays a string', async () => {
  jest.useFakeTimers({ now: fixed });
  const result = await service.get(student);
  expect(result.ok).toBe(true);
  expect(result.value).toMatchObject({
    nextLesson: {
      teacherName: 'Teacher A',
      canJoin: true,
      meetLink: lesson.google_meet_link,
      durationMinutes: 60,
    },
    homework: { total: 6 },
    subscription: { lessonsRemaining: 10, validUntil: '2026-12-01' },
    skillProgress: { notStudied: 4 },
    generatedAt: fixed.toISOString(),
  });
  expect(db.$queryRaw).toHaveBeenCalledTimes(4);
  for (const [, ...values] of db.$queryRaw.mock.calls) {
    expect(values).toContain(student.studentProfileId);
    expect(values.filter((v) => v instanceof Date).every((v) => +v === +fixed)).toBe(true);
  }
  // The dashboard contract has quantities, no money fields. Shared serialization must retain money precision.
  expect(serialize({ amount: new Prisma.Decimal('10'), lessonsRemaining: 10 })).toEqual({
    amount: '10',
    lessonsRemaining: 10,
  });
});
test.each([10.001, 20, 60])(
  'Meet link stays hidden at %s minutes before the lesson',
  async (minutes) => {
    jest.useFakeTimers({ now: fixed });
    lesson.scheduled_at = new Date(+fixed + minutes * 60000);
    const result = await service.get(student);
    expect(result.value.nextLesson).toMatchObject({ canJoin: false, meetLink: null });
  },
);
test.each([10, 9.99, 0.01])(
  'Meet opens at exact boundaries without minute truncation: %s',
  async (minutes) => {
    jest.useFakeTimers({ now: fixed });
    lesson.scheduled_at = new Date(+fixed + minutes * 60000);
    expect((await service.get(student)).value.nextLesson.canJoin).toBe(true);
  },
);
test.each([
  null,
  'javascript:alert(1)',
  'https://meet.google.com.evil.invalid/abc-defg-hij',
  'https://meet.google.com/abc-defg-hij?secret=1',
])('missing/unsafe links never become joinable: %s', async (url) => {
  jest.useFakeTimers({ now: fixed });
  lesson.google_meet_link = url;
  expect((await service.get(student)).value.nextLesson).toMatchObject({
    canJoin: false,
    meetLink: null,
  });
});
test('empty sources return nulls/zero counts, with no fabricated subscription or lesson', async () => {
  db.$queryRaw.mockResolvedValue([]);
  expect((await service.get(student)).value).toMatchObject({
    nextLesson: null,
    subscription: null,
    homework: { total: 0 },
    skillProgress: { notStudied: 0 },
  });
});
test('a lesson that started during aggregation is never presented as the next future lesson', async () => {
  jest.useFakeTimers({ now: new Date(+lesson.scheduled_at + 1) });
  expect((await service.get(student)).value.nextLesson).toBeNull();
});
test('frozen and unbounded subscriptions preserve their real metadata', async () => {
  jest.useFakeTimers({ now: fixed });
  summary = {
    remaining: 8,
    valid_to: null,
    is_frozen: true,
    frozen_until: new Date(+fixed + 86400000),
  };
  expect((await service.get(student)).value.subscription).toEqual({
    lessonsRemaining: 8,
    validUntil: null,
    isFrozen: true,
    frozenUntil: summary.frozen_until.toISOString(),
  });
});
test('all four sources start concurrently; controlled query latency is below 200ms and logged', async () => {
  let active = 0,
    peak = 0;
  db.$queryRaw.mockImplementation(
    () =>
      new Promise((resolve) => {
        peak = Math.max(peak, ++active);
        setTimeout(() => {
          active--;
          resolve([]);
        }, 25);
      }),
  );
  const start = performance.now();
  expect((await service.get(student)).ok).toBe(true);
  expect(peak).toBe(4);
  expect(performance.now() - start).toBeLessThan(200);
  const log = logs.mock.calls.find(([e]) => e?.event === 'student.dashboard.aggregate')[0];
  expect(log.sources).toBe(4);
  expect(log.executionTime).toBeLessThan(200);
});
test('query errors return a sanitized Result.Err and never leak driver details', async () => {
  db.$queryRaw.mockRejectedValue(Error('postgres://private password secret'));
  const result = await service.get(student);
  expect(result.ok).toBe(false);
  expect(result.error.code).toBe('DASHBOARD_UNAVAILABLE');
  expect(JSON.stringify(result)).not.toContain('private');
});
function cacheFixture() {
  const entries = new Map();
  let version = '1';
  const manager = {
    get: jest.fn(async (key) => entries.get(key)),
    set: jest.fn(async (key, value) => {
      entries.set(key, value);
    }),
    del: jest.fn(async (key) => {
      entries.delete(key);
    }),
  };
  const source = { revision: jest.fn(async () => version) };
  const interceptor = new DashboardCacheInterceptor(manager, new Reflector(), source);
  const ctx = (who) => ({ switchToHttp: () => ({ getRequest: () => ({ studentCtx: who }) }) });
  const value = {
    nextLesson: null,
    homework: { total: 1 },
    subscription: null,
    skillProgress: {},
    generatedAt: fixed.toISOString(),
  };
  const handler = { handle: jest.fn(() => of(value)) };
  return {
    manager,
    source,
    interceptor,
    ctx,
    value,
    handler,
    revision: (value) => {
      version = value;
    },
    read: async (who = student) => lastValueFrom(await interceptor.intercept(ctx(who), handler)),
  };
}
test('CacheInterceptor uses student-specific key/30s TTL and does not mutate stored values', async () => {
  jest.useFakeTimers({ now: fixed });
  const f = cacheFixture();
  const first = await f.read();
  first.homework.total = 99;
  expect((await f.read()).homework.total).toBe(1);
  expect(f.handler.handle).toHaveBeenCalledTimes(1);
  expect(f.manager.set.mock.calls[0][0]).toBe(`dashboard:${student.studentProfileId}`);
  expect(f.manager.set.mock.calls[0][2]).toBe(30000);
  await f.read({ ...student, studentProfileId: randomUUID() });
  expect(f.handler.handle).toHaveBeenCalledTimes(2);
});
test('committed homework status change invalidates the cached response using mock CacheManager', async () => {
  const f = cacheFixture();
  await f.read();
  f.revision('2');
  f.value.homework.total = 2;
  expect((await f.read()).homework.total).toBe(2);
  expect(f.manager.del).toHaveBeenCalledWith(`dashboard:${student.studentProfileId}`);
  expect(f.handler.handle).toHaveBeenCalledTimes(2);
});
test('cache expires after 30 seconds, including with a backend that ignores its TTL', async () => {
  jest.useFakeTimers({ now: fixed });
  const f = cacheFixture();
  await f.read();
  jest.setSystemTime(new Date(+fixed + 30001));
  await f.read();
  expect(f.handler.handle).toHaveBeenCalledTimes(2);
});
test('TTL stops at the join-window boundary and lesson start instead of serving stale canJoin', async () => {
  jest.useFakeTimers({ now: fixed });
  const f = cacheFixture();
  f.value.nextLesson = { scheduledAt: new Date(+fixed + 600001).toISOString() };
  await f.read();
  expect(f.manager.set.mock.calls[0][2]).toBe(1);
  jest.setSystemTime(new Date(+fixed + 1));
  await f.read();
  expect(f.handler.handle).toHaveBeenCalledTimes(2);
  jest.setSystemTime(new Date(+fixed + 600000));
  await f.read();
  expect(f.manager.set.mock.calls.at(-1)[2]).toBe(1);
});
test('in-flight requests for the same student/revision share one aggregate', async () => {
  const f = cacheFixture();
  await Promise.all([f.read(), f.read(), f.read()]);
  expect(f.handler.handle).toHaveBeenCalledTimes(1);
});
test('a source commit during load cannot be cached as a coherent snapshot', async () => {
  const f = cacheFixture();
  f.source.revision.mockResolvedValueOnce('1').mockResolvedValueOnce('2');
  await expect(f.read()).rejects.toMatchObject({
    domain: { code: 'DASHBOARD_REFRESH_REQUIRED', status: 503 },
  });
  expect(f.manager.set).not.toHaveBeenCalled();
});
test('failed responses are never cached, and a missing revision store fails closed', async () => {
  const f = cacheFixture();
  f.handler.handle.mockReturnValue(throwError(() => Error('failed')));
  await expect(f.read()).rejects.toThrow('failed');
  expect(f.manager.set).not.toHaveBeenCalled();
  f.source.revision.mockRejectedValue(Error('private SQL'));
  await expect(f.read()).rejects.toMatchObject({ domain: { code: 'DASHBOARD_UNAVAILABLE' } });
});
test.each([
  'http://meet.google.com/abc-defg-hij',
  'https://user:password@meet.google.com/abc-defg-hij',
  'https://meet.google.com.evil.invalid/abc-defg-hij',
])('CRM rejects unsafe Meet assignment %s', (value) => {
  expect(() => meetLink(value)).toThrow();
});
test('CRM stores a valid reusable Meet link and allows omission', () => {
  expect(meetLink('https://meet.google.com/abc-defg-hij')).toBe(
    'https://meet.google.com/abc-defg-hij',
  );
  expect(meetLink(undefined)).toBeNull();
});
