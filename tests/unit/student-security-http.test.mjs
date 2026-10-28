import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
import { Passwords } from '../../apps/api/dist/modules/identity/passwords.js';
import { AuthRateLimitService } from '../../apps/api/dist/modules/identity/auth-rate-limit.service.js';
import { EmailOtp, EmailOtpMailer } from '../../apps/api/dist/student/security/email-otp.js';
import { PrivateUploads } from '../../apps/api/dist/modules/storage/private-uploads.service.js';
const { Test } = createRequire(new URL('../../apps/api/package.json', import.meta.url))(
  '@nestjs/testing',
);
const users = [randomUUID(), randomUUID(), randomUUID()],
  students = [randomUUID(), randomUUID()],
  files = Array.from({ length: 5 }, () => randomUUID()),
  original = ' Temp-pass-2026! ';
const fakeHash = (p) =>
  createHash('sha256')
    .update('unit-only:' + p)
    .digest('hex');
const previousSecret = process.env.STUDENT_EMAIL_OTP_SECRET;
let app, db, state, issued, other, otp;
const mail = { configured: jest.fn(() => ({})), send: jest.fn(async () => {}) },
  rate = { limit: jest.fn(async () => {}) };
const passwords = {
  verify: jest.fn(async (p, h) => fakeHash(p) === h),
  hash: jest.fn(async (p) => ({ ok: true, value: fakeHash(p) })),
};
const storage = {
  readAvatar: jest.fn(async () => ({
    bytes: Buffer.from('unit-only-raster'),
    contentType: 'image/png',
  })),
};
const clock = () =>
  new Date(Math.max(+state.time, ...state.revocations.map((r) => +r.revoked_at + 1)));
const owner = (id) => students[users.indexOf(id)];
function profile(id) {
  return {
    id,
    student_id: owner(id),
    must_change_password: state.mustChange,
    timezone: 'Europe/Chisinau',
    created_at: new Date('2026-10-01T00:00:00Z'),
    activated_at: new Date('2026-10-01T00:00:00Z'),
    deactivated_at: null,
    account: state.accounts.get(id),
    student: state.pupils.get(owner(id)),
  };
}
const match = (row, where) =>
  Object.entries(where).every(([k, v]) =>
    v && typeof v === 'object' && !(v instanceof Date)
      ? v.gt !== undefined
        ? row[k] > v.gt
        : true
      : row[k] === v,
  );
beforeAll(async () => {
  process.env.STUDENT_EMAIL_OTP_SECRET = Buffer.alloc(32, 8).toString('base64');
  db = {
    $queryRaw: jest.fn(async (first, ...args) => {
      const sql = Array.isArray(first) ? first.join('?') : first.sql,
        values = Array.isArray(first) ? args : first.values;
      if (sql.includes('SELECT r.code'))
        return [{ code: values[0] === users[2] ? 'TEACHER' : 'STUDENT' }];
      if (sql.includes('AS has_active_access'))
        return [{ subject_ids: [], has_active_access: state.active }];
      if (sql.includes('SELECT s.student_whatsapp_url'))
        return [
          { whatsapp: 'https://wa.me/37360000123', telegram: 'https://t.me/personal_manager' },
        ];
      if (sql.includes('SELECT id FROM auth_accounts') || sql.includes('SELECT id FROM students'))
        return [{ id: values[0] }];
      return [{ now: clock(), locked: true }];
    }),
    authAccount: {
      findFirst: jest.fn(
        async ({ where }) =>
          [...state.accounts.values()].find(
            (a) => a.login_id.toLowerCase() === where.login_id.equals.toLowerCase(),
          ) ?? null,
      ),
      findUnique: jest.fn(async ({ where }) =>
        where.id
          ? state.accounts.get(where.id)
          : ([...state.accounts.values()].find((a) => a.login_id === where.login_id) ?? null),
      ),
      findUniqueOrThrow: jest.fn(async ({ where }) => state.accounts.get(where.id)),
      update: jest.fn(async ({ where, data }) => Object.assign(state.accounts.get(where.id), data)),
    },
    studentAccount: {
      findFirst: jest.fn(async ({ where }) =>
        users.slice(0, 2).includes(where.account_id) ? profile(where.account_id) : null,
      ),
      update: jest.fn(async ({ data }) => {
        state.mustChange = data.must_change_password;
        return profile(users[0]);
      }),
    },
    student: {
      findUnique: jest.fn(async ({ where }) => state.pupils.get(where.id)),
      update: jest.fn(async ({ where, data }) => Object.assign(state.pupils.get(where.id), data)),
    },
    teacherAccount: { findFirst: jest.fn(async () => ({ deactivated_at: null })) },
    s3Object: {
      findFirst: jest.fn(async ({ where }) => {
        const f = state.files.get(where.id);
        return f &&
          f.status === 'VERIFIED' &&
          f.verified_at <= clock() &&
          ['image/png', 'image/jpeg', 'image/webp'].includes(f.content_type) &&
          f.size > 0n &&
          f.size <= 2097152n &&
          (!where.uploaded_by || f.uploaded_by === where.uploaded_by) &&
          (!where.uploaded_by_ref ||
            owner(f.uploaded_by) === where.uploaded_by_ref.student_profile.student_id)
          ? f
          : null;
      }),
    },
    studentEmailChange: {
      create: jest.fn(async ({ data }) => {
        const r = { ...data, attempts: 0, used_at: null, revoked_at: null, sent_at: null };
        state.email.set(r.id, r);
        return r;
      }),
      findFirst: jest.fn(
        async ({ where }) =>
          [...state.email.values()]
            .filter((r) => match(r, where))
            .sort((a, b) => +b.issued_at - +a.issued_at || b.id.localeCompare(a.id))[0] ?? null,
      ),
      findMany: jest.fn(async ({ where }) =>
        [...state.email.values()].filter((r) => match(r, where)),
      ),
      update: jest.fn(async ({ where, data }) => Object.assign(state.email.get(where.id), data)),
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const r of state.email.values())
          if (match(r, where)) {
            Object.assign(r, data);
            count++;
          }
        return { count };
      }),
    },
    session: {
      create: jest.fn(async ({ data }) => {
        const r = { ...data, id: randomUUID(), revoked_at: null };
        state.sessions.set(r.id, r);
        return r;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const r = where.id
          ? state.sessions.get(where.id)
          : [...state.sessions.values()].find((s) => s.token_hash === where.token_hash);
        return r ? { ...r, account: state.accounts.get(r.account_id) } : null;
      }),
      findFirst: jest.fn(
        async ({ where }) =>
          [...state.sessions.values()].find(
            (s) => s.id === where.id && s.account_id === where.account_id,
          ) ?? null,
      ),
      findMany: jest.fn(async ({ where }) =>
        [...state.sessions.values()].filter(
          (s) =>
            s.account_id === where.account_id &&
            !s.revoked_at &&
            s.expires_at > clock() &&
            +(s.last_seen_at ?? s.created_at) >= +clock() - 1800000,
        ),
      ),
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const s of state.sessions.values())
          if (
            (!where.id || s.id === where.id) &&
            (!where.account_id || s.account_id === where.account_id) &&
            (!Object.hasOwn(where, 'revoked_at') || s.revoked_at === where.revoked_at) &&
            (!where.expires_at || s.expires_at > where.expires_at.gt)
          ) {
            Object.assign(s, data);
            count++;
          }
        return { count };
      }),
    },
    accessRevocation: {
      create: jest.fn(async ({ data }) => {
        state.revocations.push(data);
        return data;
      }),
      findFirst: jest.fn(
        async ({ where }) =>
          state.revocations.find(
            (r) =>
              r.account_id === where.account_id &&
              where.OR.some(
                (c) =>
                  c.session_id === r.session_id &&
                  (c.session_id !== null || r.revoked_at >= c.revoked_at.gte),
              ),
          ) ?? null,
      ),
    },
    auditEvent: {
      create: jest.fn(async ({ data }) => {
        if (state.failAudit) throw Error('PRIVATE audit detail');
        state.audit.push(data);
        return data;
      }),
    },
    outboxEvent: {
      create: jest.fn(async ({ data }) => {
        if (state.failOutbox) throw Error('PRIVATE outbox detail');
        state.outbox.push(data);
        return data;
      }),
    },
    idempotencyRecord: {
      findUnique: jest.fn(async ({ where }) => {
        const k = where.scope_command_type_key;
        return (
          [...state.records.values()].find(
            (r) => r.scope === k.scope && r.command_type === k.command_type && r.key === k.key,
          ) ?? null
        );
      }),
      create: jest.fn(async ({ data }) => {
        const r = { ...data, status: 'PENDING' };
        state.records.set(r.id, r);
        return r;
      }),
      update: jest.fn(async ({ where, data }) => Object.assign(state.records.get(where.id), data)),
      delete: jest.fn(async ({ where }) => state.records.delete(where.id)),
    },
    $disconnect: jest.fn(async () => {}),
  };
  db.$transaction = jest.fn(async (fn) => {
    const snapshot = structuredClone(state);
    try {
      return await fn(db);
    } catch (e) {
      state = snapshot;
      throw e;
    }
  });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService)
    .useValue({ client: db })
    .overrideProvider(Passwords)
    .useValue(passwords)
    .overrideProvider(AuthRateLimitService)
    .useValue(rate)
    .overrideProvider(EmailOtpMailer)
    .useValue(mail)
    .overrideProvider(PrivateUploads)
    .useValue(storage)
    .compile();
  app = module.createNestApplication();
  app.useLogger(false);
  await app.init();
  otp = app.get(EmailOtp);
});
afterAll(async () => {
  await app?.close();
  if (previousSecret === undefined) delete process.env.STUDENT_EMAIL_OTP_SECRET;
  else process.env.STUDENT_EMAIL_OTP_SECRET = previousSecret;
});
afterEach(() => jest.restoreAllMocks());
beforeEach(async () => {
  jest.clearAllMocks();
  mail.send.mockResolvedValue();
  rate.limit.mockResolvedValue();
  state = {
    time: new Date(),
    accounts: new Map(),
    pupils: new Map(),
    files: new Map(),
    sessions: new Map(),
    email: new Map(),
    records: new Map(),
    revocations: [],
    audit: [],
    outbox: [],
    active: true,
    mustChange: false,
    failAudit: false,
    failOutbox: false,
  };
  users.forEach((id, i) =>
    state.accounts.set(id, {
      id,
      kind: i === 2 ? 'TEACHER' : 'STUDENT',
      login_id: `pupil${i}@example.invalid`,
      password_hash: fakeHash(original),
      disabled_at: null,
      recovery_registration_required: false,
    }),
  );
  students.forEach((id, i) =>
    state.pupils.set(id, {
      id,
      full_name: `Registry pupil${i}`,
      display_name: null,
      avatar_file_id: null,
    }),
  );
  files.forEach((id, i) =>
    state.files.set(id, {
      id,
      uploaded_by: i === 1 ? users[1] : users[0],
      status: i === 2 ? 'QUARANTINED' : 'VERIFIED',
      verified_at: clock(),
      content_type: i === 3 ? 'image/svg+xml' : 'image/png',
      size: i === 4 ? 2097153n : 100n,
      bucket: 'unit-bucket',
      key: `private/${id}`,
    }),
  );
  issued = await Promise.all(
    users.map((id) =>
      app.get(SessionStore).issue(db, id, null, false, {
        headers: { 'user-agent': 'Synthetic browser' },
        socket: { remoteAddress: '127.0.0.1' },
      }),
    ),
  );
  other = await app.get(SessionStore).issue(db, users[0], null, false, {
    headers: { 'user-agent': 'Other browser' },
    socket: { remoteAddress: '::1' },
  });
});
const get = (path, i = 0, session = issued[i]) =>
  request(app.getHttpServer())
    .get('/api/v1/student/' + path)
    .set('Cookie', `__Host-school_session=${session.token}`);
function command(method, path, body = {}, options = {}) {
  const session = options.session ?? issued[options.i ?? 0],
    r = request(app.getHttpServer())
      [method]('/api/v1/student/' + path)
      .set(
        'Cookie',
        `__Host-school_session=${session.token}; __Host-school_csrf=${session.csrfToken}`,
      )
      .set('Idempotency-Key', options.key ?? randomUUID());
  if (options.csrf !== false) r.set('X-CSRF-Token', session.csrfToken);
  return r.send(body);
}
const requestEmail = (
  body = { newEmail: 'new@example.invalid', currentPassword: original },
  options = {},
) => command('post', 'security/change-email/request', body, options);
const confirmEmail = (
  code = mail.send.mock.calls.at(-1)?.[2],
  newEmail = 'new@example.invalid',
  options = {},
) => command('post', 'security/change-email/confirm', { newEmail, otp: code }, options);
test('profile updates only own display alias, leaves registry name, email and other pupil intact', async () => {
  const r = await command('patch', 'profile', { displayName: 'Новое имя' });
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({
    id: students[0],
    displayName: 'Новое имя',
    email: 'pupil0@example.invalid',
    avatarFileId: null,
  });
  expect(state.pupils.get(students[0]).full_name).toBe('Registry pupil0');
  expect(state.pupils.get(students[1]).display_name).toBeNull();
  expect((await get('me')).body.displayName).toBe('Новое имя');
});
test('profile selects an owned verified raster and returns a private avatar endpoint', async () => {
  const r = await command('patch', 'profile', { avatarFileId: files[0] });
  expect(r.status).toBe(200);
  expect(r.body.avatarFileId).toBe(files[0]);
  expect(r.body.avatarUrl).toBe('/api/v1/student/profile/avatar?v=' + files[0]);
  const image = await get('profile/avatar');
  expect(image.status).toBe(200);
  expect(image.headers['cache-control']).toBe('private, no-store');
  expect(image.headers['x-content-type-options']).toBe('nosniff');
  state.files.get(files[0]).status = 'DELETED';
  expect((await get('profile/avatar')).status).toBe(404);
});
test.each([1, 2, 3, 4])('avatar rejects foreign/quarantined/SVG/oversize index%i', async (i) => {
  expect((await command('patch', 'profile', { avatarFileId: files[i] })).status).toBe(403);
  expect(state.pupils.get(students[0]).avatar_file_id).toBeNull();
});
test.each([
  { email: 'unverified@example.invalid' },
  { phone: '+123456789' },
  { displayName: '' },
  { displayName: 'x'.repeat(101) },
  { avatarFileId: 'bad' },
  { studentProfileId: students[1] },
  {},
])('profile rejects unsupported/invalid fields %j', async (body) =>
  expect((await command('patch', 'profile', body)).status).toBe(400),
);
test('profile replay does not duplicate audit/outbox or lose scope', async () => {
  const key = randomUUID();
  const a = await command('patch', 'profile', { displayName: 'Имя' }, { key }),
    b = await command('patch', 'profile', { displayName: 'Имя' }, { key });
  expect(b.status).toBe(200);
  expect(b.body).toEqual(a.body);
  expect(state.outbox).toHaveLength(1);
});
test.each([
  'profile',
  'profile/avatar',
  'security/sessions',
  'subscription',
  'notifications/count',
])('initial password blocks %s, including formerly exempt profile/security', async (path) => {
  state.mustChange = true;
  const response =
    path === 'profile'
      ? await command('patch', 'profile', { displayName: 'Name' })
      : await get(path);
  expect(response.body.code).toBe('MUST_CHANGE_PASSWORD');
});
test('initial password takes priority over inactive access; bootstrap me remains200', async () => {
  state.mustChange = true;
  state.active = false;
  expect((await get('security/sessions')).status).toBe(403);
  expect((await get('me')).body).toMatchObject({
    mustChangePassword: true,
    hasActiveAccess: false,
  });
});
test.each(['profile/avatar', 'security/sessions', 'subscription/payments', 'notifications/count'])(
  'inactive protected %s is402 with personal manager links',
  async (path) => {
    state.active = false;
    const r = await get(path);
    expect(r.status).toBe(402);
    expect(r.body).toMatchObject({
      code: 'ACCESS_SUSPENDED',
      managerContacts: {
        whatsapp: 'https://wa.me/37360000123',
        telegram: 'https://t.me/personal_manager',
      },
    });
  },
);
test('PATCH password accepts8 chars while initially locked/inactive, clears flag and rotates sessions', async () => {
  state.mustChange = true;
  state.active = false;
  const r = await command('patch', 'security/change-password', {
    currentPassword: original,
    newPassword: 'Abcdef12',
  });
  expect(r.status).toBe(200);
  expect(state.mustChange).toBe(false);
  expect(state.accounts.get(users[0]).password_hash).toBe(fakeHash('Abcdef12'));
  expect(r.headers['set-cookie']).toHaveLength(2);
  expect((await get('me')).status).toBe(401);
  expect((await get('me', 0, other)).status).toBe(401);
  expect(state.audit.some((a) => a.action === 'student.password.change')).toBe(true);
});
test('wrong current password401 and composition/length invalid400 without writes', async () => {
  expect(
    (
      await command('patch', 'security/change-password', {
        currentPassword: 'wrong',
        newPassword: 'Abcdef12',
      })
    ).status,
  ).toBe(401);
  for (const newPassword of ['abcdefghi', '123456789', 'Abc1234', 'A1' + 'x'.repeat(127)])
    expect(
      (
        await command('patch', 'security/change-password', {
          currentPassword: original,
          newPassword,
        })
      ).status,
    ).toBe(400);
  expect(state.accounts.get(users[0]).password_hash).toBe(fakeHash(original));
});
test('email request verifies exact current password and does not change login before OTP', async () => {
  const r = await requestEmail();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ message: 'OTP отправлен на новый email' });
  const [id, address, code] = mail.send.mock.calls[0];
  expect(address).toBe('new@example.invalid');
  expect(code).toMatch(/^\d{6}$/);
  expect(state.email.get(id).otp_hash).not.toBe(code);
  expect(state.email.get(id).expires_at - state.email.get(id).issued_at).toBe(600000);
  expect(state.accounts.get(users[0]).login_id).toBe('pupil0@example.invalid');
  expect(
    JSON.stringify([...state.audit, ...state.outbox, ...state.records.values()]),
  ).not.toContain(JSON.stringify(code));
});
test('wrong password never sends an email or allocates an OTP', async () => {
  expect(
    (await requestEmail({ newEmail: 'new@example.invalid', currentPassword: 'wrong' })).status,
  ).toBe(401);
  expect(mail.send).not.toHaveBeenCalled();
  expect(state.email.size).toBe(0);
});
test('valid OTP changes AuthAccount login with audit, preserves CRM name/contact identity and rotates cookies', async () => {
  await requestEmail();
  const r = await confirmEmail();
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ email: 'new@example.invalid' });
  expect(r.headers['set-cookie']).toHaveLength(2);
  expect(state.accounts.get(users[0])).toMatchObject({
    login_id: 'new@example.invalid',
    email_verified_at: expect.any(Date),
  });
  expect(state.pupils.get(students[0]).full_name).toBe('Registry pupil0');
  expect(
    state.audit.some(
      (a) =>
        a.action === 'student.email.change' && a.actor_id === users[0] && a.result === 'SUCCESS',
    ),
  ).toBe(true);
  expect((await get('me')).status).toBe(401);
});
test('OTP is single-use even from another still-valid own-session reference', async () => {
  await requestEmail();
  const code = mail.send.mock.calls[0][2];
  await confirmEmail(code);
  const fresh = await app.get(SessionStore).issue(db, users[0]);
  expect((await confirmEmail(code, 'new@example.invalid', { session: fresh })).status).toBe(400);
  expect(
    state.audit.filter((a) => a.action === 'student.email.change' && a.result === 'SUCCESS'),
  ).toHaveLength(1);
});
test('OTP expires exactly at10 minutes with a mocked database clock', async () => {
  await requestEmail();
  const code = mail.send.mock.calls[0][2],
    challenge = [...state.email.values()][0];
  state.time = new Date(+challenge.expires_at);
  expect((await confirmEmail(code)).status).toBe(400);
  expect(state.accounts.get(users[0]).login_id).toBe('pupil0@example.invalid');
});
test('resend invalidates prior code and refuses a random collision with a live prior OTP', async () => {
  jest
    .spyOn(otp, 'generate')
    .mockReturnValueOnce('123456')
    .mockReturnValueOnce('123456')
    .mockReturnValueOnce('654321');
  await requestEmail();
  await requestEmail();
  expect(mail.send.mock.calls.at(-1)[2]).toBe('654321');
  expect((await confirmEmail('123456')).status).toBe(400);
  expect((await confirmEmail('654321')).status).toBe(200);
});
test('wrong-code attempts persist despite400; after5 the right code is invalid', async () => {
  await requestEmail();
  const code = mail.send.mock.calls[0][2],
    bad = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) expect((await confirmEmail(bad)).status).toBe(400);
  const pending = [...state.email.values()][0];
  expect(pending.attempts).toBe(5);
  expect(pending.revoked_at).not.toBeNull();
  expect((await confirmEmail(code)).status).toBe(400);
  expect(
    state.audit.filter((a) => a.action === 'student.email.change' && a.result === 'DENIED').length,
  ).toBeGreaterThanOrEqual(5);
});
test('OTP belongs to requesting login and exact new email', async () => {
  await requestEmail();
  const code = mail.send.mock.calls[0][2];
  expect((await confirmEmail(code, 'new@example.invalid', { i: 1 })).status).toBe(400);
  expect((await confirmEmail(code, 'different@example.invalid')).status).toBe(400);
  expect(state.accounts.get(users[1]).login_id).toBe('pupil1@example.invalid');
});
test('existing email is unavailable after password verification, no mail or merge', async () => {
  expect(
    (await requestEmail({ newEmail: 'pupil1@example.invalid', currentPassword: original })).status,
  ).toBe(409);
  expect(mail.send).not.toHaveBeenCalled();
});
test('legacy mixed-case login also reserves its email without account merging', async () => {
  state.accounts.get(users[1]).login_id = 'Legacy@Example.Invalid';
  expect(
    (await requestEmail({ newEmail: 'legacy@example.invalid', currentPassword: original })).status,
  ).toBe(409);
  expect(mail.send).not.toHaveBeenCalled();
});
test('mail failure does not return sent200 and leaves login unchanged', async () => {
  mail.send.mockRejectedValueOnce(Error('PRIVATE provider failure'));
  const r = await requestEmail();
  expect(r.status).toBeGreaterThanOrEqual(500);
  expect(JSON.stringify(r.body)).not.toContain('PRIVATE');
  expect(state.accounts.get(users[0]).login_id).toBe('pupil0@example.invalid');
});
test('password change revokes pending email OTP', async () => {
  await requestEmail();
  const r = await command('patch', 'security/change-password', {
    currentPassword: original,
    newPassword: 'Abcdef12',
  });
  expect(r.status).toBe(200);
  expect([...state.email.values()][0].revoked_at).not.toBeNull();
});
test('confirmation audit/outbox failure rolls back login, used state and revocation', async () => {
  await requestEmail();
  state.failOutbox = true;
  const r = await confirmEmail();
  expect(r.status).toBe(503);
  expect(state.accounts.get(users[0]).login_id).toBe('pupil0@example.invalid');
  expect([...state.email.values()][0].used_at).toBeNull();
  expect(state.sessions.get(issued[0].sessionId).revoked_at).toBeNull();
});
test('sessions list has only own active sessions and no token/hash fields', async () => {
  const r = await get('security/sessions');
  expect(r.status).toBe(200);
  expect(r.body).toHaveLength(2);
  expect(r.body.find((s) => s.isCurrent)).toMatchObject({
    sessionId: issued[0].sessionId,
    userAgent: 'Synthetic browser',
    ipAddress: '127.0.0.1',
  });
  expect(JSON.stringify(r.body)).not.toMatch(/token|csrf|password/);
});
test('revoke other own session204 and repeated204; current409, foreign or missing404', async () => {
  expect((await command('delete', `security/sessions/${other.sessionId}`)).status).toBe(204);
  expect((await get('me', 0, other)).status).toBe(401);
  expect((await command('delete', `security/sessions/${other.sessionId}`)).status).toBe(204);
  expect((await command('delete', `security/sessions/${issued[0].sessionId}`)).status).toBe(409);
  expect((await command('delete', `security/sessions/${issued[1].sessionId}`)).status).toBe(404);
  expect((await command('delete', `security/sessions/${randomUUID()}`)).status).toBe(404);
  expect((await get('security/sessions')).body).toHaveLength(1);
});
test('teacher403, no session401, CSRF required for every sensitive mutation', async () => {
  expect((await get('security/sessions', 2)).status).toBe(403);
  expect((await request(app.getHttpServer()).get('/api/v1/student/security/sessions')).status).toBe(
    401,
  );
  for (const [method, path, body] of [
    [
      'post',
      'security/change-email/request',
      { newEmail: 'new@example.invalid', currentPassword: original },
    ],
    ['post', 'security/change-email/confirm', { newEmail: 'new@example.invalid', otp: '123456' }],
    ['patch', 'profile', { displayName: 'A' }],
    ['delete', `security/sessions/${other.sessionId}`, {}],
  ])
    expect((await command(method, path, body, { csrf: false })).status).toBe(403);
});
