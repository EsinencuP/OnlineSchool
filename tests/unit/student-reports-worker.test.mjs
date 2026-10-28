import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { PdfExportWorker, PDF_LEASE_MS } from '../../apps/worker/dist/pdf-exports.js';
import { WorkerLifecycle } from '../../apps/worker/dist/worker.module.js';
import { educationPdfFixture, fixtureIds as ids } from '../support/education-pdf-fixture.mjs';
let db, state, worker, storage, me, render, clock, projection;
const copy = (x) => structuredClone(x);
beforeEach(() => {
  clock = new Date('2026-10-27T12:00:00Z');
  const sample = educationPdfFixture();
  projection = {
    forbidden: false,
    skills: sample.skills,
    lessons: sample.lessons,
    reports: sample.reports.map((r) => ({
      ...r,
      periodFrom: r.periodFrom + 'T00:00:00Z',
      periodTo: r.periodTo + 'T00:00:00Z',
    })),
  };
  state = {
    job: {
      id: ids.job,
      type: 'student.education-pdf.generate.v1',
      status: 'PENDING',
      attempts: 0,
      max_attempts: 3,
      payload: { schemaVersion: 1, exportJobId: ids.job },
      next_run_at: clock,
      locked_by: null,
      locked_until: null,
      source_operation_id: randomUUID(),
    },
    pdf: {
      id: ids.job,
      student_id: ids.student,
      requested_by: ids.account,
      requested_at: clock,
      time_zone: 'Europe/Chisinau',
      selection: {},
      source_data: null,
      source_as_of: null,
      ready_at: null,
      object_key: null,
    },
    attempts: [],
    audit: [],
  };
  db = {
    $queryRaw: jest.fn(async (first) => {
      const sql = Array.isArray(first) ? first.join('?') : first.sql;
      if (sql.includes('SELECT clock_timestamp')) return [{ now: copy(clock) }];
      if (sql.includes('FROM job_records WHERE type='))
        return (['PENDING', 'RETRY_WAIT'].includes(state.job.status) &&
          state.job.next_run_at <= clock) ||
          (state.job.status === 'RUNNING' && state.job.locked_until <= clock)
          ? [{ id: ids.job }]
          : [];
      if (sql.includes('WITH published_reports')) return [copy(projection)];
      return [{ id: ids.job }];
    }),
    jobRecord: {
      findUniqueOrThrow: jest.fn(async () => copy(state.job)),
      update: jest.fn(async ({ data }) => {
        const update = { ...data };
        if (update.attempts?.increment)
          update.attempts = state.job.attempts + update.attempts.increment;
        Object.assign(state.job, update);
        return copy(state.job);
      }),
    },
    pdfExportJob: {
      findUnique: jest.fn(async () => copy(state.pdf)),
      findUniqueOrThrow: jest.fn(async () => copy(state.pdf)),
      update: jest.fn(async ({ data }) => {
        Object.assign(state.pdf, copy(data));
        return copy(state.pdf);
      }),
    },
    jobAttempt: {
      create: jest.fn(async ({ data }) => {
        state.attempts.push(copy(data));
        return data;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const a of state.attempts)
          if (
            a.job_id === where.job_id &&
            (!where.attempt_no || a.attempt_no === where.attempt_no) &&
            !a.finished_at
          ) {
            Object.assign(a, copy(data));
            count++;
          }
        return { count };
      }),
    },
    auditEvent: {
      createMany: jest.fn(async ({ data }) => {
        for (const row of data)
          if (!state.audit.some((a) => a.event_key === row.event_key)) state.audit.push(copy(row));
        return { count: 1 };
      }),
    },
  };
  db.$transaction = jest.fn(async (fn) => {
    const before = copy(state);
    try {
      const result = await fn(db);
      if (state.ambiguousCommit) {
        state.ambiguousCommit = false;
        throw Object.assign(Error('commit acknowledgement lost'), { committed: true });
      }
      return result;
    } catch (error) {
      if (!error.committed) state = before;
      throw error;
    }
  });
  me = {
    load: jest.fn(async () => ({
      ok: true,
      value: {
        context: {
          studentProfileId: ids.student,
          mustChangePassword: false,
          hasActiveAccess: true,
        },
        me: { displayName: sample.studentName },
      },
    })),
  };
  storage = {
    bucket: jest.fn(() => 'school-files'),
    putPdf: jest.fn(async () => {}),
    deletePdf: jest.fn(async () => {}),
  };
  render = jest.fn(async () => Buffer.from('%PDF-1.7\nfixture renderer\n%%EOF'));
  worker = new PdfExportWorker(db, me, storage, render);
});
test('committed claim reserves an attempt and an unpredictable attempt-specific object', async () => {
  const claim = await worker.claim();
  expect(state.job).toMatchObject({ status: 'RUNNING', attempts: 1, locked_by: claim.token });
  expect(+state.job.locked_until - +clock).toBe(PDF_LEASE_MS);
  expect(state.attempts).toHaveLength(1);
  expect(claim.attemptKey).toBe(`student-exports/${ids.job}/${claim.token}.pdf`);
  expect(storage.putPdf).not.toHaveBeenCalled();
});
test('complete pipeline freezes source, renders, uploads and atomically publishes one hour of access', async () => {
  expect(await worker.processDue()).toBe(1);
  expect(state.job.status).toBe('SUCCEEDED');
  expect(state.pdf.ready_at).toEqual(clock);
  expect(+state.pdf.expires_at - +state.pdf.ready_at).toBe(3600000);
  expect(storage.putPdf.mock.calls[0][2].subarray(0, 5).toString()).toBe('%PDF-');
  expect(state.pdf.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(state.attempts[0].result).toBe('SUCCEEDED');
  expect(state.audit[0].action).toBe('student.pdf.ready');
  expect(storage.deletePdf).not.toHaveBeenCalled();
});
test('render failure is retryable, safely classified and contains no provider/private error text', async () => {
  render.mockRejectedValue(Error('SECRET STUDENT NAME https://secret.invalid/token'));
  await worker.processDue();
  expect(state.job).toMatchObject({
    status: 'RETRY_WAIT',
    last_error_code: 'PDF_GENERATION_FAILED',
  });
  expect(state.attempts[0].error).toBe('PDF_GENERATION_FAILED');
  expect(storage.putPdf).not.toHaveBeenCalled();
  expect(JSON.stringify(state)).not.toContain('SECRET STUDENT NAME');
});
test('retry uses the frozen projection instead of pulling changed history again', async () => {
  render.mockRejectedValueOnce(Error('render transient'));
  await worker.processDue();
  const original = copy(state.pdf.source_data),
    sourceReads = db.$queryRaw.mock.calls.filter(([q]) =>
      q.sql?.includes('WITH published_reports'),
    ).length;
  clock = new Date(+clock + 5000);
  projection.skills = [];
  expect(await worker.processDue()).toBe(1);
  expect(state.job.status).toBe('SUCCEEDED');
  expect(render.mock.calls[1][0]).toEqual(original);
  expect(
    db.$queryRaw.mock.calls.filter(([q]) => q.sql?.includes('WITH published_reports')),
  ).toHaveLength(sourceReads);
});
test('storage failure never marks READY and cleans only an unpublished attempt', async () => {
  storage.putPdf.mockRejectedValue(Error('private signed URL'));
  await worker.processDue();
  expect(state.job).toMatchObject({
    status: 'RETRY_WAIT',
    last_error_code: 'PDF_STORAGE_UNAVAILABLE',
  });
  expect(state.pdf.ready_at).toBeNull();
  expect(storage.deletePdf).toHaveBeenCalledTimes(1);
});
test('late attempt cannot publish after another worker obtains a new fencing token', async () => {
  storage.putPdf.mockImplementation(async () => {
    state.job.locked_by = randomUUID();
    state.job.attempts = 2;
  });
  await worker.processDue();
  expect(state.job.status).toBe('RUNNING');
  expect(state.pdf.ready_at).toBeNull();
  expect(storage.deletePdf).toHaveBeenCalledTimes(1);
  expect(state.attempts[0].result).toBeUndefined();
});
test('expired lease cannot publish or generate a download lifetime', async () => {
  storage.putPdf.mockImplementation(async () => {
    clock = new Date(+clock + PDF_LEASE_MS + 1);
  });
  await worker.processDue();
  expect(state.pdf.ready_at).toBeNull();
  expect(state.pdf.expires_at).toBeUndefined();
  expect(state.job.status).toBe('RUNNING');
  expect(storage.deletePdf).toHaveBeenCalledTimes(1);
});
test('lost commit acknowledgement preserves a successfully published object', async () => {
  const update = db.jobRecord.update;
  update.mockImplementation(async ({ data }) => {
    const changes = { ...data };
    if (changes.attempts?.increment)
      changes.attempts = state.job.attempts + changes.attempts.increment;
    Object.assign(state.job, changes);
    if (data.status === 'SUCCEEDED') state.ambiguousCommit = true;
    return copy(state.job);
  });
  await worker.processDue();
  expect(state.job.status).toBe('SUCCEEDED');
  expect(state.pdf.object_key).not.toBeNull();
  expect(storage.deletePdf).not.toHaveBeenCalled();
});
test('access revoked before generation permanently fails without rendering or storage', async () => {
  me.load.mockResolvedValue({
    ok: true,
    value: {
      context: { studentProfileId: ids.student, mustChangePassword: false, hasActiveAccess: false },
    },
  });
  await worker.processDue();
  expect(state.job).toMatchObject({
    status: 'FAILED',
    last_error_code: 'PDF_EXPORT_ACCESS_REVOKED',
  });
  expect(render).not.toHaveBeenCalled();
  expect(storage.putPdf).not.toHaveBeenCalled();
});
test('access revoked after upload prevents publication and cleans that private object', async () => {
  storage.putPdf.mockImplementation(async () => {
    me.load.mockResolvedValue({
      ok: true,
      value: {
        context: {
          studentProfileId: ids.student,
          mustChangePassword: false,
          hasActiveAccess: false,
        },
      },
    });
  });
  await worker.processDue();
  expect(state.job.status).toBe('FAILED');
  expect(state.pdf.ready_at).toBeNull();
  expect(storage.deletePdf).toHaveBeenCalledTimes(1);
});
test('size limit is terminal and does not loop on identical source', async () => {
  render.mockRejectedValue(Error('PDF_EXPORT_SIZE_LIMIT'));
  await worker.processDue();
  expect(state.job).toMatchObject({ status: 'FAILED', last_error_code: 'PDF_EXPORT_SIZE_LIMIT' });
  expect(storage.putPdf).not.toHaveBeenCalled();
});
test('exhausted expired lease settles the unfinished attempt and fails visibly', async () => {
  state.job.status = 'RUNNING';
  state.job.attempts = 3;
  state.job.locked_by = 'old';
  state.job.locked_until = new Date(+clock - 1);
  state.attempts = [{ job_id: ids.job, attempt_no: 3 }];
  expect(await worker.claim()).toBeNull();
  expect(state.job.status).toBe('FAILED');
  expect(state.attempts[0]).toMatchObject({ result: 'FAILED', error: 'LEASE_EXPIRED' });
});
test('stop prevents new claims and drains an in-flight render into retry state', async () => {
  render.mockImplementation(async (_data, signal) => {
    worker.stop();
    if (signal.aborted) throw Error('aborted');
    return Buffer.alloc(0);
  });
  await worker.processDue();
  expect(state.job).toMatchObject({ status: 'RETRY_WAIT', last_error_code: 'WORKER_STOPPED' });
  const count = db.$transaction.mock.calls.length;
  expect(await worker.processDue()).toBe(0);
  expect(db.$transaction).toHaveBeenCalledTimes(count);
});
test('lease clock is read after the row lock, so waiting past expiry cannot publish', async () => {
  const claim = await worker.claim();
  await worker.freeze(claim);
  const previous = db.$queryRaw.getMockImplementation();
  db.$queryRaw.mockImplementation(async (first, ...args) => {
    const sql = Array.isArray(first) ? first.join('?') : first.sql;
    if (sql.includes('WHERE id=') && sql.includes('FOR UPDATE'))
      clock = new Date(+clock + PDF_LEASE_MS + 1);
    return previous(first, ...args);
  });
  expect(await worker.finish(claim, 'school-files', 10, 'a'.repeat(64))).toBe(false);
  expect(state.pdf.ready_at).toBeNull();
});
test('long PDF work does not block finance/schedule polling, and shutdown drains it', async () => {
  const processors = Array.from({ length: 3 }, () => ({
    enabled: jest.fn(async () => ({ ok: true, value: 0 })),
  }));
  const lifecycle = new WorkerLifecycle(...processors, me, storage, new Map());
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  lifecycle.pdf = { processDue: jest.fn(() => pending), stop: jest.fn(() => finish(0)) };
  await lifecycle.process();
  await lifecycle.process();
  expect(processors[0].enabled).toHaveBeenCalledTimes(2);
  expect(processors[1].enabled).toHaveBeenCalledTimes(2);
  expect(lifecycle.pdf.processDue).toHaveBeenCalledTimes(1);
  await lifecycle.onModuleDestroy();
  expect(lifecycle.pdf.stop).toHaveBeenCalledTimes(1);
});
