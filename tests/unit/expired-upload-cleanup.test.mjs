import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, jest, test } from '@jest/globals';
import { PrivateUploads } from '../../apps/api/dist/modules/storage/private-uploads.service.js';
import { TeacherMaterialsService } from '../../apps/api/dist/modules/teacher/teacher-materials.service.js';
import {
  ExpiredUploadCleanup,
  expiredUploadHandler,
  UPLOAD_CLEANUP_TOPIC,
} from '../../apps/worker/dist/expired-upload-cleanup.js';
import { createHandlers } from '../../apps/worker/dist/handlers.js';
import { OutboxWorker } from '../../apps/worker/dist/outbox.js';

const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { S3Client } = requireApi('@aws-sdk/client-s3');
const bucket = 'school-private-fixture';
const file = {
  fileId: randomUUID(),
  operationId: randomUUID(),
  bucket,
  scope: 'homework',
  mode: 'ABANDONED',
  status: 'PENDING',
};
const material = {
  ...file,
  fileId: randomUUID(),
  operationId: randomUUID(),
  scope: 'materials',
  mode: 'STAGING_ONLY',
  status: 'VERIFIED',
};

function fixture(rows) {
  const tx = {
    $queryRaw: jest.fn(async () => rows),
    auditEvent: { create: jest.fn(async () => ({ id: randomUUID() })), createMany: jest.fn() },
    outboxEvent: { create: jest.fn() },
    s3Object: { update: jest.fn() },
  };
  return {
    tx,
    db: { $transaction: async (work) => work(tx) },
    storage: { bucket: () => bucket, deleteExpiredUpload: jest.fn() },
  };
}

function event(target) {
  return {
    aggregate_id: target.fileId,
    aggregate_type: 'S3Object',
    source_operation_id: target.operationId,
    event_key: `storage:upload-cleanup:${target.fileId}`,
    topic: UPLOAD_CLEANUP_TOPIC,
    payload: { schemaVersion: 1, mode: target.mode },
    audit_event_id: randomUUID(),
  };
}

test('reserves abandoned uploads in the same transaction as audit and outbox, without deleting storage', async () => {
  const { tx, db, storage } = fixture([file, material]);
  const cleanup = new ExpiredUploadCleanup(db, storage);
  await cleanup.enqueueDue();
  await cleanup.enqueueDue();
  expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  const sql = tx.$queryRaw.mock.calls[0][0];
  expect(sql.text).toContain("u.expires_at<=statement_timestamp()-interval '1 day'");
  expect(sql.text).toContain('FOR UPDATE OF o SKIP LOCKED');
  expect(sql.text).toContain('NOT EXISTS (SELECT FROM public.file_permissions');
  expect(sql.values).toEqual([bucket, 10]);
  expect(tx.auditEvent.create).toHaveBeenCalledTimes(2);
  expect(
    tx.outboxEvent.create.mock.calls.map(([{ data }]) => [
      data.topic,
      data.aggregate_id,
      data.payload.mode,
    ]),
  ).toEqual([
    [UPLOAD_CLEANUP_TOPIC, file.fileId, 'ABANDONED'],
    [UPLOAD_CLEANUP_TOPIC, material.fileId, 'STAGING_ONLY'],
  ]);
  expect(tx.s3Object.update.mock.calls).toEqual([
    [
      {
        where: { id: file.fileId },
        data: { status: 'QUARANTINED' },
      },
    ],
  ]);
  expect(storage.deleteExpiredUpload).not.toHaveBeenCalled();
});

test('disabled cleanup stays pending without claiming an outbox attempt', async () => {
  const { tx, db } = fixture([]);
  await expect(new OutboxWorker(db, {}).claim()).resolves.toBeNull();
  const [parts, ...values] = tx.$queryRaw.mock.calls[0];
  expect(parts.join('?')).toContain('AND (? OR topic<>?)');
  expect(values).toEqual([false, UPLOAD_CLEANUP_TOPIC]);
  expect(createHandlers().has(UPLOAD_CLEANUP_TOPIC)).toBe(false);
  const cleanup = jest.fn();
  await new OutboxWorker(db, {}, createHandlers(cleanup)).claim();
  expect(tx.$queryRaw.mock.calls[1].slice(1)).toEqual([true, UPLOAD_CLEANUP_TOPIC]);
});

test('teacher material lists exclude reserved and removed files from the public state contract', async () => {
  const $queryRaw = jest.fn(async () => []);
  const service = new TeacherMaterialsService({ client: { $queryRaw } }, {});
  await expect(service.list({ teacherId: randomUUID() }, {})).resolves.toMatchObject({
    ok: true,
    value: { items: [] },
  });
  expect($queryRaw.mock.calls[0][0].text).toContain("o.status IN ('PENDING','VERIFIED')");
});

test('transient S3 failure preserves the reservation and completion is recorded after acknowledged retry', async () => {
  const reserved = { ...file, status: 'QUARANTINED' };
  const { tx, storage } = fixture([reserved]);
  const handler = expiredUploadHandler(storage);
  storage.deleteExpiredUpload.mockRejectedValueOnce(new Error('private storage failure'));
  const command = event(file);
  await expect(handler(tx, command)).resolves.toEqual({
    ok: false,
    error: { code: 'UPLOAD_CLEANUP_STORAGE_UNAVAILABLE' },
  });
  expect(tx.s3Object.update).not.toHaveBeenCalled();
  expect(tx.auditEvent.createMany).not.toHaveBeenCalled();
  await expect(handler(tx, command)).resolves.toMatchObject({ ok: true });
  expect(storage.deleteExpiredUpload.mock.calls).toEqual([[reserved], [reserved]]);
  expect(tx.s3Object.update).toHaveBeenCalledWith({
    where: { id: file.fileId },
    data: { status: 'DELETED' },
  });
  expect(tx.$queryRaw.mock.calls[1][0].text).toContain(
    "a.system_actor_ref='upload-cleanup-worker'",
  );
  expect(tx.auditEvent.createMany).toHaveBeenCalledTimes(1);
});

test('only staging is removed for a confirmed upload and an unreserved final file is rejected', async () => {
  const { tx, storage } = fixture([material]);
  const handler = expiredUploadHandler(storage);
  await expect(handler(tx, event(material))).resolves.toMatchObject({ ok: true });
  expect(storage.deleteExpiredUpload).toHaveBeenCalledWith(material);
  expect(tx.s3Object.update).not.toHaveBeenCalled();
  tx.$queryRaw.mockResolvedValueOnce([file]);
  await expect(handler(tx, event(file))).resolves.toMatchObject({
    ok: false,
    error: { code: 'UPLOAD_CLEANUP_INELIGIBLE' },
  });
  expect(storage.deleteExpiredUpload).toHaveBeenCalledTimes(1);
});

test('the storage adapter deletes canonical keys in the configured bucket only', async () => {
  const settings = {
    S3_BUCKET: bucket,
    S3_REGION: 'eu-central-1',
    S3_ENDPOINT: 'https://storage.example.invalid',
    S3_ACCESS_KEY: 'fixture-key',
    S3_SECRET_KEY: 'fixture-secret',
  };
  const previous = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
  Object.assign(process.env, settings);
  const send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({});
  const storage = new PrivateUploads();
  try {
    await storage.deleteExpiredUpload(material);
    await storage.deleteExpiredUpload(file);
    expect(send.mock.calls.map(([command]) => command.input)).toEqual([
      { Bucket: bucket, Key: `materials/incoming/${material.fileId}` },
      { Bucket: bucket, Key: `homework/incoming/${file.fileId}` },
      { Bucket: bucket, Key: `homework/final/${file.fileId}` },
    ]);
    await expect(
      storage.deleteExpiredUpload({ ...file, bucket: 'other-bucket' }),
    ).rejects.toMatchObject({
      domain: { code: 'UPLOAD_CLEANUP_TARGET_INVALID' },
    });
    await expect(
      storage.deleteExpiredUpload({ ...file, fileId: 'arbitrary-file-key' }),
    ).rejects.toMatchObject({
      domain: { code: 'UPLOAD_CLEANUP_TARGET_INVALID' },
    });
    expect(send).toHaveBeenCalledTimes(3);
  } finally {
    storage.onModuleDestroy();
    send.mockRestore();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
