import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import {
  StudentHomeworkService,
  DRAFT_TTL_MS,
  homeworkProjectionSql,
} from '../../apps/api/dist/student/homework/homework.service.js';
import { HomeworkQueryPipe } from '../../apps/api/dist/student/homework/homework.dto.js';
import { HomeworkDraftExpiry } from '../../apps/api/dist/student/homework/draft-expiry.module.js';
import { PrivateUploads } from '../../apps/api/dist/modules/storage/private-uploads.service.js';
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { S3Client } = requireApi('@aws-sdk/client-s3');
const student = {
  userId: randomUUID(),
  studentProfileId: randomUUID(),
  hasActiveAccess: true,
  mustChangePassword: false,
  subjectIds: [],
};
const hwId = randomUUID(),
  now = new Date('2026-10-27T10:00:00Z');
let tx, service, storage, latest, review, draft, files, clock, delivery;
const expectCode = async (promise, code) => {
  await expect(promise).rejects.toMatchObject({ domain: { code } });
};
beforeEach(() => {
  latest = null;
  review = null;
  draft = null;
  files = [];
  clock = now;
  delivery = {
    id: hwId,
    student_id: student.studentProfileId,
    issued_at: new Date(+now - 86400000),
    due_at: new Date(+now - 1),
    cancelled_at: null,
    archived_at: null,
  };
  tx = {
    $queryRaw: jest.fn(async (first) => {
      const sql = Array.isArray(first) ? first.join('?') : first.sql;
      if (sql.includes('clock_timestamp() AS now')) return [{ now: clock }];
      if (sql.includes('FOR UPDATE OF d')) return [delivery];
      return [];
    }),
    homeworkDelivery: { findFirst: jest.fn(async () => ({ id: hwId })) },
    homeworkSubmission: {
      findFirst: jest.fn(async () => latest),
      create: jest.fn(async ({ data }) => {
        latest = data;
        return data;
      }),
    },
    submissionReview: { findFirst: jest.fn(async () => review) },
    homeworkDraft: {
      upsert: jest.fn(async ({ create, update }) => {
        draft = draft ? { ...draft, ...update } : create;
        return draft;
      }),
      updateMany: jest.fn(async ({ data }) => {
        draft = draft ? { ...draft, ...data } : null;
        return { count: draft ? 1 : 0 };
      }),
    },
    s3Object: { create: jest.fn(async ({ data }) => data), update: jest.fn(async () => {}) },
    homeworkUpload: {
      findMany: jest.fn(async () => files),
      findFirst: jest.fn(async () => files[0] ?? null),
      update: jest.fn(async () => {}),
    },
  };
  storage = {
    bucket: () => 'online-school-files',
    sign: jest.fn(async () => 'https://private.invalid/signed'),
    confirm: jest.fn(async () => {}),
  };
  service = new StudentHomeworkService(
    { client: tx },
    { load: async () => ({ ok: true, value: { context: student } }) },
    storage,
  );
});
afterEach(() => jest.restoreAllMocks());
test('newest-first query is student-scoped, paged and includes every version without grades or private keys', () => {
  const sql = homeworkProjectionSql(
    student.studentProfileId,
    { page: 2, pageSize: 20, status: 'NEEDS_REVISION' },
    now,
  );
  expect(sql.values).toContain(student.studentProfileId);
  expect(sql.values).toContain('NEEDS_REVISION');
  expect(sql.sql).toContain('ORDER BY issued_at DESC,id DESC');
  expect(sql.sql).toContain('ORDER BY h.version DESC');
  expect(sql.sql).not.toMatch(/\bgrade\b|uploadUrl|staging_key/);
  expect(sql.values.filter((x) => typeof x === 'number')).toEqual([20, 20]);
});
test.each(['NOT_SUBMITTED', 'SUBMITTED', 'REVIEWED', 'NEEDS_REVISION'])(
  'status query accepts %s',
  (status) =>
    expect(new HomeworkQueryPipe().transform({ status })).toEqual({
      page: 1,
      pageSize: 20,
      status,
    }),
);
test.each([
  { status: 'GRADED' },
  { page: '0' },
  { pageSize: '101' },
  { page: ['1'] },
  { studentId: randomUUID() },
])('invalid query rejected: %j', (input) =>
  expect(() => new HomeworkQueryPipe().transform(input)).toThrow(),
);
test('late first submission is accepted and clears draft plaintext in the same transaction', async () => {
  draft = { content: 'private draft' };
  const result = await service.submit({ tx, operationId: randomUUID() }, student, hwId, {
    content: '  answer\n',
  });
  expect(result).toMatchObject({ status: 'SUBMITTED', isLate: true, versionNumber: 1 });
  expect(result.submissionId).toBe(latest.id);
  expect(latest.content).toEqual({ text: '  answer\n' });
  expect(draft.content).toBe('');
  expect(draft.expires_at).toEqual(now);
});
test('no deadline does not mark a submission late', async () => {
  delivery.due_at = null;
  expect(
    (await service.submit({ tx, operationId: randomUUID() }, student, hwId, { content: 'ok' }))
      .isLate,
  ).toBe(false);
});
test('exact deadline is on time', async () => {
  delivery.due_at = now;
  expect(
    (await service.submit({ tx, operationId: randomUUID() }, student, hwId, { content: 'ok' }))
      .isLate,
  ).toBe(false);
});
test('NEEDS_REVISION creates version 2 linked to the previous immutable answer', async () => {
  const old = { id: randomUUID(), version: 1, content: { text: 'original' } };
  latest = old;
  review = { result: 'NEEDS_REVISION', comment: 'Explain why' };
  const result = await service.submit({ tx, operationId: randomUUID() }, student, hwId, {
    content: 'revision',
  });
  expect(result.versionNumber).toBe(2);
  expect(latest.supersedes_submission_id).toBe(old.id);
  expect(old.content.text).toBe('original');
  expect(review.comment).toBe('Explain why');
});
test.each([null, { result: 'ACCEPTED' }])(
  'submitted/reviewed homework rejects a new command',
  async (value) => {
    latest = { id: randomUUID(), version: 1 };
    review = value;
    await expectCode(
      service.submit({ tx }, student, hwId, { content: 'another' }),
      value ? 'HOMEWORK_ALREADY_REVIEWED' : 'ALREADY_SUBMITTED',
    );
    expect(tx.homeworkSubmission.create).not.toHaveBeenCalled();
  },
);
test('draft overwrite preserves whitespace, one identity and rolling 30-day server TTL', async () => {
  const ctx = { tx };
  await service.draft(ctx, student, hwId, { content: 'first' });
  clock = new Date(+now + 1000);
  const result = await service.draft(ctx, student, hwId, { content: ' \nsecond  ' });
  expect(draft.delivery_id).toBe(hwId);
  expect(draft.content).toBe(' \nsecond  ');
  expect(+new Date(result.expiresAt) - +clock).toBe(DRAFT_TTL_MS);
});
test('empty draft is allowed', async () => {
  await service.draft({ tx }, student, hwId, { content: '' });
  expect(draft.content).toBe('');
});
test.each([
  { content: 'x'.repeat(10001) },
  { content: 7 },
  { content: 'x', studentId: student.studentProfileId },
])('invalid drafts rejected', async (body) =>
  expectCode(service.draft({ tx }, student, hwId, body), 'INVALID_INPUT'),
);
test('foreign homework is forbidden before any write', async () => {
  delivery.student_id = randomUUID();
  await expectCode(service.draft({ tx }, student, hwId, { content: 'x' }), 'HOMEWORK_FORBIDDEN');
  expect(tx.homeworkDraft.upsert).not.toHaveBeenCalled();
});
test.each(['cancelled_at', 'archived_at'])(
  'withdrawn homework %s cannot be mutated',
  async (key) => {
    delivery[key] = now;
    await expectCode(
      service.submit({ tx }, student, hwId, { content: 'x' }),
      'HOMEWORK_UNAVAILABLE',
    );
  },
);
test('upload preparation persists only fileId and server-selected keys, exact metadata and PENDING default', async () => {
  const result = await service.prepareUpload({ tx, operationId: randomUUID() }, student, hwId, {
    fileName: 'answer.txt',
    mimeType: 'text/plain',
    fileSizeBytes: 8,
  });
  expect(Object.keys(result)).toEqual(['fileId']);
  const data = tx.s3Object.create.mock.calls[0][0].data;
  expect(data.size).toBe(8n);
  expect(data.uploaded_by).toBe(student.userId);
  expect(data.key).toBe(`homework/final/${result.fileId}`);
  expect(+data.homework_upload.create.expires_at - +now).toBe(900000);
  expect(data).not.toHaveProperty('uploadUrl');
});
test.each([
  { fileName: '../bad', mimeType: 'text/plain', fileSizeBytes: 8 },
  { fileName: 'x', mimeType: 'text/plain', fileSizeBytes: 52428801 },
  { fileName: 'x', mimeType: 'bad\r\nheader', fileSizeBytes: 8 },
  { fileName: 'x', mimeType: 'text/plain', fileSizeBytes: 0 },
])('unsafe upload metadata rejected', async (body) =>
  expectCode(
    service.prepareUpload({ tx }, student, hwId, body),
    body.fileSizeBytes <= 0 || body.fileSizeBytes > 52428800 ? 'INVALID_QUANTITY' : 'INVALID_INPUT',
  ),
);
test('pending or foreign attachments cannot enter a submission', async () => {
  await expectCode(
    service.submit({ tx }, student, hwId, { content: 'x', fileIds: [randomUUID()] }),
    'FILE_NOT_CONFIRMED',
  );
  expect(tx.homeworkSubmission.create).not.toHaveBeenCalled();
});
test('confirmed files are linked to the new version, not only to the delivery', async () => {
  const id = randomUUID();
  files = [{ file_id: id }];
  await service.submit({ tx, operationId: randomUUID() }, student, hwId, {
    content: 'x',
    fileIds: [id],
  });
  expect(latest.attachments).toEqual({ create: [{ file_id: id }] });
  expect(tx.homeworkUpload.findMany.mock.calls[0][0].where).toMatchObject({
    delivery_id: hwId,
    file: { uploaded_by: student.userId, status: 'VERIFIED' },
  });
});
test('a confirmed file is never copied again', async () => {
  const id = randomUUID();
  files = [{ file_id: id, confirmed_at: now, file: { status: 'VERIFIED' } }];
  expect(await service.confirm({ tx }, student, hwId, id)).toEqual({
    fileId: id,
    status: 'VERIFIED',
  });
  expect(storage.confirm).not.toHaveBeenCalled();
});
test('provider failure leaves confirmation and VERIFIED status unwritten', async () => {
  const id = randomUUID();
  files = [
    {
      file_id: id,
      staging_key: 'incoming',
      expires_at: now,
      file: {
        status: 'PENDING',
        size: 8n,
        bucket: 'bucket',
        key: 'final',
        content_type: 'text/plain',
      },
    },
  ];
  storage.confirm.mockRejectedValue(Error('unavailable'));
  await expect(service.confirm({ tx }, student, hwId, id)).rejects.toThrow();
  expect(tx.s3Object.update).not.toHaveBeenCalled();
  expect(tx.homeworkUpload.update).not.toHaveBeenCalled();
});
test('expired drafts are hidden by SQL and worker clears at most 100 plaintext rows with SKIP LOCKED', async () => {
  expect(
    homeworkProjectionSql(student.studentProfileId, { page: 1, pageSize: 20 }, now).sql,
  ).toContain('draft.expires_at>');
  const before = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'configured';
  try {
    const worker = new HomeworkDraftExpiry({
      runCritical: async (fn) => ({ ok: true, value: await fn(tx) }),
    });
    await worker.enabled();
    const sql = tx.$queryRaw.mock.calls.at(-1)[0].join('?');
    expect(sql).toContain('SKIP LOCKED LIMIT 100');
    expect(sql).toContain("SET content=''");
  } finally {
    if (before === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = before;
  }
});
const envNames = ['S3_BUCKET', 'S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'];
test('real AWS signer fixes 15-minute expiry and signs size + content type without a public ACL', async () => {
  const before = Object.fromEntries(envNames.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    S3_BUCKET: 'online-school-files',
    S3_ENDPOINT: 'https://storage.example.invalid',
    S3_REGION: 'eu-central-1',
    S3_ACCESS_KEY: 'test-key',
    S3_SECRET_KEY: 'test-secret',
  });
  try {
    const svc = new PrivateUploads(),
      input = {
        bucket: 'online-school-files',
        key: 'final/one',
        stagingKey: 'incoming/one',
        size: 8,
        mimeType: 'text/plain',
        expiresAt: new Date(Date.now() + 899000),
      };
    const first = await svc.sign(input),
      second = await svc.sign(input),
      url = new URL(first);
    expect(first).toBe(second);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length');
    expect(url.pathname).toBe('/online-school-files/incoming/one');
    expect(first).not.toContain('public-read');
    await expectCode(svc.sign({ ...input, expiresAt: new Date(0) }), 'UPLOAD_URL_EXPIRED');
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
test('HEAD checks actual bytes; conditional COPY seals final key and never exposes provider error details', async () => {
  const before = Object.fromEntries(envNames.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    S3_ENDPOINT: 'https://storage.example.invalid',
    S3_REGION: 'eu-central-1',
    S3_ACCESS_KEY: 'test-key',
    S3_SECRET_KEY: 'test-secret',
  });
  const send = jest
    .spyOn(S3Client.prototype, 'send')
    .mockResolvedValueOnce({ ContentLength: 8, ContentType: 'text/plain', ETag: '"etag"' })
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce({ ContentLength: 8, ContentType: 'text/plain' });
  const input = {
    bucket: 'online-school-files',
    key: 'final/one',
    stagingKey: 'incoming/one',
    size: 8,
    mimeType: 'text/plain',
    expiresAt: now,
  };
  try {
    await new PrivateUploads().confirm(input);
    expect(send.mock.calls[1][0].input).toMatchObject({
      Key: 'final/one',
      CopySourceIfMatch: '"etag"',
      ContentDisposition: 'attachment',
    });
    send.mockReset().mockResolvedValue({ ContentLength: 9, ContentType: 'text/plain' });
    await expectCode(new PrivateUploads().confirm(input), 'UPLOAD_METADATA_MISMATCH');
    expect(send).toHaveBeenCalledTimes(1);
    send.mockReset().mockRejectedValue(Error('secret signed credential'));
    await expectCode(new PrivateUploads().confirm(input), 'PRIVATE_STORAGE_UNAVAILABLE');
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
