import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { addAbortSignal, Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createDirectClient } from '@online-school/db';
import { assessRecoveryReport, readRecoverySnapshot } from './database-recovery-audit.mjs';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const sha256 = /^[0-9a-f]{64}$/;
const maxManifestBytes = 32 * 1024 * 1024;
const objectKey = (id, file) => `recovery/${id}/files/${file}`;
const manifestKey = (id) => `recovery/${id}/manifest.json`;
class BackupError extends Error {}

function validFile(row) {
  return (
    row &&
    typeof row.id === 'string' &&
    uuid.test(row.id) &&
    typeof row.key === 'string' &&
    row.key.length > 0 &&
    typeof row.bucket === 'string' &&
    row.bucket.length > 0 &&
    typeof row.mime === 'string' &&
    row.mime.length > 0 &&
    Number.isSafeInteger(row.size) &&
    row.size >= 0 &&
    row.size <= 5_000_000_000 &&
    (row.sha256 === null || (typeof row.sha256 === 'string' && sha256.test(row.sha256)))
  );
}

export async function readBackupCatalog(db) {
  return db.$transaction(
    async (tx) => {
      const database = await readRecoverySnapshot(tx);
      const files = await tx.$queryRaw`SELECT id,bucket,key,size,content_type AS mime,sha256
      FROM public.s3_objects WHERE status='VERIFIED' ORDER BY id`;
      const [counts] = await tx.$queryRaw`SELECT
      (SELECT count(*)::int FROM public.s3_objects WHERE status IN ('PENDING','UPLOADED','QUARANTINED')) AS incomplete,
      (SELECT count(*)::int FROM public.file_permissions p JOIN public.s3_objects o ON o.id=p.s3_object_id
        WHERE p.revoked_at IS NULL AND p.granted_at<=transaction_timestamp()
          AND (p.expires_at IS NULL OR p.expires_at>transaction_timestamp()) AND o.status<>'VERIFIED') AS unavailable`;
      return {
        database,
        files: files.map((row) => ({ ...row, size: Number(row.size) })),
        incomplete: counts.incomplete,
        unavailable: counts.unavailable,
      };
    },
    { maxWait: 5_000, timeout: 30_000 },
  );
}

function openS3(env, prefix) {
  const bucket = env[prefix + 'BUCKET'];
  const region = env[prefix + 'REGION'];
  const accessKeyId = env[prefix + 'ACCESS_KEY'];
  const secretAccessKey = env[prefix + 'SECRET_KEY'];
  let endpoint;
  try {
    endpoint = new URL(env[prefix + 'ENDPOINT']);
  } catch {
    throw new BackupError('BACKUP_S3_CONFIGURATION_INVALID');
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !bucket ||
    !region ||
    !accessKeyId ||
    !secretAccessKey
  )
    throw new BackupError('BACKUP_S3_CONFIGURATION_INVALID');
  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}

export function verifyStoreSeparation(working, archive) {
  if (
    working.accessKeyId === archive.accessKeyId ||
    working.secretAccessKey === archive.secretAccessKey ||
    working.bucket === archive.bucket
  ) {
    throw new BackupError('BACKUP_STORE_NOT_INDEPENDENT');
  }
}

export function s3Files(config) {
  const { endpoint, bucket: Bucket, region, accessKeyId, secretAccessKey } = config;
  const client = new S3Client({
    endpoint: endpoint.href,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 1,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    requestHandler: { connectionTimeout: 5000 },
  });
  return {
    bucket: Bucket,
    close: () => client.destroy(),
    async get(Key, VersionId) {
      const signal = AbortSignal.timeout(120_000);
      const result = await client.send(new GetObjectCommand({ Bucket, Key, VersionId }), {
        abortSignal: signal,
      });
      if (!(result.Body instanceof Readable)) throw new BackupError('BACKUP_STREAM_UNAVAILABLE');
      return {
        body: addAbortSignal(signal, result.Body),
        size: result.ContentLength,
        mime: result.ContentType,
        version: result.VersionId,
        encrypted: result.ServerSideEncryption === 'AES256',
      };
    },
    async put(Key, body, size, mime) {
      const result = await client.send(
        new PutObjectCommand({
          Bucket,
          Key,
          Body: body,
          ContentLength: size,
          ContentType: mime,
          IfNoneMatch: '*',
          ServerSideEncryption: 'AES256',
        }),
        { abortSignal: AbortSignal.timeout(120_000) },
      );
      if (
        !result.VersionId ||
        result.VersionId === 'null' ||
        result.ServerSideEncryption !== 'AES256'
      ) {
        throw new BackupError('BACKUP_DESTINATION_NOT_VERSIONED_OR_ENCRYPTED');
      }
      return result.VersionId;
    },
  };
}

async function* checkedStream(body, size, hash) {
  let total = 0;
  try {
    for await (const bytes of body) {
      total += bytes.length;
      if (total > size) throw new BackupError('BACKUP_SIZE_MISMATCH');
      hash?.update(bytes);
      yield bytes;
    }
    if (size !== total) throw new BackupError('BACKUP_SIZE_MISMATCH');
  } finally {
    body.destroy();
  }
}

async function checkObject(archive, id, row) {
  const object = await archive.get(objectKey(id, row.id), row.archiveVersion);
  try {
    if (object.size !== row.size || !object.encrypted || object.version !== row.archiveVersion) {
      throw new BackupError('BACKUP_OBJECT_METADATA_MISMATCH');
    }
    const digest = createHash('sha256');
    for await (const chunk of checkedStream(object.body, row.size)) digest.update(chunk);
    if (digest.digest('hex') !== row.digest) throw new BackupError('BACKUP_OBJECT_HASH_MISMATCH');
  } finally {
    object.body.destroy();
  }
}

function envelope(manifest, key) {
  const body = JSON.stringify(manifest);
  const content = Buffer.from(
    JSON.stringify({ body, mac: createHmac('sha256', key).update(body).digest('hex') }),
  );
  if (content.length > maxManifestBytes) throw new BackupError('BACKUP_MANIFEST_TOO_LARGE');
  return content;
}

async function readManifest(archive, id, key, version) {
  if (!uuid.test(id)) throw new BackupError('BACKUP_ID_INVALID');
  const record = await archive.get(manifestKey(id), version);
  try {
    if (
      !record.encrypted ||
      !record.version ||
      record.version === 'null' ||
      (version && record.version !== version) ||
      !Number.isSafeInteger(record.size) ||
      record.size < 1 ||
      record.size > maxManifestBytes
    ) {
      throw new BackupError('BACKUP_MANIFEST_INVALID');
    }
    const chunks = [];
    for await (const part of checkedStream(record.body, record.size)) chunks.push(part);
    const { body, mac } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (
      typeof body !== 'string' ||
      typeof mac !== 'string' ||
      !sha256.test(mac) ||
      !timingSafeEqual(Buffer.from(mac, 'hex'), createHmac('sha256', key).update(body).digest())
    ) {
      throw new BackupError('BACKUP_MANIFEST_AUTHENTICATION_FAILED');
    }
    const manifest = JSON.parse(body);
    if (
      (manifest.format !== 1 && manifest.format !== 2) ||
      (manifest.format === 2 &&
        assessRecoveryReport(manifest.database).status !== 'INVARIANTS_OK') ||
      manifest.id !== id ||
      !Array.isArray(manifest.files) ||
      manifest.files.some(
        (row) =>
          !validFile(row) ||
          !sha256.test(row.digest) ||
          typeof row.archiveVersion !== 'string' ||
          !row.archiveVersion ||
          row.archiveVersion === 'null',
      )
    ) {
      throw new BackupError('BACKUP_MANIFEST_INVALID');
    }
    return manifest;
  } finally {
    record.body.destroy();
  }
}

export async function capturePrivateBackup(catalog, working, archive, key) {
  const database = assessRecoveryReport(catalog.database);
  if (database.status !== 'INVARIANTS_OK')
    throw new BackupError('BACKUP_DATABASE_INVARIANTS_FAILED');
  if (
    catalog.files.some((row) => !validFile(row) || row.bucket !== working.bucket) ||
    new Set(catalog.files.map((row) => row.id)).size !== catalog.files.length
  ) {
    throw new BackupError('BACKUP_CATALOG_INVALID');
  }
  const id = randomUUID();
  const files = [];
  for (const row of catalog.files) {
    const source = await working.get(row.key);
    try {
      if (source.size !== row.size || source.mime !== row.mime)
        throw new BackupError('BACKUP_SOURCE_METADATA_MISMATCH');
      const hash = createHash('sha256');
      const stream = Readable.from(checkedStream(source.body, row.size, hash));
      let archiveVersion;
      try {
        archiveVersion = await archive.put(
          objectKey(id, row.id),
          stream,
          row.size,
          'application/octet-stream',
        );
      } finally {
        stream.destroy();
      }
      const digest = hash.digest('hex');
      if (row.sha256 && row.sha256 !== digest) throw new BackupError('BACKUP_SOURCE_HASH_MISMATCH');
      const saved = { ...row, digest, sourceVersion: source.version ?? null, archiveVersion };
      await checkObject(archive, id, saved);
      files.push(saved);
    } finally {
      source.body.destroy();
    }
  }
  const manifest = envelope({ format: 2, id, takenAt: database.checkedAt, database, files }, key);
  const manifestVersion = await archive.put(
    manifestKey(id),
    manifest,
    manifest.length,
    'application/json',
  );
  await readManifest(archive, id, key, manifestVersion);
  return {
    status: 'FILES_CAPTURED',
    id,
    files: files.length,
    incomplete: catalog.incomplete,
    unavailable: catalog.unavailable,
  };
}

export async function verifyPrivateBackup(catalog, archive, id, key) {
  const manifest = await readManifest(archive, id, key);
  const current = new Map(catalog.files.map((row) => [row.id, row]));
  const saved = new Map(manifest.files.map((row) => [row.id, row]));
  if (
    saved.size !== manifest.files.length ||
    current.size !== catalog.files.length ||
    catalog.files.some((row) => !validFile(row))
  )
    throw new BackupError('BACKUP_CATALOG_INVALID');
  let missing = 0,
    extra = 0,
    changed = 0;
  for (const row of current.values()) {
    const copy = saved.get(row.id);
    if (!copy) missing++;
    else if (
      row.bucket !== copy.bucket ||
      row.key !== copy.key ||
      row.size !== copy.size ||
      row.mime !== copy.mime ||
      (row.sha256 !== null && row.sha256 !== copy.digest)
    )
      changed++;
  }
  for (const row of saved.values()) if (!current.has(row.id)) extra++;
  if (missing || extra || changed || catalog.unavailable) {
    return {
      status: 'CATALOG_MISMATCH',
      missing,
      extra,
      changed,
      unavailable: catalog.unavailable,
    };
  }
  if (manifest.format === 2) {
    const recovery = assessRecoveryReport(catalog.database, manifest.database);
    if (recovery.status !== 'CHECKPOINT_MATCH') {
      return {
        status: 'DATABASE_MISMATCH',
        checks: recovery.checks,
        schemaMatches: recovery.schemaMatches,
        changedChecks: recovery.changedChecks,
        changedDatasets: recovery.changedDatasets,
      };
    }
  }
  for (const row of saved.values()) await checkObject(archive, id, row);
  return {
    status: 'FILES_VERIFIED',
    id,
    files: saved.size,
    incomplete: catalog.incomplete,
    databaseCheckpointMatched: manifest.format === 2,
  };
}

async function main(env, [mode, id, ...extra]) {
  if (
    extra.length ||
    (mode === 'capture' ? id !== undefined : mode !== 'verify' || !uuid.test(id ?? ''))
  ) {
    throw new BackupError('BACKUP_ARGUMENTS_INVALID');
  }
  const key = Buffer.from(env.BACKUP_MANIFEST_KEY ?? '', 'base64');
  if (key.length !== 32 || key.toString('base64') !== env.BACKUP_MANIFEST_KEY)
    throw new BackupError('BACKUP_MANIFEST_KEY_INVALID');
  const destination = openS3(env, 'BACKUP_S3_');
  const source = mode === 'capture' ? openS3(env, 'S3_') : null;
  if (source) verifyStoreSeparation(source, destination);
  const connection = createDirectClient({ DIRECT_URL: env.BACKUP_DB_URL });
  if (!connection.ok) throw new BackupError('BACKUP_DATABASE_CONFIGURATION_INVALID');
  const db = connection.value;
  const archive = s3Files(destination);
  const working = source ? s3Files(source) : null;
  try {
    const catalog = await readBackupCatalog(db);
    return working
      ? await capturePrivateBackup(catalog, working, archive, key)
      : await verifyPrivateBackup(catalog, archive, id, key);
  } finally {
    working?.close();
    archive.close();
    await db.$disconnect().catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await main(process.env, process.argv.slice(2));
    console.log(JSON.stringify(result));
    if (result.status === 'CATALOG_MISMATCH' || result.status === 'DATABASE_MISMATCH') {
      process.exitCode = 1;
    }
  } catch (error) {
    const code = error instanceof BackupError ? error.message : 'BACKUP_OPERATION_FAILED';
    console.error(JSON.stringify({ status: 'ERROR', code }));
    process.exitCode = 2;
  }
}
