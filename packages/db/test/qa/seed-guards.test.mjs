import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import pg from 'pg';
import { createDirectClient } from '../../dist/index.js';
import { QA, seedQA } from '../../dist-tools/seed.js';
import { qaTarget } from '../../dist-tools/scripts/database-targets.js';
import { databaseOperation } from '../../dist-tools/scripts/database-tools.js';
import { LedgerPublicationService } from '../../../../apps/api/dist/modules/finance/ledger-publication.service.js';

const target = qaTarget(process.env, true);
assert.equal(target.ok, true, 'Explicit named local QA_DATABASE_URL required');
const pool = new pg.Pool({ connectionString: target.value.url });
const client = createDirectClient({ DIRECT_URL: target.value.url }).value;
after(async () => {
  await client.$disconnect();
  await pool.end();
});
async function snapshot() {
  const tables = (
    await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename",
    )
  ).rows;
  const hash = createHash('sha256');
  for (const { tablename } of tables) {
    assert.match(tablename, /^[a-z_][a-z0-9_]*$/);
    hash.update(
      JSON.stringify(
        (await pool.query(`SELECT to_jsonb(t) AS row FROM ${tablename} t ORDER BY id`)).rows,
      ),
    );
  }
  return hash.digest('hex');
}
async function rollback(fn) {
  const db = await pool.connect();
  await db.query('BEGIN');
  try {
    await fn(db);
  } finally {
    await db.query('ROLLBACK');
    db.release();
  }
}
async function newDocument(db) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO payment_receipts SELECT (jsonb_populate_record(NULL::payment_receipts,to_jsonb(p)||jsonb_build_object('id',$1::text,'external_reference',$1::text,'source_operation_id',$2::text,'confirmation_operation_id',$3::text))).* FROM payment_receipts p LIMIT 1`,
    [id, randomUUID(), randomUUID()],
  );
  const documentId = randomUUID();
  await db.query(
    `INSERT INTO ledger_documents(id,payment_id,basis,source_operation_id) VALUES($1,$2,'Synthetic QA test',$3)`,
    [documentId, id, randomUUID()],
  );
  return documentId;
}
test('QA seed is unchanged after repeated and concurrent runs, including immutable rows and timestamps', async () => {
  assert.equal((await seedQA(client)).ok, true);
  const first = await snapshot();
  for (const result of await Promise.all([seedQA(client), seedQA(client)]))
    assert.equal(result.ok, true);
  assert.equal(await snapshot(), first);
  assert.equal((await pool.query('SELECT count(*) FROM staff_accounts')).rows[0].count, '3');
  assert.equal((await pool.query('SELECT count(*) FROM teacher_accounts')).rows[0].count, '2');
  assert.equal((await pool.query('SELECT count(*) FROM students')).rows[0].count, '3');
  assert.equal((await pool.query('SELECT count(*) FROM student_accounts')).rows[0].count, '1');
  assert.equal(
    (await pool.query('SELECT count(*) FROM webauthn_credentials WHERE revoked_at IS NOT NULL'))
      .rows[0].count,
    '3',
  );
  assert.deepEqual(
    (await pool.query('SELECT status FROM lesson_occurrences ORDER BY status')).rows
      .map((r) => r.status)
      .sort(),
    ['CANCELLED', 'CONDUCTED', 'SCHEDULED'],
  );
  assert.equal(
    (
      await pool.query(
        'SELECT published_at IS NOT NULL AS published FROM ledger_entries WHERE id=$1',
        [QA.ledger],
      )
    ).rows[0].published,
    true,
  );
});
test('calendar rejects all occupied statuses, accepts adjacency and cancelled intervals', async () => {
  await rollback(async (db) => {
    const original = (
      await db.query('SELECT * FROM lesson_occurrences WHERE id=$1', [QA.lessons[0]])
    ).rows[0];
    async function copy(status, start, end) {
      return db.query(
        `INSERT INTO lesson_occurrences(id,enrollment_id,teaching_assignment_id,scheduled_teacher_id,original_scheduled_at,scheduled_at,scheduled_end_at,status,source_operation_id)
        VALUES($1,$2,$3,$4,$5,$5,$6,$7,$8)`,
        [
          randomUUID(),
          original.enrollment_id,
          original.teaching_assignment_id,
          original.scheduled_teacher_id,
          start,
          end,
          status,
          randomUUID(),
        ],
      );
    }
    for (const status of ['SCHEDULED', 'STAR_PENDING', 'DISPUTED']) {
      await db.query('SAVEPOINT overlap');
      await assert.rejects(
        copy(status, original.scheduled_at, original.scheduled_end_at),
        (e) => e.code === '23P01' && e.constraint === 'no_overlapping_confirmed_lessons',
      );
      await db.query('ROLLBACK TO SAVEPOINT overlap');
    }
    await copy('CANCELLED', original.scheduled_at, original.scheduled_end_at);
    await copy(
      'SCHEDULED',
      original.scheduled_end_at,
      new Date(+original.scheduled_end_at + 3600000),
    );
  });
});
test('payment basis is unique; published entries and lines reject mutation', async () => {
  await rollback(async (db) => {
    await assert.rejects(
      db.query(
        `INSERT INTO payment_distributions SELECT (jsonb_populate_record(NULL::payment_distributions,to_jsonb(p)||jsonb_build_object('id',$1::text,'source_operation_id',$2::text,'approved_at',NULL,'approved_by_director_id',NULL,'approval_operation_id',NULL))).* FROM payment_distributions p LIMIT 1`,
        [randomUUID(), randomUUID()],
      ),
      (e) => e.code === '23505' && e.constraint === 'uq_payment_distribution_unique',
    );
  });
  for (const sql of [
    'UPDATE ledger_entries SET balanced_at=now() WHERE id=$1',
    'UPDATE ledger_lines SET amount=1 WHERE entry_id=$1',
  ])
    await rollback((db) =>
      assert.rejects(
        db.query(sql, [QA.ledger]),
        (e) => e.constraint === 'ck_published_ledger_immutable',
      ),
    );
});
test('publication checks balance at the entry boundary and per currency', async () => {
  await rollback(async (db) => {
    // Exercise the incremental trigger independently; disable the old guard only within rollback.
    const triggers = (
      await db.query(
        "SELECT tgname FROM pg_trigger WHERE tgrelid='ledger_entries'::regclass AND NOT tgisinternal AND tgname<>'trg_t05_publication_balance'",
      )
    ).rows;
    for (const { tgname } of triggers) {
      assert.match(tgname, /^[a-z0-9_]+$/);
      await db.query(`ALTER TABLE ledger_entries DISABLE TRIGGER ${tgname}`);
    }
    const entry = (await db.query('SELECT * FROM ledger_entries WHERE id=$1', [QA.ledger])).rows[0];
    const id = randomUUID();
    await db.query(
      `INSERT INTO ledger_entries(id,document_id,financial_period_id,currency,effective_at,source_operation_id) VALUES($1,$2,$3,'MDL',$4,$5)`,
      [id, await newDocument(db), entry.financial_period_id, entry.effective_at, randomUUID()],
    );
    await db.query(
      `INSERT INTO ledger_lines(id,entry_id,position,account_type,amount,currency,direction) VALUES($1,$2,1,'CASH',10,'MDL','DEBIT'),($3,$2,2,'CUSTOMER_ADVANCE',10,'EUR','CREDIT')`,
      [randomUUID(), id, randomUUID()],
    );
    await assert.rejects(
      db.query(
        `UPDATE ledger_entries SET balanced_at=now(),published_at=now(),published_by_id=$2,publication_operation_id=$3,balance_snapshot='{}' WHERE id=$1`,
        [id, QA.director, randomUUID()],
      ),
      (e) => e.constraint === 'ck_ledger_currency_balance',
    );
  });
});
test('migration and reset commands reject unintended targets without modifying them', async () => {
  assert.equal(qaTarget({ QA_DATABASE_URL: target.value.url, APP_ENV: 'production' }).ok, false);
  assert.equal(
    qaTarget({ QA_DATABASE_URL: 'postgresql://localhost/online_school_staging' }, true).ok,
    false,
  );
  assert.equal(
    qaTarget(
      { QA_DATABASE_URL: 'postgresql://example.invalid/online_school_qa', APP_ENV: 'qa' },
      true,
    ).ok,
    false,
  );
  assert.deepEqual(
    await databaseOperation('dry-run', { MIGRATION_TEST_DATABASE_URL: target.value.url }),
    { ok: false, error: { code: 'REHEARSAL_REQUIRES_EMPTY_DATABASE' } },
  );
});
test('closed-period denial has separate durable audit and no financial write or outbox', async () => {
  const entry = await client.ledgerEntry.findUniqueOrThrow({ where: { id: QA.ledger } });
  const draft = await client.ledgerEntry.create({
    data: {
      document_id: await newDocument(pool),
      financial_period_id: entry.financial_period_id,
      currency: 'MDL',
      effective_at: entry.effective_at,
      source_operation_id: randomUUID(),
    },
  });
  await client.financialPeriod.update({
    where: { id: entry.financial_period_id },
    data: { closed_at: new Date(), closed_by_id: QA.director, closure_operation_id: randomUUID() },
  });
  const operationId = randomUUID();
  const service = new LedgerPublicationService({
    authorize: async () => ({ ok: true, value: undefined }),
  });
  for (let n = 0; n < 2; n++)
    assert.deepEqual(
      await service.publish(client, { entryId: draft.id, actorStaffId: QA.director, operationId }),
      { ok: false, error: { code: 'CLOSED_PERIOD' } },
    );
  assert.equal(
    await client.auditEvent.count({
      where: { source_operation_id: operationId, result: 'DENIED' },
    }),
    1,
  );
  assert.equal(await client.outboxEvent.count({ where: { source_operation_id: operationId } }), 0);
  assert.equal(
    (await client.ledgerEntry.findUniqueOrThrow({ where: { id: draft.id } })).published_at,
    null,
  );
});
