import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Prisma } from '../../packages/db/dist/index.js';
import {
  listStudentsSql,
  studentCardSql,
  escapeLike,
  projectCard,
  projectListItem,
  ManagerStudentsRead,
} from '../../apps/api/dist/modules/manager/students/students.read.js';
import { ListStudentsQueryDto } from '../../apps/api/dist/modules/manager/dto/student-crm.dto.js';
import { ManagerStudentsService } from '../../apps/api/dist/modules/manager/students/manager-students.service.js';
import { ManagerScopeService } from '../../apps/api/dist/modules/manager/scope/manager-scope.service.js';
import {
  readCursor,
  writeCursor,
} from '../../apps/api/dist/modules/manager/students/student-cursor.js';
import { rawCard, rawItem } from '../support/manager-crm-fixture.mjs';
import { studentLedgerBalanceSql } from '../../apps/api/dist/modules/finance/student-ledger-balance.sql.js';
const ctx = {
  managerId: randomUUID(),
  accountId: randomUUID(),
  sessionId: randomUUID(),
  requestId: randomUUID(),
};
const now = new Date('2026-10-31T08:00:00Z');
const previousSecret = process.env.MANAGER_CURSOR_SECRET;
beforeEach(() => {
  process.env.MANAGER_CURSOR_SECRET = 'manager-cursor-fixture-secret-32-bytes-at-least';
});
afterEach(() => {
  if (previousSecret === undefined) delete process.env.MANAGER_CURSOR_SECRET;
  else process.env.MANAGER_CURSOR_SECRET = previousSecret;
});
test('all list filters compose with the canonical live portfolio, literal wildcard search stays bound', () => {
  const scope = new ManagerScopeService({}),
    q = Object.assign(new ListStudentsQueryDto(), {
      search: "a%_\\' OR true--",
      status: 'ACTIVE',
      hasOverdueTask: true,
      subscriptionExpiringSoon: false,
      sort: 'nextLesson',
      limit: 100,
    });
  const sql = listStudentsSql(scope.portfolioSql(ctx, now), q, { now });
  expect(sql.values).toContain(ctx.managerId);
  expect(sql.values).toContain('ACTIVE');
  expect(sql.values).toContain(true);
  expect(sql.values).toContain(false);
  expect(sql.values).toContain('%' + escapeLike(q.search.toLowerCase()) + '%');
  expect(sql.values).toContain(101);
  expect(sql.text).not.toContain(q.search);
  expect(sql.text).toMatch(/am\.student_id=st\.id/);
  expect(sql.text).toContain('am.ended_at>');
  expect(sql.text).toContain('AND f.status=');
  expect(sql.text).toContain('f.overdue_count>0');
  expect(sql.text).toContain('ORDER BY f.next_lesson_at ASC NULLS LAST,f.id');
});
test.each(['name', 'nextLesson', 'subscriptionEnd'])(
  'keyset sort %s has stable UUID ties and NULLS LAST',
  (sort) => {
    const q = Object.assign(new ListStudentsQueryDto(), { sort });
    const sql = listStudentsSql(Prisma.sql`true`, q, { now, studentId: randomUUID() });
    expect(sql.text).toContain('f.id>p.id');
    expect(sql.text).toContain('IS NOT DISTINCT FROM');
    expect(sql.text).toContain('NULLS LAST,f.id');
    expect(sql.text).not.toMatch(/OFFSET/i);
  },
);
test('cursor is encrypted, short, authenticated and bound to filters and manager', () => {
  const q = Object.assign(new ListStudentsQueryDto(), { search: 'name', sort: 'name' }),
    id = randomUUID(),
    time = new Date();
  const encoded = writeCursor(ctx, q, id, time);
  expect(encoded.ok).toBe(true);
  expect(encoded.value.length).toBeLessThanOrEqual(200);
  expect(Buffer.from(encoded.value, 'base64url').toString()).not.toContain(id);
  expect(readCursor(ctx, { ...q, cursor: encoded.value }).value).toEqual({
    studentId: id,
    now: time,
  });
  for (const [actor, query] of [
    [
      { ...ctx, managerId: randomUUID() },
      { ...q, cursor: encoded.value },
    ],
    [ctx, { ...q, search: 'changed', cursor: encoded.value }],
    [ctx, { ...q, cursor: encoded.value.slice(0, -5) + 'abcde' }],
  ])
    expect(readCursor(actor, query)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_CURSOR', status: 422 },
    });
});
test('expired cursor is rejected and changing page size preserves a valid cursor', () => {
  const q = new ListStudentsQueryDto(),
    id = randomUUID();
  const expired = writeCursor(ctx, q, id, new Date(Date.now() - 31 * 60000));
  expect(readCursor(ctx, { ...q, cursor: expired.value }).error.code).toBe('INVALID_CURSOR');
  const token = writeCursor(ctx, q, id, new Date());
  expect(readCursor(ctx, { ...q, limit: 100, cursor: token.value }).ok).toBe(true);
});
test('duplicate-name pages use last UUID as cursor and do not duplicate rows', async () => {
  const ids = [randomUUID(), randomUUID(), randomUUID()].sort(),
    rows = ids.map((id) => rawItem({ id, full_name: 'Same Name', phone: null }));
  const reader = {
    list: jest.fn(async (_ctx, _q, cursor) => ({
      ok: true,
      value: [
        {
          cursor_valid: true,
          items: cursor.studentId ? rows.slice(ids.indexOf(cursor.studentId) + 1) : rows,
        },
      ],
    })),
  };
  const service = new ManagerStudentsService({}, reader, {}, {}),
    q = Object.assign(new ListStudentsQueryDto(), { limit: 2 });
  const first = await service.list(ctx, q);
  expect(first.value.items.map((i) => i.studentId)).toEqual(ids.slice(0, 2));
  const second = await service.list(ctx, { ...q, cursor: first.value.nextCursor });
  expect(second.value.items.map((i) => i.studentId)).toEqual(ids.slice(2));
  expect(second.value.nextCursor).toBeNull();
  expect(reader.list.mock.calls[1][2].studentId).toBe(ids[1]);
});
test.each([1, 25, 100])(
  'list query budget is one business query at page size %i',
  async (limit) => {
    const client = { $queryRaw: jest.fn(async () => [{ cursor_valid: true, items: [] }]) },
      scope = new ManagerScopeService({ client });
    const reader = new ManagerStudentsRead({ client }, scope),
      q = Object.assign(new ListStudentsQueryDto(), { limit });
    const result = await reader.list(ctx, q, { now });
    expect(result.ok).toBe(true);
    expect(client.$queryRaw).toHaveBeenCalledTimes(1);
  },
);
test('cursor data time never pins stale portfolio authorization', async () => {
  const client = { $queryRaw: jest.fn(async () => [{ cursor_valid: true, items: [] }]) },
    scope = new ManagerScopeService({ client });
  const spy = jest.spyOn(scope, 'portfolioSql'),
    reader = new ManagerStudentsRead({ client }, scope);
  await reader.list(ctx, new ListStudentsQueryDto(), { now: new Date(0) });
  expect(spy.mock.calls[0][1].getTime()).toBeGreaterThan(Date.now() - 5000);
});
test('card query selects only aggregates, scopes every source and limits collections', () => {
  const sql = studentCardSql(new ManagerScopeService({}).portfolioSql(ctx, now), randomUUID(), now);
  expect(sql.text).toContain('LIMIT 5');
  expect(sql.text).toContain('LIMIT 10');
  expect(sql.text).toContain('LIMIT 101');
  expect(sql.text).not.toMatch(
    /\br\.content\b|\ba\.content\b|public_comment|teacher_summary|sa\.basis|SELECT\s+(?:sk|sa|r|hs)\.\*/i,
  );
  expect(sql.text).toContain('hs.student_id=f.id');
  expect(sql.text).toContain('r.confirmed_by_director_at');
  expect(sql.text).toContain('current_posted');
});
test('allowlist removes educational details and extra PII; every monetary value is an exact string', () => {
  const row = rawCard({
    id: randomUUID(),
    full_name: 'Own student',
    phone: 'private',
    email: null,
    manager_note: null,
    version: 1,
  });
  row.reportContent = 'DO NOT EXPOSE';
  row.learning.grade = 10;
  row.learning.teacherComment = 'DO NOT EXPOSE';
  row.learning.content = { secret: true };
  row.balance = '1234567890123456.1234';
  row.subscription = {
    id: randomUUID(),
    endsAt: null,
    remainingLessons: 4,
    currency: 'USD',
    teacherComment: 'DO NOT EXPOSE',
  };
  row.recentPayments = [
    {
      id: randomUUID(),
      amount: '0.0001',
      currency: 'USD',
      registeredAt: now.toISOString(),
      confirmedAt: null,
      studentName: 'DO NOT EXPOSE',
    },
  ];
  const projected = projectCard(row);
  expect(JSON.stringify(projected)).not.toContain('DO NOT EXPOSE');
  expect(projected.balance).toBe('1234567890123456.1234');
  expect(projected.recentPayments[0].amount).toBe('0.0001');
  expect(typeof projected.balance).toBe('string');
  const list = projectListItem({
    ...rawItem({ id: row.studentId, full_name: 'Own', phone: null }),
    balance: '1.2345',
    phone: 'DO NOT EXPOSE',
    email: 'DO NOT EXPOSE',
  });
  expect(list.balance).toBe('1.2345');
  expect(JSON.stringify(list)).not.toContain('DO NOT EXPOSE');
});
test('read errors become generic Results and malformed database projections cannot throw', async () => {
  const scope = new ManagerScopeService({}),
    client = {
      $queryRaw: jest.fn(async () => {
        throw Error('private data');
      }),
    };
  const reader = new ManagerStudentsRead({ client }, scope);
  expect((await reader.list(ctx, new ListStudentsQueryDto(), { now })).error.code).toBe(
    'DATABASE_ERROR',
  );
  client.$queryRaw.mockResolvedValue([{ card: { invalid: true } }]);
  expect((await reader.card(ctx, randomUUID(), client)).error.code).toBe('DATABASE_ERROR');
});
test('the reviewed raw read boundary rejects data-modifying CTEs before touching storage', async () => {
  const client = { $queryRaw: jest.fn() },
    reader = new ManagerStudentsRead({ client }, new ManagerScopeService({ client }));
  const result = await reader.read(
    Prisma.sql`WITH changed AS (DELETE FROM students RETURNING id) SELECT id FROM changed`,
  );
  expect(result).toMatchObject({ ok: false, error: { code: 'READ_QUERY_REJECTED' } });
  expect(client.$queryRaw).not.toHaveBeenCalled();
});
test('forward migration preserves existing records, versions every CRM writer and grants no money/education writes', async () => {
  const sql = await readFile(
    'packages/db/prisma/migrations/20261031100000_mgr02_student_crm/migration.sql',
    'utf8',
  );
  expect(sql).toMatch(/version integer NOT NULL DEFAULT 1/);
  expect(sql).toContain('NEW.version:=OLD.version+1');
  expect(sql).not.toMatch(/DROP\s+TABLE|TRUNCATE|DELETE FROM|UPDATE students SET/i);
  expect(sql).not.toMatch(
    /GRANT\s+(?:INSERT|UPDATE|DELETE)[^;]+(?:ledger_entries|skill_entries|homework_assignments|education_reports)/i,
  );
  expect(sql).toContain("IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_trgm')");
});
test('monetary ledger uses published credit-minus-debit and attributes transfers without double counting', () => {
  const sql = studentLedgerBalanceSql(Prisma.sql`st.id`, now).text;
  expect(sql).not.toContain("l.account_type='UNALLOCATED_FUNDS'");
  expect(sql).toContain("l.account_type='CUSTOMER_ADVANCE'");
  expect(sql).toContain('e.published_at<=');
  expect(sql).toContain('e.effective_at<=');
  expect(sql).toContain("sum(CASE WHEN direction='CREDIT' THEN amount ELSE -amount END)");
  expect(sql).toContain('GROUP BY currency');
  expect(sql).not.toMatch(/greatest|full_price|remaining|lesson_count/i);
  expect(sql).toContain('d.correction_of_document_id=p.id');
  expect(sql).not.toContain('reverses_entry_id IS NULL');
  expect(sql).toContain('p.confirmed_by_director_at<=');
  expect(sql).toContain('pd.payment_id=d.payment_id');
  expect(sql).toContain('d.approved_at<=');
  expect(sql).not.toContain('owned_receipts');
  expect(sql).toContain('d.subscription_id IN(SELECT id FROM owned_subscriptions)');
});
test('signed balance and per-currency values survive projection; pending payments remain separate', () => {
  const distributionId = randomUUID(),
    paymentId = randomUUID();
  const row = rawCard({
    id: randomUUID(),
    full_name: 'Own',
    phone: null,
    email: null,
    manager_note: null,
    version: 1,
    ledgerBalance: '-17.1234',
    ledgerBalances: [
      { currency: 'MDL', amount: '-17.1234' },
      { currency: 'USD', amount: '100.0001' },
    ],
    payments: [
      {
        id: distributionId,
        distributionId,
        paymentId,
        amount: '9999.9999',
        currency: 'MDL',
        status: 'AWAITING_APPROVAL',
        registeredAt: now.toISOString(),
        confirmedAt: null,
      },
    ],
  });
  const card = projectCard(row);
  expect(card.balance).toBe('-17.1234');
  expect(card.balances).toEqual([
    { currency: 'MDL', amount: '-17.1234' },
    { currency: 'USD', amount: '100.0001' },
  ]);
  expect(card.recentPayments[0]).toMatchObject({
    id: distributionId,
    distributionId,
    paymentId,
    status: 'AWAITING_APPROVAL',
    amount: '9999.9999',
  });
  expect(card.balanceCurrency).toBe('MDL');
});

test('card history exposes only own allocated amounts with independently scoped receipt contacts', () => {
  const scope = new ManagerScopeService({}).portfolioSql(ctx, now);
  const query = studentCardSql(scope, randomUUID(), now).text;
  expect(query).toContain("'distributionId',d.id,'paymentId',p.id,'amount',d.amount::text");
  expect(query).not.toContain("'amount',p.amount");
  expect(query).toContain(
    'WHERE e.student_id=f.id AND EXISTS(SELECT 1 FROM students st WHERE st.id=p.student_id',
  );
  expect(query).toContain('assigned_managers');
});
