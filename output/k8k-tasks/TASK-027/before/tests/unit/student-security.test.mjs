import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { EmailOtp, EmailOtpMailer } from '../../apps/api/dist/student/security/email-otp.js';
import { Passwords } from '../../apps/api/dist/modules/identity/passwords.js';
import { sessionMetadata } from '../../apps/api/dist/core/session/session.store.js';
import {
  publicManagerLink,
  studentManagerContacts,
} from '../../apps/api/dist/student/manager-contacts.js';
import { PrivateUploads } from '../../apps/api/dist/modules/storage/private-uploads.service.js';
import { AuthRateLimitService } from '../../apps/api/dist/modules/identity/auth-rate-limit.service.js';
const envNames = ['STUDENT_EMAIL_OTP_SECRET', 'RESEND_API_KEY', 'STUDENT_EMAIL_FROM'];
let saved;
beforeEach(() => {
  saved = Object.fromEntries(envNames.map((k) => [k, process.env[k]]));
  process.env.STUDENT_EMAIL_OTP_SECRET = Buffer.alloc(32, 8).toString('base64');
  process.env.RESEND_API_KEY = 're_unit_only_key';
  process.env.STUDENT_EMAIL_FROM = 'security@example.invalid';
});
afterEach(() => {
  for (const k of envNames)
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  jest.restoreAllMocks();
});
test('OTP random six digits, HMAC bound to challenge/account/email and constant-size comparison', () => {
  const otp = new EmailOtp(),
    id = randomUUID(),
    account = randomUUID();
  const values = Array.from({ length: 20 }, () => otp.generate());
  expect(values.every((v) => /^\d{6}$/.test(v))).toBe(true);
  const code = '012345',
    hash = otp.digest(id, account, 'new@example.invalid', code);
  expect(hash).toMatch(/^[a-f0-9]{64}$/);
  expect(otp.matches(id, account, 'new@example.invalid', code, hash)).toBe(true);
  for (const args of [
    [randomUUID(), account, 'new@example.invalid'],
    [id, randomUUID(), 'new@example.invalid'],
    [id, account, 'other@example.invalid'],
  ])
    expect(otp.matches(...args, code, hash)).toBe(false);
  expect(otp.matches(id, account, 'new@example.invalid', '999999', hash)).toBe(false);
  expect(otp.matches(id, account, 'new@example.invalid', code, 'broken')).toBe(false);
});
test('OTP and mail fail closed without configured independent secret/sender', () => {
  delete process.env.STUDENT_EMAIL_OTP_SECRET;
  expect(() => new EmailOtp().configured()).toThrow();
  delete process.env.RESEND_API_KEY;
  expect(() => new EmailOtpMailer().configured()).toThrow();
});
test('Resend request uses fixed HTTPS endpoint, text-only OTP and provider idempotency key', async () => {
  const id = randomUUID(),
    spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ id: randomUUID() }), { status: 200 }));
  await new EmailOtpMailer().send(id, 'new@example.invalid', '123456');
  const [url, options] = spy.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails');
  expect(options.headers['Idempotency-Key']).toBe('student-email/' + id);
  expect(JSON.parse(options.body)).toMatchObject({
    from: 'security@example.invalid',
    to: ['new@example.invalid'],
    text: expect.stringContaining('123456'),
  });
  expect(JSON.parse(options.body)).not.toHaveProperty('html');
  expect(spy).toHaveBeenCalledTimes(1);
});
test.each([400, 429, 500])(
  'mail provider failure%i becomes safe503 without raw diagnostics',
  async (status) => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('PRIVATE secret diagnostics', { status }));
    await expect(
      new EmailOtpMailer().send(randomUUID(), 'new@example.invalid', '123456'),
    ).rejects.toMatchObject({ domain: { code: 'EMAIL_DELIVERY_UNAVAILABLE', status: 503 } });
  },
);
test('student8-char letter/digit password uses actual scrypt and verifies; standard policy stays12', async () => {
  const s = new Passwords(),
    hashed = await s.hash('Abcdef12', 'student');
  expect(hashed.ok).toBe(true);
  expect(hashed.value).toMatch(/^\$scrypt\$/);
  expect(await s.verify('Abcdef12', hashed.value)).toBe(true);
  expect(await s.verify('incorrect', hashed.value)).toBe(false);
  expect((await s.hash('Abcdef12')).ok).toBe(false);
  expect((await s.hash('abcdefgh', 'student')).ok).toBe(false);
  expect((await s.hash('12345678', 'student')).ok).toBe(false);
});
test('session device metadata is bounded and takes socket IP instead of forwarded spoof', () => {
  const out = sessionMetadata({
    headers: {
      'user-agent': 'Agent\n' + String.fromCharCode(0x85) + 'x'.repeat(600),
      'x-forwarded-for': '198.51.100.1',
    },
    socket: { remoteAddress: '::1' },
  });
  expect(out.ip_address).toBe('::1');
  expect(out.user_agent.length).toBe(512);
  expect(out.user_agent).not.toContain('\n');
  expect(out.user_agent).not.toContain(String.fromCharCode(0x85));
  expect(sessionMetadata()).toEqual({ user_agent: null, ip_address: null });
});
test.each([
  'javascript:alert(1)',
  'https://wa.me.evil.invalid/37360000123',
  'http://wa.me/37360000123',
  'https://wa.me/0000000',
  'https://t.me/valid_user?url=evil',
  'https://evil.invalid/manager',
])('untrusted manager link rejected: %s', (value) => {
  expect(publicManagerLink(value, 'whatsapp')).toBe('');
  expect(publicManagerLink(value, 'telegram')).toBe('');
});
test('manager query is scoped to pupil and authorized active staff, never global env fallback', async () => {
  const id = randomUUID(),
    client = {
      $queryRaw: jest.fn(async () => [
        { whatsapp: 'https://wa.me/37360000123', telegram: 'https://t.me/manager_one' },
      ]),
    };
  expect(await studentManagerContacts(client, id)).toEqual({
    whatsapp: 'https://wa.me/37360000123',
    telegram: 'https://t.me/manager_one',
  });
  const [strings, ...values] = client.$queryRaw.mock.calls[0];
  expect(values).toContain(id);
  expect(strings.join('?')).toContain('a.student_id=');
  expect(strings.join('?')).toContain('u.disabled_at IS NULL');
  client.$queryRaw.mockResolvedValue([]);
  expect(await studentManagerContacts(client, id)).toEqual({ whatsapp: '', telegram: '' });
});
test('email request rate is capped at5 per identity; persisted sixth attempt429', async () => {
  let count = 0;
  const client = { $queryRaw: jest.fn(async () => [{ attempts: ++count }]) },
    service = new AuthRateLimitService({ client });
  const req = { socket: { remoteAddress: '127.0.0.1' } };
  for (let i = 0; i < 2; i++) await service.limit(req, 'student.email.request', 'unit-account');
  await expect(service.limit(req, 'student.email.request', 'unit-account')).rejects.toMatchObject({
    domain: { status: 429 },
  });
});
test('private avatar read checks expected size/type and raster signature, no signing URL', async () => {
  const service = new PrivateUploads(),
    bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const send = jest.fn(async () => ({
    ContentLength: bytes.length,
    ContentType: 'image/png',
    Body: Readable.from([bytes]),
  }));
  service.connection = { send };
  expect(await service.readAvatar('unit-bucket', 'private/key', 'image/png', bytes.length)).toEqual(
    { bytes, contentType: 'image/png' },
  );
  expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'unit-bucket', Key: 'private/key' });
});
test.each(['image/svg+xml', 'text/html'])('avatar forbidden active MIME%s', async (type) => {
  const service = new PrivateUploads();
  await expect(service.readAvatar('unit', 'key', type, 8)).rejects.toMatchObject({
    domain: { code: 'AVATAR_FILE_INVALID' },
  });
});
test('spoofed PNG signature rejected and provider details sanitized', async () => {
  const service = new PrivateUploads();
  service.connection = {
    send: jest.fn(async () => ({
      ContentLength: 8,
      ContentType: 'image/png',
      Body: Readable.from([Buffer.from('<script>')]),
    })),
  };
  await expect(service.readAvatar('unit', 'key', 'image/png', 8)).rejects.toMatchObject({
    domain: { code: 'AVATAR_FILE_INVALID' },
  });
  service.connection.send.mockRejectedValue(Error('PRIVATE provider signedURL'));
  await expect(service.readAvatar('unit', 'key', 'image/png', 8)).rejects.toMatchObject({
    domain: { code: 'PRIVATE_STORAGE_UNAVAILABLE', status: 503 },
  });
});
