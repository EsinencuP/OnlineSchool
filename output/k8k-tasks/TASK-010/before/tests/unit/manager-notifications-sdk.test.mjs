import { expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import {
  sendManagerStudentNotification,
  listManagerStudentNotifications,
} from '../../packages/api-contracts/dist/generated/client.js';
test('generated manual send preserves plain text, cookie/CSRF/key and QUEUED202 response', async () => {
  const value = {
      notificationId: 'notice',
      studentId: 'student',
      channel: 'EMAIL',
      status: 'QUEUED',
    },
    fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(value), { status: 202 }));
  try {
    const body = { channel: 'EMAIL', subject: 'Subject', body: '<b>Plain text</b>' },
      options = { headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'uuid' } };
    expect(await sendManagerStudentNotification('student', body, options)).toEqual({
      ok: true,
      value,
    });
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/manager/students/student/notifications');
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: options.headers,
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);
  } finally {
    fetch.mockRestore();
  }
});
test('generated list preserves status/cursor/limit and exposes safe delivery metadata', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ items: [], nextCursor: null })));
  try {
    await listManagerStudentNotifications('student', {
      status: 'FAILED',
      cursor: 'opaque',
      limit: 25,
    });
    const url = new URL(fetch.mock.calls[0][0], 'https://local.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: 'FAILED',
      cursor: 'opaque',
      limit: '25',
    });
  } finally {
    fetch.mockRestore();
  }
});
test('OpenAPI separates202 command from delivery statuses and strict input DTOs', async () => {
  const doc = JSON.parse(await readFile('packages/api-contracts/openapi/openapi.json', 'utf8')),
    path = doc.paths['/api/v1/manager/students/{studentId}/notifications'];
  for (const verb of ['get', 'post']) {
    expect(path[verb].security).toContainEqual({ sessionCookie: [] });
    expect(path[verb].tags).toContain('manager');
    for (const status of ['401', '403', '404', '422', '429'])
      expect(path[verb].responses[status]).toBeDefined();
  }
  expect(path.post.responses['202']).toBeDefined();
  for (const name of ['Idempotency-Key', 'X-CSRF-Token'])
    expect(path.post.parameters).toContainEqual(expect.objectContaining({ name, required: true }));
  for (const name of [
    'SendManagerNotificationDto',
    'ListManagerNotificationsDto',
    'ManagerNotificationDto',
    'ManagerNotificationPageDto',
  ])
    expect(doc.components.schemas[name].additionalProperties).toBe(false);
  expect(doc.components.schemas.ManagerNotificationDto.properties.status.enum).toEqual([
    'QUEUED',
    'SENT',
    'FAILED',
  ]);
  expect(doc.components.schemas.ManagerNotificationDto.properties).not.toHaveProperty(
    'recipient_email',
  );
});
