import { standaloneNotificationStorage } from '../support/notification-storage.mjs';
import { notificationDeliveryHandler } from '../../apps/worker/dist/notification-delivery.js';
import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createManagerStudentAccount,
  resetManagerStudentPassword,
} from '../../packages/api-contracts/dist/generated/client.js';
import { createHandlers, StudentAccountCreatedHandler } from '../../apps/worker/dist/handlers.js';

test.each(['create', 'reset'])(
  'generated %s command forwards credentials, CSRF and idempotency',
  async (kind) => {
    const response = {
      accountId: randomUUID(),
      temporaryPassword: null,
      passwordAlreadyIssued: true,
    };
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(response)));
    try {
      const options = { headers: { 'Idempotency-Key': randomUUID(), 'X-CSRF-Token': 'csrf' } };
      const result =
        kind === 'create'
          ? await createManagerStudentAccount(
              'student',
              { loginEmail: 'student@example.invalid' },
              options,
            )
          : await resetManagerStudentPassword('student', {}, options);
      expect(result).toEqual({ ok: true, value: response });
      const [url, request] = fetch.mock.calls[0];
      expect(url).toBe(
        `/api/v1/manager/students/student/account${kind === 'reset' ? '/reset-password' : ''}`,
      );
      expect(request.method).toBe('POST');
      expect(request.credentials).toBe('include');
      expect(request.headers).toMatchObject(options.headers);
      expect(JSON.parse(request.body)).toEqual(
        kind === 'create' ? { loginEmail: 'student@example.invalid' } : {},
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      fetch.mockRestore();
    }
  },
);

test('OpenAPI advertises cookie auth, replay and nullable one-time password without examples', async () => {
  const doc = JSON.parse(await readFile('packages/api-contracts/openapi/openapi.json', 'utf8'));
  for (const suffix of ['', '/reset-password']) {
    const op = doc.paths[`/api/v1/manager/students/{studentId}/account${suffix}`].post;
    expect(op.security).toContainEqual({ sessionCookie: [] });
    expect(op.tags).toContain('manager');
    for (const code of ['200', '400', '401', '403', '404', '409', '422', '429'])
      expect(op.responses[code]).toBeDefined();
    expect(op.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Idempotency-Key', required: true }),
        expect.objectContaining({ name: 'X-CSRF-Token', required: true }),
      ]),
    );
  }
  expect(
    doc.paths['/api/v1/manager/students/{studentId}/account'].post.responses['201'],
  ).toBeDefined();
  const secret = doc.components.schemas.StudentAccountIssuedDto.properties.temporaryPassword;
  expect(secret).toMatchObject({ type: ['string', 'null'], format: 'password' });
  expect(secret.example).toBeUndefined();
  expect(secret.default).toBeUndefined();
});

test('committed account notice projects once through NotificationService without a credential', async () => {
  const now = new Date('2026-10-31T12:00:00Z');
  const payload = {
    studentId: randomUUID(),
    accountId: randomUUID(),
    loginEmail: 'student@example.invalid',
  };
  const { tx, state } = standaloneNotificationStorage(payload.studentId, now);
  const event = { id: randomUUID(), source_operation_id: randomUUID(), payload, created_at: now };
  expect((await StudentAccountCreatedHandler(tx, event, now)).ok).toBe(true);
  expect((await StudentAccountCreatedHandler(tx, event, now)).ok).toBe(true);
  expect(state.inbox.size).toBe(0);
  const delivery = state.outbox.find((e) => e.topic === 'notification.deliver.v1');
  expect((await notificationDeliveryHandler()(tx, delivery, now)).ok).toBe(true);
  expect((await notificationDeliveryHandler()(tx, delivery, now)).ok).toBe(true);
  expect(state.inbox.size).toBe(1);
  const item = [...state.inbox.values()][0];
  expect(item).toMatchObject({
    type: 'ACCOUNT_CREATED',
    payload: { accountId: payload.accountId, loginEmail: payload.loginEmail },
  });
  expect(item.body).toContain(payload.loginEmail);
  expect(
    JSON.stringify({
      sources: [...state.notificationSources.values()],
      inbox: [...state.inbox.values()],
      outbox: state.outbox,
    }),
  ).not.toMatch(/temporaryPassword|password_hash|scrypt/);
});

test('worker rejects a missing account relation and recognizes committed command topics', async () => {
  const tx = { studentAccount: { findFirst: async () => null } };
  const payload = {
    studentId: randomUUID(),
    accountId: randomUUID(),
    loginEmail: 'student@example.invalid',
  };
  expect(await StudentAccountCreatedHandler(tx, { payload }, new Date())).toMatchObject({
    ok: false,
  });
  expect(await StudentAccountCreatedHandler(tx, { payload: {} }, new Date())).toMatchObject({
    ok: false,
  });
  for (const topic of [
    'manager.student.account-created.v1',
    'manager.student.account-issued.v1',
    'manager.student.password-reset.v1',
  ])
    expect(createHandlers().has(topic)).toBe(true);
});
