import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { expect, jest, test } from '@jest/globals';
import {
  capturePrivateBackup,
  readBackupCatalog,
  s3Files,
  verifyPrivateBackup,
  verifyStoreSeparation,
} from '../../apps/api/scripts/private-object-backup.mjs';

const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { S3Client } = requireApi('@aws-sdk/client-s3');

const bytes = Buffer.from('classroom backup fixture');
const at = new Date('2026-11-18T05:30:00Z');
const key = Buffer.alloc(32, 17);
const digest = createHash('sha256').update(bytes).digest('hex');
const file = {
  id: randomUUID(),
  key: 'fixture/lesson',
  bucket: 'source-private',
  size: bytes.length,
  mime: 'text/plain',
  sha256: digest,
};
const database = {
  format: 1,
  checkedAt: at.toISOString(),
  migrationVersion: '20261116140000_mgr_family_requests',
  checks: { LEDGER_UNBALANCED: 0 },
  datasets: { ledger_entries: { rows: 1, digest } },
};
const catalog = { database, files: [file], incomplete: 2, unavailable: 0 };

function fixture(data = bytes) {
  const records = new Map();
  const calls = [];
  const working = {
    bucket: file.bucket,
    get: jest.fn(async () => ({
      body: Readable.from([data]),
      size: file.size,
      mime: file.mime,
      version: 'working-version-1',
    })),
  };
  const archive = {
    async put(path, body, size, mime) {
      expect(records.has(path)).toBe(false);
      const parts = [];
      for await (const chunk of Buffer.isBuffer(body) ? [body] : body) parts.push(chunk);
      const data = Buffer.concat(parts);
      expect(data).toHaveLength(size);
      const entry = { version: 'version-' + (records.size + 1), data, size, mime, encrypted: true };
      records.set(path, entry);
      calls.push(['PUT', path, entry.version]);
      return entry.version;
    },
    async get(path, version) {
      calls.push(['GET', path, version]);
      const entry = records.get(path);
      if (!entry || (version && entry.version !== version))
        throw new Error('Synthetic missing object');
      return { ...entry, body: Readable.from([entry.data]) };
    },
  };
  return { working, archive, records, calls };
}

test('the database audit and verified files use a single read-only snapshot', async () => {
  const execute = jest.fn();
  const query = jest
    .fn()
    .mockResolvedValueOnce([
      {
        checked_at: at,
        read_only: true,
        server_version: 180007,
        migration_version: database.migrationVersion,
      },
    ])
    .mockResolvedValueOnce([{ checks: database.checks, datasets: database.datasets }])
    .mockResolvedValueOnce([{ ...file, size: BigInt(file.size) }])
    .mockResolvedValueOnce([{ incomplete: 2, unavailable: 0 }]);
  const db = { $transaction: (fn) => fn({ $executeRaw: execute, $queryRaw: query }) };
  await expect(readBackupCatalog(db)).resolves.toEqual(catalog);
  expect(execute.mock.calls[0][0].join('')).toContain('REPEATABLE READ, READ ONLY');
  expect(query.mock.calls[1][0].text).toContain('FROM fingerprints');
  expect(query.mock.calls[2][0].join('')).toMatch(
    /FROM public\.s3_objects WHERE status='VERIFIED'/,
  );
  expect(query.mock.calls[3][0].join('')).toContain('public.file_permissions');
});

test('copies and rereads versioned bytes before publishing the authenticated manifest', async () => {
  const f = fixture();
  const result = await capturePrivateBackup(catalog, f.working, f.archive, key);
  const object = 'recovery/' + result.id + '/files/' + file.id;
  const manifest = 'recovery/' + result.id + '/manifest.json';
  expect(result).toMatchObject({ status: 'FILES_CAPTURED', files: 1, incomplete: 2 });
  expect(f.calls).toEqual([
    ['PUT', object, 'version-1'],
    ['GET', object, 'version-1'],
    ['PUT', manifest, 'version-2'],
    ['GET', manifest, 'version-2'],
  ]);
  const { body } = JSON.parse(f.records.get(manifest).data.toString());
  expect(JSON.parse(body)).toMatchObject({ format: 2, database, takenAt: database.checkedAt });
  await expect(verifyPrivateBackup(catalog, f.archive, result.id, key)).resolves.toMatchObject({
    status: 'FILES_VERIFIED',
    files: 1,
    databaseCheckpointMatched: true,
  });
});

test('fails verification when matching files belong to a database with changed ledger data', async () => {
  const f = fixture();
  const { id } = await capturePrivateBackup(catalog, f.working, f.archive, key);
  const altered = structuredClone(catalog);
  altered.database.datasets.ledger_entries.digest = '0'.repeat(64);
  await expect(verifyPrivateBackup(altered, f.archive, id, key)).resolves.toMatchObject({
    status: 'DATABASE_MISMATCH',
    schemaMatches: true,
    changedDatasets: ['ledger_entries'],
  });
});

test('does not publish a checkpoint from a snapshot with an invariant violation', async () => {
  const f = fixture();
  const altered = structuredClone(catalog);
  altered.database.checks.LEDGER_UNBALANCED = 1;
  await expect(capturePrivateBackup(altered, f.working, f.archive, key)).rejects.toThrow(
    'BACKUP_DATABASE_INVARIANTS_FAILED',
  );
  expect(f.calls).toHaveLength(0);
});

test('a signed file-only manifest verifies its objects without claiming a database match', async () => {
  const f = fixture();
  const { id } = await capturePrivateBackup(catalog, f.working, f.archive, key);
  const record = f.records.get('recovery/' + id + '/manifest.json');
  const { body } = JSON.parse(record.data.toString());
  const { files, takenAt } = JSON.parse(body);
  const legacyBody = JSON.stringify({ format: 1, id, takenAt, files });
  const mac = createHmac('sha256', key).update(legacyBody).digest('hex');
  record.data = Buffer.from(JSON.stringify({ body: legacyBody, mac }));
  record.size = record.data.length;
  await expect(verifyPrivateBackup(catalog, f.archive, id, key)).resolves.toMatchObject({
    status: 'FILES_VERIFIED',
    databaseCheckpointMatched: false,
  });
});

test('a short source stream or a source hash mismatch never publishes a manifest', async () => {
  for (const [content, code] of [
    [bytes.subarray(1), 'BACKUP_SIZE_MISMATCH'],
    [Buffer.alloc(bytes.length, 1), 'BACKUP_SOURCE_HASH_MISMATCH'],
  ]) {
    const f = fixture(content);
    await expect(capturePrivateBackup(catalog, f.working, f.archive, key)).rejects.toThrow(code);
    expect([...f.records.keys()].some((path) => path.endsWith('/manifest.json'))).toBe(false);
  }
});

test('a restore audit identifies missing, extra, changed or unavailable records without writing', async () => {
  const f = fixture();
  const { id } = await capturePrivateBackup(catalog, f.working, f.archive, key);
  const newFile = { ...file, key: 'some-new-file', id: randomUUID() };
  await expect(
    verifyPrivateBackup({ ...catalog, files: [newFile] }, f.archive, id, key),
  ).resolves.toEqual({
    status: 'CATALOG_MISMATCH',
    missing: 1,
    extra: 1,
    changed: 0,
    unavailable: 0,
  });
  await expect(
    verifyPrivateBackup(
      { ...catalog, files: [{ ...file, size: file.size + 1 }], unavailable: 1 },
      f.archive,
      id,
      key,
    ),
  ).resolves.toEqual({
    status: 'CATALOG_MISMATCH',
    missing: 0,
    extra: 0,
    changed: 1,
    unavailable: 1,
  });
  expect(f.calls.filter(([method]) => method === 'PUT')).toHaveLength(2);
});

test('a damaged file or unauthenticated manifest fails the restore audit', async () => {
  const f = fixture();
  const { id } = await capturePrivateBackup(catalog, f.working, f.archive, key);
  await expect(verifyPrivateBackup(catalog, f.archive, id, Buffer.alloc(32, 18))).rejects.toThrow(
    'BACKUP_MANIFEST_AUTHENTICATION_FAILED',
  );
  const [object] = f.records.values();
  object.data = Buffer.alloc(object.size, 5);
  await expect(verifyPrivateBackup(catalog, f.archive, id, key)).rejects.toThrow(
    'BACKUP_OBJECT_HASH_MISMATCH',
  );
});

test('capture rejects the working bucket or shared credentials as the independent store', () => {
  const working = {
    endpoint: new URL('https://source.example.invalid'),
    bucket: 'source',
    accessKeyId: 'fixture-source',
    secretAccessKey: 'source-fixture-key',
  };
  const archive = {
    endpoint: new URL('https://backup.example.invalid'),
    bucket: 'archive',
    accessKeyId: 'fixture-archive',
    secretAccessKey: 'archive-fixture-key',
  };
  expect(() =>
    verifyStoreSeparation(working, { ...archive, accessKeyId: working.accessKeyId }),
  ).toThrow('BACKUP_STORE_NOT_INDEPENDENT');
  expect(() =>
    verifyStoreSeparation(working, {
      ...archive,
      bucket: working.bucket,
    }),
  ).toThrow('BACKUP_STORE_NOT_INDEPENDENT');
  expect(() => verifyStoreSeparation(working, archive)).not.toThrow();
});

test('the S3 adapter requests create-only encryption and reads the recorded version', async () => {
  const send = jest
    .spyOn(S3Client.prototype, 'send')
    .mockResolvedValueOnce({ VersionId: 'copy-v1', ServerSideEncryption: 'AES256' })
    .mockResolvedValueOnce({
      VersionId: 'copy-v1',
      ServerSideEncryption: 'AES256',
      Body: Readable.from([bytes]),
      ContentLength: bytes.length,
    })
    .mockResolvedValueOnce({ VersionId: 'null', ServerSideEncryption: 'AES256' });
  const store = s3Files({
    endpoint: new URL('https://archive.example.invalid'),
    bucket: 'archive',
    region: 'eu-central-1',
    accessKeyId: 'fixture-key',
    secretAccessKey: 'fixture-secret',
  });
  try {
    await expect(
      store.put('test-key', bytes, bytes.length, 'application/octet-stream'),
    ).resolves.toBe('copy-v1');
    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'archive',
      Key: 'test-key',
      IfNoneMatch: '*',
      ServerSideEncryption: 'AES256',
    });
    const copy = await store.get('test-key', 'copy-v1');
    expect(send.mock.calls[1][0].input).toMatchObject({ VersionId: 'copy-v1' });
    expect(copy.encrypted).toBe(true);
    copy.body.destroy();
    await expect(
      store.put('second-key', bytes, bytes.length, 'application/octet-stream'),
    ).rejects.toThrow('BACKUP_DESTINATION_NOT_VERSIONED_OR_ENCRYPTED');
  } finally {
    send.mockRestore();
    store.close();
  }
});
