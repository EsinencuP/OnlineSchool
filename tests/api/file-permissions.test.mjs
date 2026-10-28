import { beforeAll, afterAll, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { apiFixture } from '../support/api-fixture.mjs';
let f, object, permission;
beforeAll(async () => {
  f = await apiFixture();
  object = await f.db.s3Object.create({
    data: {
      bucket: 'synthetic-private',
      key: randomUUID(),
      size: 1n,
      content_type: 'text/plain',
      status: 'VERIFIED',
      uploaded_at: new Date(),
      verified_at: new Date(),
      uploaded_by: f.actors.director.accountId,
      source_operation_id: randomUUID(),
    },
  });
  permission = await f.db.filePermission.create({
    data: {
      s3_object_id: object.id,
      subject_id: f.actors.manager.accountId,
      subject_type: 'STAFF',
      granted_by: f.actors.director.accountId,
      granted_at: new Date(),
      source_operation_id: randomUUID(),
    },
  });
});
afterAll(async () => {
  await f?.close();
});
test('private file requires a valid grant for the current subject', async () => {
  const allowed = await f.call(`files/${object.id}/access`, { method: 'GET' });
  expect(allowed.status).toBe(200);
  expect(allowed.body).toEqual({ objectId: object.id, accessible: true, canDownload: true });
  expect(
    (await f.call(`files/${object.id}/access`, { actor: 'other', method: 'GET' })).status,
  ).toBe(403);
});
test('private file never exposes a public or signed URL in permission metadata', async () => {
  const result = await f.call(`files/${object.id}/access`, { method: 'GET' });
  expect(result.status).toBe(200);
  expect(JSON.stringify(result.body)).not.toMatch(/https?:|amazonaws|bucket|synthetic-private/);
  expect(Object.keys(result.body).sort()).toEqual(['accessible', 'canDownload', 'objectId']);
});
test('revoked permission returns 403 and records a denial', async () => {
  await f.db.filePermission.update({
    where: { id: permission.id },
    data: { revoked_at: new Date(), revoked_by: f.actors.director.accountId },
  });
  const result = await f.call(`files/${object.id}/access`, { method: 'GET' });
  expect(result.status).toBe(403);
  expect(
    await f.db.auditEvent.count({
      where: {
        actor_id: f.actors.manager.accountId,
        action: 'file.access-check',
        result: 'DENIED',
      },
    }),
  ).toBeGreaterThanOrEqual(1);
});
