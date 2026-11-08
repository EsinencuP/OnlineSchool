import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { AppException, domainError } from '../../apps/api/dist/core/errors/domain-error.js';
import { StudentReportsService } from '../../apps/api/dist/student/reports/reports.service.js';
import {
  exportSelection,
  ReportsQueryPipe,
} from '../../apps/api/dist/student/reports/reports.dto.js';
import {
  normalizeReport,
  selectionBounds,
} from '../../apps/api/dist/student/reports/export-data.js';
import {
  PrivateUploads,
  PDF_READ_TTL_SECONDS,
  READ_TTL_SECONDS,
} from '../../apps/api/dist/modules/storage/private-uploads.service.js';
import { educationPdfFixture, fixtureIds as ids } from '../support/education-pdf-fixture.mjs';
const ready = new Date('2026-10-27T12:00:00.000Z'),
  student = {
    userId: ids.account,
    studentProfileId: ids.student,
    mustChangePassword: false,
    hasActiveAccess: true,
    timeZone: 'Europe/Chisinau',
    subjectIds: [ids.subject],
  };
let db, storage, me, service, job;
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(ready);
  job = {
    id: ids.job,
    student_id: ids.student,
    requested_by: ids.account,
    ready_at: ready,
    expires_at: new Date(+ready + 3600000),
    bucket: 'school-files',
    object_key: `student-exports/${ids.job}/${ids.subject}.pdf`,
    job_ref: { status: 'SUCCEEDED' },
  };
  db = {
    $queryRaw: jest.fn(async () => [{ now: new Date(), id: ids.subject }]),
    pdfExportJob: {
      findFirst: jest.fn(async () => job),
      count: jest.fn(async () => 0),
      create: jest.fn(async ({ data }) => data),
    },
    jobRecord: { create: jest.fn(async ({ data }) => data) },
    educationReportRead: { createMany: jest.fn(async () => ({ count: 1 })) },
    studentSubjectEnrollment: { findFirst: jest.fn(async () => ({ id: ids.subject })) },
  };
  me = { load: jest.fn(async () => ({ ok: true, value: { context: student } })) };
  storage = {
    signPdf: jest.fn(async () => 'https://storage.example.invalid/signed'),
    bucket: jest.fn(() => 'school-files'),
  };
  service = new StudentReportsService({ client: db }, me, storage);
});
afterEach(() => jest.useRealTimers());
const ctx = () => ({
  tx: db,
  actor: { accountId: ids.account },
  operationId: randomUUID(),
  requestId: randomUUID(),
});
test('report pagination defaults to ten and respects explicit bounds', () => {
  expect(new ReportsQueryPipe().transform({})).toEqual({ page: 1, pageSize: 10 });
  expect(new ReportsQueryPipe().transform({ page: '2', pageSize: '100' })).toEqual({
    page: 2,
    pageSize: 100,
  });
});
test.each([{ page: '0' }, { pageSize: '101' }, { page: '1e2' }, { studentId: ids.other }])(
  'invalid report query %j',
  (input) => expect(() => new ReportsQueryPipe().transform(input)).toThrow(),
);
test('optional export selection normalizes owned UUID and inclusive calendar dates', () => {
  expect(exportSelection(undefined)).toEqual({});
  expect(
    exportSelection({ subjectId: ids.subject, periodFrom: '2026-10-01', periodTo: '2026-10-27' }),
  ).toEqual({ subjectId: ids.subject, periodFrom: '2026-10-01', periodTo: '2026-10-27' });
});
test.each([
  { studentProfileId: ids.other },
  { subjectId: 'bad' },
  { periodFrom: '2026-02-30' },
  { periodTo: '2026-10-27T00:00:00Z' },
  { periodFrom: '2026-10-28', periodTo: '2026-10-27' },
  { periodTo: ['2026-10-27'] },
])('invalid export selection %j', (input) => expect(() => exportSelection(input)).toThrow());
test('inclusive date bounds handle the 25-hour Chisinau DST day', () => {
  const bounds = selectionBounds(
    { periodFrom: '2026-10-25', periodTo: '2026-10-25' },
    'Europe/Chisinau',
  );
  expect(+bounds.until - +bounds.from).toBe(25 * 3600000);
});
test('normalization exposes only four public fields and date-only periods', () => {
  const input = {
    ...educationPdfFixture().reports[0],
    periodFrom: '2026-09-01T00:00:00Z',
    periodTo: '2026-09-30T00:00:00Z',
    internalNote: 'PRIVATE',
    content: { ...educationPdfFixture().reports[0].content, internalNote: 'PRIVATE' },
  };
  const result = normalizeReport(input, 'Europe/Chisinau');
  expect(result.periodFrom).toBe('2026-09-01');
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
  expect(Object.keys(result.content)).toEqual([
    'achievements',
    'growthAreas',
    'recommendations',
    'teacherSignature',
  ]);
});
test('foreign and nonexistent job use same forbidden response with a server ownership predicate', async () => {
  db.pdfExportJob.findFirst.mockResolvedValue(null);
  await expect(service.status(student, ids.job)).rejects.toMatchObject({
    domain: { status: 403, code: 'PDF_JOB_FORBIDDEN' },
  });
  expect(db.pdfExportJob.findFirst.mock.calls[0][0].where).toEqual({
    id: ids.job,
    student_id: ids.student,
    requested_by: ids.account,
  });
  expect(storage.signPdf).not.toHaveBeenCalled();
});
test.each([
  ['PENDING', 'QUEUED'],
  ['RETRY_WAIT', 'QUEUED'],
  ['RUNNING', 'PROCESSING'],
  ['FAILED', 'FAILED'],
  ['CANCELLED', 'FAILED'],
])('job state %s maps to %s without a download', async (state, expected) => {
  job.job_ref.status = state;
  const result = await service.status(student, ids.job);
  expect(result.status).toBe(expected);
  expect(result.downloadUrl).toBeNull();
  expect(storage.signPdf).not.toHaveBeenCalled();
});
test('READY polls retain the original one-hour deadline and signing date', async () => {
  const first = await service.status(student, ids.job);
  jest.setSystemTime(+ready + 3599000);
  const later = await service.status(student, ids.job);
  expect(first.status).toBe('READY');
  expect(later.expiresAt).toBe(first.expiresAt);
  expect(storage.signPdf.mock.calls[1][0]).toMatchObject({ signingDate: ready, expiresIn: 3600 });
});
test.each([3600000, 3600001, 7200000])(
  'expired at +%ims cannot reissue a capability',
  async (ms) => {
    jest.setSystemTime(+ready + ms);
    expect(await service.status(student, ids.job)).toMatchObject({
      status: 'FAILED',
      downloadUrl: null,
      failureReason: 'PDF_EXPORT_EXPIRED',
    });
    expect(storage.signPdf).not.toHaveBeenCalled();
  },
);
test('failure reason never exposes database/provider URLs or raw job error', async () => {
  job.job_ref = {
    status: 'FAILED',
    last_error_code: 'https://secret.example.invalid/?token=PRIVATE',
  };
  const result = await service.status(student, ids.job);
  expect(result.failureReason).toBe('PDF_EXPORT_FAILED');
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
});
test('expiry reached during signing is presented as expired, not a fresh link or a 409', async () => {
  jest.setSystemTime(+ready + 3599999);
  storage.signPdf.mockRejectedValue(new AppException(domainError('PDF_EXPORT_EXPIRED', 409)));
  expect(await service.status(student, ids.job)).toMatchObject({
    status: 'FAILED',
    downloadUrl: null,
    failureReason: 'PDF_EXPORT_EXPIRED',
  });
});
test('worker PDF upload is private and create-only', async () => {
  const adapter = new PrivateUploads(),
    send = jest.fn(async () => ({}));
  adapter.connection = { send };
  await adapter.putPdf('school-files', job.object_key, Buffer.from('%PDF'), 'a'.repeat(64));
  expect(send.mock.calls[0][0].input).toMatchObject({
    IfNoneMatch: '*',
    ContentType: 'application/pdf',
    CacheControl: 'private, no-store',
  });
  expect(send.mock.calls[0][0].input.ACL).toBeUndefined();
});
test('ambiguous upload acknowledgement resolves only the same object and its exact metadata', async () => {
  const adapter = new PrivateUploads(),
    bytes = Buffer.from('%PDF');
  const send = jest
    .fn()
    .mockRejectedValueOnce(Error('response lost'))
    .mockResolvedValueOnce({
      ContentLength: bytes.length,
      ContentType: 'application/pdf',
      Metadata: { sha256: 'a'.repeat(64) },
    });
  adapter.connection = { send };
  await expect(
    adapter.putPdf('school-files', job.object_key, bytes, 'a'.repeat(64)),
  ).resolves.toBeUndefined();
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][0].constructor.name).toBe('HeadObjectCommand');
});
test('enqueue creates a job and ownership row, with no source rendering or signed URL in the command result', async () => {
  const c = ctx(),
    result = await service.enqueue(c, student, {});
  expect(result).toMatchObject({
    status: 'QUEUED',
    estimatedReadyAt: new Date(+ready + 30000).toISOString(),
  });
  expect(db.jobRecord.create.mock.calls[0][0].data).toMatchObject({
    id: result.jobId,
    type: 'student.education-pdf.generate.v1',
    retry_policy: 'SAFE_RETRY',
    max_attempts: 3,
  });
  expect(db.pdfExportJob.create.mock.calls[0][0].data).toMatchObject({
    id: result.jobId,
    student_id: ids.student,
    requested_by: ids.account,
  });
  expect(JSON.stringify(result)).not.toContain('http');
});
test('limits two outstanding exports without creating work', async () => {
  db.pdfExportJob.count.mockResolvedValue(2);
  await expect(service.enqueue(ctx(), student, {})).rejects.toMatchObject({
    domain: { status: 429 },
  });
  expect(db.jobRecord.create).not.toHaveBeenCalled();
});
test('foreign subject cannot be exported', async () => {
  db.studentSubjectEnrollment.findFirst.mockResolvedValue(null);
  await expect(service.enqueue(ctx(), student, { subjectId: ids.subject })).rejects.toMatchObject({
    domain: { status: 403 },
  });
  expect(db.jobRecord.create).not.toHaveBeenCalled();
});
test.each([
  { mustChangePassword: true },
  { hasActiveAccess: false },
  { studentProfileId: ids.other },
])('command rechecks the current student context %j', async (patch) => {
  me.load.mockResolvedValue({ ok: true, value: { context: { ...student, ...patch } } });
  await expect(service.enqueue(ctx(), student, {})).rejects.toMatchObject({
    domain: { status: expect.any(Number) },
  });
  expect(db.jobRecord.create).not.toHaveBeenCalled();
});
test('first read returns true, semantic repeat false, keeping the original receipt', async () => {
  expect(await service.markRead(ctx(), student, ids.subject, {})).toBe(true);
  db.educationReportRead.createMany.mockResolvedValue({ count: 0 });
  expect(await service.markRead(ctx(), student, ids.subject, {})).toBe(false);
  expect(db.educationReportRead.createMany.mock.calls[0][0]).toMatchObject({
    skipDuplicates: true,
    data: [{ report_id: ids.subject, student_id: ids.student, read_by: ids.account }],
  });
});
test('foreign/unpublished report cannot be marked read', async () => {
  db.$queryRaw.mockImplementation(async (first) =>
    first.sql?.includes('SELECT id FROM published_reports') ? [] : [{ now: new Date() }],
  );
  await expect(service.markRead(ctx(), student, ids.subject, {})).rejects.toMatchObject({
    domain: { status: 403, code: 'REPORT_FORBIDDEN' },
  });
  expect(db.educationReportRead.createMany).not.toHaveBeenCalled();
});
test('real SDK signs only one-hour PDF URLs; material permissions keep their fifteen-minute cap', async () => {
  const previous = { ...process.env };
  Object.assign(process.env, {
    S3_ENDPOINT: 'https://storage.example.invalid',
    S3_REGION: 'eu-central-1',
    S3_ACCESS_KEY: 'TESTACCESSKEY',
    S3_SECRET_KEY: 'test-not-a-real-secret',
  });
  const adapter = new PrivateUploads();
  try {
    const input = {
      bucket: 'school-files',
      key: job.object_key,
      fileName: 'history.pdf',
      signingDate: ready,
      expiresIn: 3600,
    };
    const url = new URL(await adapter.signPdf(input));
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261027T120000Z');
    jest.setSystemTime(+ready + 1800000);
    expect(await adapter.signPdf(input)).toBe(url.toString());
    jest.setSystemTime(+ready + 3600000);
    await expect(adapter.signPdf(input)).rejects.toMatchObject({
      domain: { code: 'PDF_EXPORT_EXPIRED' },
    });
    expect(PDF_READ_TTL_SECONDS).toBe(3600);
    expect(READ_TTL_SECONDS).toBe(900);
    await expect(adapter.signRead({ ...input, canDownload: true })).rejects.toMatchObject({
      domain: { code: 'FILE_ACCESS_DENIED' },
    });
  } finally {
    adapter.onModuleDestroy();
    process.env = previous;
  }
});
