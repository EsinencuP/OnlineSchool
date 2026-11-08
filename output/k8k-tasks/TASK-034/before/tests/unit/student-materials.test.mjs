import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import {
  StudentMaterialsService,
  materialsProjectionSql,
  materialAccessSql,
} from '../../apps/api/dist/student/materials/materials.service.js';
import { MaterialsQueryPipe } from '../../apps/api/dist/student/materials/materials.dto.js';
import { PrivateUploads } from '../../apps/api/dist/modules/storage/private-uploads.service.js';
import { TransactionService } from '../../apps/api/dist/core/transaction/transaction.service.js';
const student = {
  userId: randomUUID(),
  studentProfileId: randomUUID(),
  hasActiveAccess: true,
  mustChangePassword: false,
  subjectIds: [],
};
const id = randomUUID(),
  now = new Date('2026-10-27T12:00:00.750Z'),
  actor = { accountId: student.userId, kind: 'STUDENT', roles: ['STUDENT'] };
let service, db, storage, sessions, me, audit, permission, logs;
const code = async (promise, value) =>
  expect(promise).rejects.toMatchObject({ domain: { code: value } });
beforeEach(() => {
  permission = {
    permission_id: randomUUID(),
    file_id: id,
    bucket: 'online-school-files',
    key: 'private/hidden-key',
    file_name: 'Материал.pdf',
    can_download: false,
    expires_at: null,
  };
  logs = [];
  db = {
    $queryRaw: jest.fn(async (first) => {
      const sql = Array.isArray(first) ? first.join('?') : first.sql;
      return sql.includes('clock_timestamp() AS now') ? [{ now }] : permission ? [permission] : [];
    }),
    fileAuditLog: {
      create: jest.fn(async ({ data }) => {
        logs.push(data);
        return data;
      }),
    },
  };
  db.$transaction = jest.fn(async (fn) => {
    const before = structuredClone(logs);
    try {
      return await fn(db);
    } catch (error) {
      logs = before;
      throw error;
    }
  });
  storage = {
    signRead: jest.fn(async () => 'https://storage.example.invalid/temporary-capability'),
  };
  sessions = { resolve: jest.fn(async () => ({ ok: true, value: actor })) };
  me = { load: jest.fn(async () => ({ ok: true, value: { context: student } })) };
  audit = { denial: jest.fn(async () => ({ ok: true, value: undefined })) };
  service = new StudentMaterialsService(
    { client: db },
    new TransactionService({ client: db }),
    sessions,
    me,
    storage,
    audit,
  );
});
afterEach(() => jest.restoreAllMocks());
test('pagination defaults 1/30, subject UUID canonicalization and 100 item bound', () => {
  const pipe = new MaterialsQueryPipe();
  expect(pipe.transform({})).toEqual({ page: 1, pageSize: 30 });
  expect(pipe.transform({ subjectId: id.toUpperCase(), page: '2', pageSize: '100' })).toEqual({
    subjectId: id,
    page: 2,
    pageSize: 100,
  });
});
test.each([
  { page: '0' },
  { page: '1.2' },
  { pageSize: '101' },
  { pageSize: '0' },
  { pageSize: null },
  { subjectId: 'bad' },
  { subjectId: [id] },
  { studentProfileId: randomUUID() },
  { page: '999999999999999999999' },
])('rejects invalid query %j', (input) =>
  expect(() => new MaterialsQueryPipe().transform(input)).toThrow(),
);
test('list query scopes both account and registry student, explicit teacher grants, real context and current verified objects', () => {
  const sql = materialsProjectionSql(student, { page: 2, pageSize: 30, subjectId: id }, now);
  expect(sql.values).toContain(student.userId);
  expect(sql.values).toContain(student.studentProfileId);
  expect(sql.values).toContain(id);
  expect(sql.sql).toContain('p.revoked_at IS NULL');
  expect(sql.sql).toContain("o.status='VERIFIED'");
  expect(sql.sql).toContain('JOIN teacher_accounts');
  expect(sql.sql).toContain('p.granted_at<=');
  expect(sql.sql).toContain('p.expires_at>');
  expect(sql.sql).toContain('p.educational_subject_id=');
  expect(sql.sql).not.toMatch(/o\.key|o\.bucket|url|s3Key/);
  expect(sql.values.filter((v) => typeof v === 'number')).toEqual([30, 30]);
});
test('URL query applies the same policy and locks permission + object against revocation/quarantine', () => {
  const sql = materialAccessSql(student, id, now);
  expect(sql.sql).toContain('FOR SHARE OF p,o');
  expect(sql.sql).toContain('p.revoked_at IS NULL');
  expect(sql.values).toContain(student.studentProfileId);
  expect(sql.values).toContain(id);
});
test('READ permission issues 900-second inline URL and audits VIEW without storing capability', async () => {
  const result = await service.signedUrl(student, id, 'session', actor, randomUUID());
  expect(Object.keys(result).sort()).toEqual(['expiresAt', 'fileName', 'url']);
  expect(result.fileName).toBe('Материал.pdf');
  expect(result.expiresAt).toBe('2026-10-27T12:15:00.000Z');
  expect(storage.signRead.mock.calls[0][0]).toMatchObject({ expiresIn: 900, canDownload: false });
  expect(logs[0]).toMatchObject({
    action: 'VIEW',
    s3_object_id: id,
    permission_id: permission.permission_id,
    actor_id: student.userId,
    result: 'SUCCESS',
  });
  expect(JSON.stringify(logs)).not.toContain(result.url);
  expect(JSON.stringify(logs)).not.toContain(permission.key);
  expect(sessions.resolve).toHaveBeenCalledWith('session', db);
  expect(me.load).toHaveBeenCalledWith(student.userId, db);
});
test('download-enabled grant selects attachment presentation and DOWNLOAD audit', async () => {
  permission.can_download = true;
  await service.signedUrl(student, id, 'session', actor, randomUUID());
  expect(logs[0].action).toBe('DOWNLOAD');
  expect(storage.signRead.mock.calls[0][0].canDownload).toBe(true);
});
test('URL lifetime is capped by the explicit permission expiry', async () => {
  permission.expires_at = new Date('2026-10-27T12:03:00.400Z');
  const result = await service.signedUrl(student, id, 'session', actor, randomUUID());
  expect(result.expiresAt).toBe('2026-10-27T12:03:00.000Z');
  expect(storage.signRead.mock.calls[0][0].expiresIn).toBe(180);
  expect(+new Date(result.expiresAt)).toBeLessThan(+permission.expires_at);
});
test('grant too close to expiry is denied without signing', async () => {
  permission.expires_at = new Date('2026-10-27T12:00:00.900Z');
  await code(service.signedUrl(student, id, 'session', actor, randomUUID()), 'FILE_ACCESS_DENIED');
  expect(storage.signRead).not.toHaveBeenCalled();
});
test('missing/revoked/foreign grant is uniformly 403 and records a denial', async () => {
  permission = null;
  await code(service.signedUrl(student, id, 'session', actor, randomUUID()), 'FILE_ACCESS_DENIED');
  expect(storage.signRead).not.toHaveBeenCalled();
  expect(logs).toHaveLength(0);
  expect(audit.denial.mock.calls[0][0]).toMatchObject({
    code: 'FILE_ACCESS_DENIED',
    resourceId: id,
  });
});
test.each([{ kind: 'TEACHER', roles: ['TEACHER'] }, { accountId: randomUUID() }, { roles: [] }])(
  'session is revalidated inside issuance transaction: %j',
  async (change) => {
    sessions.resolve.mockResolvedValue({ ok: true, value: { ...actor, ...change } });
    await code(service.signedUrl(student, id, 'session', actor, randomUUID()), 'FORBIDDEN');
    expect(storage.signRead).not.toHaveBeenCalled();
  },
);
test.each([
  { mustChangePassword: true, expected: 'MUST_CHANGE_PASSWORD' },
  { hasActiveAccess: false, expected: 'ACCESS_SUSPENDED' },
  { studentProfileId: randomUUID(), expected: 'FILE_ACCESS_DENIED' },
])('current student activation is revalidated: %j', async ({ expected, ...change }) => {
  me.load.mockResolvedValue({ ok: true, value: { context: { ...student, ...change } } });
  await code(service.signedUrl(student, id, 'session', actor, randomUUID()), expected);
  expect(storage.signRead).not.toHaveBeenCalled();
});
test('revoked session does not issue a new capability', async () => {
  sessions.resolve.mockResolvedValue({
    ok: false,
    error: { code: 'UNAUTHENTICATED', status: 401, message: 'session expired' },
  });
  await code(service.signedUrl(student, id, 'session', actor, randomUUID()), 'UNAUTHENTICATED');
  expect(storage.signRead).not.toHaveBeenCalled();
});
test('audit failure rolls back and no URL response escapes', async () => {
  db.fileAuditLog.create.mockImplementation(async () => {
    throw Error('private driver data');
  });
  await code(service.signedUrl(student, id, 'session', actor, randomUUID()), 'DATABASE_ERROR');
  expect(logs).toHaveLength(0);
});
test('reused client request ID correlates two events without becoming their identity', async () => {
  const requestId = randomUUID();
  await service.signedUrl(student, id, 'session', actor, requestId);
  await service.signedUrl(student, id, 'session', actor, requestId);
  expect(logs.map((l) => l.request_id)).toEqual([requestId, requestId]);
  expect(new Set(logs.map((l) => l.event_key)).size).toBe(2);
});
test('actual AWS GET signer binds filename and no-store overrides, fixed TTL and inline/attachment mode', async () => {
  const keys = ['S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'],
    before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    S3_ENDPOINT: 'https://storage.example.invalid',
    S3_REGION: 'eu-central-1',
    S3_ACCESS_KEY: 'test-key',
    S3_SECRET_KEY: 'test-secret',
  });
  const svc = new PrivateUploads();
  try {
    const input = {
      bucket: 'online-school-files',
      key: 'private/file',
      fileName: 'Урок "A".pdf',
      canDownload: false,
      expiresIn: 900,
      signingDate: now,
    };
    const url = new URL(await svc.signRead(input));
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toBe('/online-school-files/private/file');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('response-cache-control')).toBe('private, no-store');
    expect(url.searchParams.get('response-content-disposition')).toContain('inline;');
    expect(url.searchParams.get('response-content-disposition')).toContain('filename*=UTF-8');
    expect(
      new URL(await svc.signRead({ ...input, canDownload: true, expiresIn: 60 })).searchParams.get(
        'response-content-disposition',
      ),
    ).toContain('attachment;');
    await code(svc.signRead({ ...input, expiresIn: 901 }), 'FILE_ACCESS_DENIED');
    await code(svc.signRead({ ...input, expiresIn: 0 }), 'FILE_ACCESS_DENIED');
  } finally {
    svc.onModuleDestroy();
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
