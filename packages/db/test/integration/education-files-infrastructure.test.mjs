import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { createDirectClient } from '../../dist/index.js';
import { seedReferenceData } from '../../prisma/seed.mjs';
import {
  at,
  later,
  director,
  fundedSubscription,
  insert,
  lessonFixture,
} from './finance-fixtures.mjs';
import { LedgerPublicationService } from '../../../../apps/api/dist/modules/finance/ledger-publication.service.js';

const url = process.env.TEST_DATABASE_URL;
assert.ok(url);
const target = new URL(url);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_test[a-z0-9_]*$/);
const pool = new pg.Pool({ connectionString: url, max: 4 });
const connection = createDirectClient({ DIRECT_URL: url });
assert.equal(connection.ok, true);
const client = connection.value;
let period;
before(async () => {
  assert.equal(
    Math.floor(
      Number((await pool.query('SHOW server_version_num')).rows[0].server_version_num) / 10000,
    ),
    18,
  );
  period =
    (await pool.query("SELECT * FROM financial_periods WHERE starts_at='2000-01-01Z'")).rows[0] ??
    (await insert(pool, 'financial_periods', { starts_at: '2000-01-01Z', ends_at: '2100-01-01Z' }));
});
after(async () => {
  await client.$disconnect();
  await pool.end();
});
async function tx(run) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await run(db);
  } finally {
    await db.query('ROLLBACK');
    db.release();
  }
}
async function rejects(db, fn, constraint, code = '23514') {
  await db.query('SAVEPOINT expected_failure');
  try {
    await assert.rejects(fn(), (error) => {
      assert.equal(error.code, code);
      if (constraint) assert.equal(error.constraint, constraint);
      return true;
    });
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT expected_failure');
    await db.query('RELEASE SAVEPOINT expected_failure');
  }
}
async function seed(db) {
  const staff = await director(db);
  const child = await insert(db, 'students', { full_name: 'Synthetic education child' }, false);
  return { staff, child, ...(await fundedSubscription(db, staff.id, child.id)) };
}
async function audit(db, operationId = randomUUID(), result = 'SUCCESS') {
  return insert(
    db,
    'audit_events',
    {
      actor_kind: 'SYSTEM',
      system_actor_ref: 'integration-fixture',
      action: 'fixture',
      resource_type: 'Fixture',
      resource_id: randomUUID(),
      result,
      request_id: randomUUID(),
      source_operation_id: operationId,
      event_key: randomUUID(),
    },
    false,
  );
}
async function outbox(db, event, overrides = {}) {
  return insert(
    db,
    'outbox_events',
    {
      topic: 'fixture.v1',
      aggregate_type: 'Fixture',
      aggregate_id: randomUUID(),
      source_operation_id: event.source_operation_id,
      audit_event_id: event.id,
      event_key: randomUUID(),
      payload: { schemaVersion: 1 },
      ...overrides,
    },
    false,
  );
}

test('reference seed is repeatable and concurrent without changing role identities or creating accounts', async () => {
  const accountCount = await client.authAccount.count();
  const before = (
    await pool.query('SELECT id,code,created_at,updated_at FROM roles ORDER BY code::text')
  ).rows;
  assert.equal(before.length, 5);
  const first = await seedReferenceData(client);
  const second = await seedReferenceData(client);
  const concurrent = await Promise.all([seedReferenceData(client), seedReferenceData(client)]);
  for (const result of [first, second, ...concurrent]) {
    assert.equal(result.ok, true);
    assert.equal(result.value.inserted, 0);
  }
  assert.deepEqual(
    (await pool.query('SELECT id,code,created_at,updated_at FROM roles ORDER BY code::text')).rows,
    before,
  );
  assert.equal(await client.authAccount.count(), accountCount);
});

test('homework delivery is explicit; revisions and reviews preserve the student and submitted version during freeze', () =>
  tx(async (db) => {
    const f = await seed(db);
    const l = await lessonFixture(db, f, f.staff.id);
    const assignment = await insert(db, 'homework_assignments', {
      subject_id: f.subject.id,
      issued_by: l.teacher.id,
      title: 'Synthetic task',
      content: { text: 'Synthetic task' },
      lesson_occurrence_id: l.lesson.id,
    });
    const delivery = await insert(db, 'homework_deliveries', {
      assignment_id: assignment.id,
      enrollment_id: f.enrollment.id,
      issued_by: l.teacher.id,
      issued_at: later,
      due_at: '2026-10-04Z',
    });
    const first = await insert(db, 'homework_submissions', {
      delivery_id: delivery.id,
      student_id: f.child.id,
      version: 1,
      submitted_at: '2026-10-03Z',
      content: { text: 'First attempt' },
    });
    await insert(db, 'submission_reviews', {
      submission_id: first.id,
      reviewer_id: l.teacher.id,
      result: 'NEEDS_REVISION',
      reviewed_at: '2026-10-03T12:00Z',
      comment: 'Synthetic review',
    });
    await db.query(
      "UPDATE subscriptions SET frozen_from='2026-10-03Z',frozen_until='2026-10-08Z' WHERE id=$1",
      [f.subscription.id],
    );
    const second = await insert(db, 'homework_submissions', {
      delivery_id: delivery.id,
      student_id: f.child.id,
      version: 2,
      submitted_at: '2026-10-04Z',
      content: { text: 'Revised' },
      supersedes_submission_id: first.id,
    });
    assert.equal(
      (await db.query('SELECT id FROM submission_reviews WHERE submission_id=$1', [second.id]))
        .rowCount,
      0,
    );
    await rejects(
      db,
      () => db.query("UPDATE homework_submissions SET content='{}' WHERE id=$1", [first.id]),
      'ck_financial_history_immutable',
    );
    await rejects(
      db,
      () =>
        insert(db, 'homework_submissions', {
          delivery_id: delivery.id,
          student_id: f.child.id,
          version: 1,
          submitted_at: '2026-10-03Z',
          content: { text: 'Duplicate' },
        }),
      undefined,
      '23505',
    );
    const other = await insert(db, 'students', { full_name: 'Other synthetic child' }, false);
    await rejects(
      db,
      () =>
        insert(db, 'homework_submissions', {
          delivery_id: delivery.id,
          student_id: other.id,
          version: 3,
          submitted_at: '2026-10-04Z',
          content: {},
        }),
      'ck_education_context',
    );
  }));

test('skills are subject-scoped; 4-lesson checkpoints do not become reports and published 8-lesson reports are immutable', () =>
  tx(async (db) => {
    const f = await seed(db);
    const lessons = [];
    for (let i = 0; i < 8; i++) lessons.push(await lessonFixture(db, f, f.staff.id));
    const l = lessons[0];
    const skill = await insert(db, 'skill_entries', {
      subject_id: f.subject.id,
      code: randomUUID(),
      label: 'Synthetic skill',
    });
    const assessment = await insert(db, 'skill_assessments', {
      skill_id: skill.id,
      enrollment_id: f.enrollment.id,
      assessed_by: l.teacher.id,
      assessed_at: '2026-10-03Z',
      lesson_ref: l.lesson.id,
      level: 'PRACTICING',
      version: 1,
      basis: 'Synthetic evidence',
    });
    await rejects(
      db,
      () => db.query("UPDATE skill_assessments SET level='APPLYING' WHERE id=$1", [assessment.id]),
      'ck_financial_history_immutable',
    );
    const other = await insert(
      db,
      'subjects',
      { code: randomUUID(), name: 'Other subject' },
      false,
    );
    const wrongSkill = await insert(db, 'skill_entries', {
      subject_id: other.id,
      code: randomUUID(),
      label: 'Wrong subject',
    });
    await rejects(
      db,
      () =>
        insert(db, 'skill_assessments', {
          skill_id: wrongSkill.id,
          enrollment_id: f.enrollment.id,
          assessed_by: l.teacher.id,
          assessed_at: '2026-10-03Z',
          level: 'INTRODUCING',
          version: 1,
          basis: 'Synthetic',
        }),
      'ck_education_context',
    );
    const base = {
      enrollment_id: f.enrollment.id,
      lesson_actual_outcome_id: l.outcome.id,
      triggered_at: '2026-10-03Z',
    };
    const four = await insert(db, 'progress_checkpoints', {
      ...base,
      type: 'LESSON_4',
      confirmed_lesson_count: 4,
    });
    const eight = await insert(db, 'progress_checkpoints', {
      ...base,
      type: 'LESSON_8',
      confirmed_lesson_count: 8,
    });
    await rejects(
      db,
      () =>
        insert(db, 'progress_checkpoints', {
          ...base,
          type: 'LESSON_8',
          confirmed_lesson_count: 8,
        }),
      undefined,
      '23505',
    );
    const report = {
      author_id: l.teacher.id,
      version: 1,
      period_start: at,
      period_end: '2026-10-03Z',
      content: { summary: 'Synthetic' },
    };
    await rejects(
      db,
      () => insert(db, 'education_reports', { ...report, checkpoint_id: four.id }),
      'ck_report_checkpoint',
    );
    const draft = await insert(db, 'education_reports', { ...report, checkpoint_id: eight.id });
    await rejects(
      db,
      () =>
        db.query(
          "UPDATE education_reports SET status='PUBLISHED',generated_at=now(),published_by=$1 WHERE id=$2",
          [l.teacher.id, draft.id],
        ),
      'ck_report_publication',
    );
    await db.query(
      "UPDATE education_reports SET status='PUBLISHED',generated_at=now(),published_at=now(),published_by=$1 WHERE id=$2",
      [l.teacher.id, draft.id],
    );
    await rejects(
      db,
      () => db.query("UPDATE education_reports SET content='{}' WHERE id=$1", [draft.id]),
      'ck_published_report_immutable',
    );
  }));

test('private S3 identity, typed grants and partial uniqueness require verification and explicit revocation', () =>
  tx(async (db) => {
    const f = await seed(db);
    const object = await insert(db, 's3_objects', {
      bucket: 'synthetic-private',
      key: randomUUID(),
      size: '100',
      content_type: 'application/pdf',
      uploaded_by: f.staff.account_id,
    });
    const permission = {
      s3_object_id: object.id,
      subject_id: f.staff.account_id,
      subject_type: 'STAFF',
      granted_by: f.staff.account_id,
    };
    await rejects(db, () => insert(db, 'file_permissions', permission), 'ck_file_verified_object');
    await rejects(
      db,
      () =>
        db.query("UPDATE s3_objects SET status='VERIFIED',uploaded_at=now() WHERE id=$1", [
          object.id,
        ]),
      'ck_s3_state',
    );
    await db.query(
      "UPDATE s3_objects SET status='VERIFIED',uploaded_at=now(),verified_at=now() WHERE id=$1",
      [object.id],
    );
    const grant = await insert(db, 'file_permissions', permission);
    await rejects(
      db,
      () => insert(db, 'file_permissions', permission),
      'uq_active_file_permission',
      '23505',
    );
    await rejects(
      db,
      () => insert(db, 'file_permissions', { ...permission, subject_type: 'TEACHER' }),
      'fk_t04_permission_subject',
      '23503',
    );
    await db.query('UPDATE file_permissions SET revoked_at=now(),revoked_by=$1 WHERE id=$2', [
      f.staff.account_id,
      grant.id,
    ]);
    await insert(db, 'file_permissions', permission);
    await rejects(
      db,
      () =>
        insert(db, 's3_objects', {
          bucket: 'other-private',
          key: object.key,
          size: '0',
          content_type: 'application/pdf',
          uploaded_by: f.staff.account_id,
        }),
      's3_objects_key_key',
      '23505',
    );
  }));

test('audit and file logs are append-only for owners and have no runtime UPDATE/DELETE privileges', () =>
  tx(async (db) => {
    const f = await seed(db);
    const event = await audit(db);
    await rejects(
      db,
      () => db.query("UPDATE audit_events SET action='rewritten' WHERE id=$1", [event.id]),
      'ck_financial_history_immutable',
    );
    await rejects(
      db,
      () => db.query('DELETE FROM audit_events WHERE id=$1', [event.id]),
      'ck_financial_history_immutable',
    );
    await rejects(
      db,
      () =>
        insert(
          db,
          'audit_events',
          {
            actor_kind: 'SYSTEM',
            action: 'invalid',
            resource_type: 'Fixture',
            result: 'ERROR',
            request_id: randomUUID(),
            event_key: randomUUID(),
          },
          false,
        ),
      'ck_audit_actor',
    );
    const object = await insert(db, 's3_objects', {
      bucket: 'synthetic-private',
      key: randomUUID(),
      size: '0',
      content_type: 'application/pdf',
      uploaded_by: f.staff.account_id,
    });
    const log = await insert(
      db,
      'file_audit_logs',
      {
        s3_object_id: object.id,
        action: 'VIEW',
        actor_id: f.staff.account_id,
        result: 'DENIED',
        request_id: randomUUID(),
        event_key: randomUUID(),
      },
      false,
    );
    await rejects(
      db,
      () => db.query('DELETE FROM file_audit_logs WHERE id=$1', [log.id]),
      'ck_financial_history_immutable',
    );
    const privileges = (
      await db.query(
        "SELECT has_table_privilege('online_school_runtime','audit_events','UPDATE') AS update,has_table_privilege('online_school_runtime','audit_events','DELETE') AS delete",
      )
    ).rows[0];
    assert.equal(privileges.update, false);
    assert.equal(privileges.delete, false);
  }));

test('idempotency scope separates commands, defaults to 48h and cannot be deleted before expiry', () =>
  tx(async (db) => {
    const data = {
      scope: randomUUID(),
      key: randomUUID(),
      command_type: 'fixture',
      request_hash: 'a'.repeat(64),
    };
    const record = await insert(db, 'idempotency_records', data, false);
    assert.equal(record.expires_at.getTime() - record.created_at.getTime(), 48 * 60 * 60 * 1000);
    await rejects(
      db,
      () => insert(db, 'idempotency_records', data, false),
      'uq_idempotency_scope_command_key',
      '23505',
    );
    await insert(db, 'idempotency_records', { ...data, command_type: 'other' }, false);
    await rejects(
      db,
      () => db.query('DELETE FROM idempotency_records WHERE id=$1', [record.id]),
      'ck_idempotency_not_expired',
    );
    await db.query(
      "UPDATE idempotency_records SET status='COMPLETED',completed_at=now(),result_hash=$1,result='{}' WHERE id=$2",
      ['b'.repeat(64), record.id],
    );
    await rejects(
      db,
      () =>
        db.query(
          "UPDATE idempotency_records SET status='IN_PROGRESS',completed_at=NULL,result_hash=NULL,result=NULL WHERE id=$1",
          [record.id],
        ),
      'ck_idempotency_immutable',
    );
    const expired = await insert(
      db,
      'idempotency_records',
      {
        ...data,
        key: randomUUID(),
        created_at: '2000-01-01Z',
        updated_at: '2000-01-01Z',
        expires_at: '2000-01-03Z',
      },
      false,
    );
    assert.equal(
      (await db.query('DELETE FROM idempotency_records WHERE id=$1', [expired.id])).rowCount,
      1,
    );
  }));

test('outbox needs successful matching audit and delivery evidence; CRM uses an actual event FK', () =>
  tx(async (db) => {
    const failed = await audit(db, randomUUID(), 'ERROR');
    await rejects(db, () => outbox(db, failed), 'ck_outbox_audit');
    const event = await audit(db);
    const pending = await outbox(db, event);
    assert.equal(pending.published_at, null);
    assert.equal(pending.status, 'PENDING');
    await rejects(
      db,
      () => db.query('UPDATE outbox_events SET published_at=now() WHERE id=$1', [pending.id]),
      'ck_outbox_delivery',
    );
    await db.query(
      "UPDATE outbox_events SET status='DELIVERED',attempts=1,last_attempt_at=now(),published_at=now(),delivery_reference='synthetic:delivered' WHERE id=$1",
      [pending.id],
    );
    assert.equal(
      (await db.query('SELECT status FROM outbox_events WHERE id=$1', [pending.id])).rows[0].status,
      'DELIVERED',
    );
    await rejects(
      db,
      () => db.query('UPDATE outbox_events SET published_at=NULL WHERE id=$1', [pending.id]),
      'ck_outbox_immutable',
    );
    const child = await insert(db, 'students', { full_name: 'Synthetic CRM child' }, false);
    const task = {
      student_id: child.id,
      type: 'FOLLOW_UP',
      title: 'Synthetic internal follow-up',
      due_at: later,
      source_event_id: pending.id,
      idempotency_key: randomUUID(),
    };
    await insert(db, 'crm_tasks', task, false);
    await rejects(
      db,
      () =>
        insert(
          db,
          'crm_tasks',
          { ...task, idempotency_key: randomUUID(), source_event_id: randomUUID() },
          false,
        ),
      'fk_t04_crm_source_event',
      '23503',
    );
  }));

test('unknown external results need a fresh per-attempt reconciliation before another request', () =>
  tx(async (db) => {
    const job = await insert(
      db,
      'job_records',
      {
        type: 'meet.create',
        payload: { pairId: randomUUID() },
        source_operation_id: randomUUID(),
        deduplication_key: randomUUID(),
        retry_policy: 'RECONCILE_BEFORE_RETRY',
        max_attempts: 2,
      },
      false,
    );
    await db.query(
      "UPDATE job_records SET status='RUNNING',attempts=1,started_at=now(),locked_by='synthetic-worker',locked_until=now()+interval '5 minutes' WHERE id=$1",
      [job.id],
    );
    const attempt = await insert(
      db,
      'job_attempts',
      {
        job_id: job.id,
        attempt_no: 1,
        started_at: (await db.query('SELECT clock_timestamp() AS time')).rows[0].time,
      },
      false,
    );
    await db.query(
      "UPDATE job_attempts SET result='UNKNOWN',finished_at=clock_timestamp(),error='TIMEOUT_UNKNOWN' WHERE id=$1",
      [attempt.id],
    );
    await db.query(
      "UPDATE job_records SET status='RECONCILIATION_REQUIRED',locked_by=NULL,locked_until=NULL WHERE id=$1",
      [job.id],
    );
    const recovery = await insert(
      db,
      'recovery_states',
      {
        job_id: job.id,
        attempt_no: 1,
        operation_key: randomUUID(),
        provider: 'synthetic',
        provider_request_id: randomUUID(),
      },
      false,
    );
    await rejects(
      db,
      () => db.query("UPDATE job_records SET status='PENDING' WHERE id=$1", [job.id]),
      'ck_job_reconciliation_required',
    );
    await rejects(
      db,
      () =>
        db.query("UPDATE recovery_states SET status='FAILED',reconciled_at=now() WHERE id=$1", [
          recovery.id,
        ]),
      'ck_recovery_resolution',
    );
    await db.query(
      "UPDATE recovery_states SET status='FAILED',reconciled_at=now(),evidence_ref='synthetic-head-proof' WHERE id=$1",
      [recovery.id],
    );
    await db.query("UPDATE job_records SET status='PENDING' WHERE id=$1", [job.id]);
    await db.query(
      "UPDATE job_records SET status='RUNNING',attempts=2,started_at=now(),locked_by='synthetic-worker',locked_until=now()+interval '5 minutes' WHERE id=$1",
      [job.id],
    );
    const second = await insert(
      db,
      'job_attempts',
      {
        job_id: job.id,
        attempt_no: 2,
        started_at: (await db.query('SELECT clock_timestamp() AS time')).rows[0].time,
      },
      false,
    );
    await db.query(
      "UPDATE job_attempts SET result='UNKNOWN',finished_at=clock_timestamp(),error='TIMEOUT_UNKNOWN' WHERE id=$1",
      [second.id],
    );
    await db.query(
      "UPDATE job_records SET status='RECONCILIATION_REQUIRED',locked_by=NULL,locked_until=NULL WHERE id=$1",
      [job.id],
    );
    await rejects(
      db,
      () => db.query("UPDATE job_records SET status='PENDING' WHERE id=$1", [job.id]),
      'ck_job_reconciliation_required',
    );
    await insert(
      db,
      'recovery_states',
      {
        job_id: job.id,
        attempt_no: 2,
        operation_key: randomUUID(),
        provider: 'synthetic',
        provider_request_id: recovery.provider_request_id,
      },
      false,
    );
    assert.equal(
      (await db.query('SELECT id FROM recovery_states WHERE job_id=$1', [job.id])).rowCount,
      2,
    );
  }));

test('ledger publication atomically emits one audit/outbox pair; an outbox collision rolls everything back', async () => {
  const service = new LedgerPublicationService({
    authorize: async () => ({ ok: true, value: undefined }),
  });
  async function entry() {
    const f = await seed(pool);
    const doc = await insert(pool, 'ledger_documents', {
      payment_id: f.payment.id,
      basis: 'Synthetic receipt',
    });
    const e = await insert(pool, 'ledger_entries', {
      document_id: doc.id,
      financial_period_id: period.id,
      currency: 'MDL',
      effective_at: later,
    });
    for (const [position, direction] of [
      [1, 'DEBIT'],
      [2, 'CREDIT'],
    ])
      await insert(
        pool,
        'ledger_lines',
        {
          entry_id: e.id,
          position,
          account_type: direction === 'DEBIT' ? 'CASH' : 'CUSTOMER_ADVANCE',
          direction,
          amount: '100.0000',
          currency: 'MDL',
        },
        false,
      );
    return { f, e };
  }
  const first = await entry();
  const operation = randomUUID();
  const command = { entryId: first.e.id, actorStaffId: first.f.staff.id, operationId: operation };
  assert.equal((await service.publish(client, command)).ok, true);
  assert.equal((await service.publish(client, command)).ok, true);
  assert.equal(
    (await pool.query('SELECT id FROM audit_events WHERE source_operation_id=$1', [operation]))
      .rowCount,
    1,
  );
  const events = await pool.query(
    'SELECT published_at FROM outbox_events WHERE source_operation_id=$1',
    [operation],
  );
  assert.equal(events.rowCount, 1);
  assert.equal(events.rows[0].published_at, null);
  const blocked = await entry();
  const prior = await audit(pool);
  await outbox(pool, prior, { event_key: `ledger.published:${blocked.e.id}` });
  const blockedOperation = randomUUID();
  const result = await service.publish(client, {
    entryId: blocked.e.id,
    actorStaffId: blocked.f.staff.id,
    operationId: blockedOperation,
  });
  assert.deepEqual(result, { ok: false, error: { code: 'CONFLICT' } });
  assert.equal(
    (await pool.query('SELECT published_at FROM ledger_entries WHERE id=$1', [blocked.e.id]))
      .rows[0].published_at,
    null,
  );
  assert.equal(
    (
      await pool.query('SELECT id FROM audit_events WHERE source_operation_id=$1', [
        blockedOperation,
      ])
    ).rowCount,
    0,
  );
});
