import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { createDirectClient } from '../../dist/index.js';
import {
  at,
  later,
  director,
  fundedSubscription,
  insert,
  lessonFixture,
} from './finance-fixtures.mjs';
import {
  DenyLedgerPublicationPolicy,
  LedgerPublicationService,
} from '../../../../apps/api/dist/modules/finance/ledger-publication.service.js';

const url = process.env.TEST_DATABASE_URL;
assert.ok(url, 'TEST_DATABASE_URL is required');
const target = new URL(url);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_test[a-z0-9_]*$/);
const pool = new pg.Pool({ connectionString: url, max: 5 });
const client = createDirectClient({ DIRECT_URL: url });
assert.equal(client.ok, true);
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
  await client.value.$disconnect();
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
async function seed(db, options) {
  const staff = await director(db);
  const child = await insert(db, 'students', { full_name: 'Synthetic finance child' }, false);
  const finance = await fundedSubscription(db, staff.id, child.id, options);
  return { staff, child, ...finance };
}
const allow = new LedgerPublicationService({
  authorize: async () => ({ ok: true, value: undefined }),
});
async function draft(db, fixture, lines) {
  const document = await insert(db, 'ledger_documents', {
    payment_id: fixture.payment.id,
    basis: 'Synthetic confirmed receipt',
  });
  const entry = await insert(db, 'ledger_entries', {
    document_id: document.id,
    financial_period_id: period.id,
    currency: 'MDL',
    effective_at: later,
  });
  for (const [index, line] of lines.entries())
    await insert(
      db,
      'ledger_lines',
      {
        entry_id: entry.id,
        position: index + 1,
        account_type: line.direction === 'DEBIT' ? 'CASH' : 'CUSTOMER_ADVANCE',
        ...line,
      },
      false,
    );
  return entry;
}
function publish(entry, staff, operationId = randomUUID()) {
  return allow.publish(client.value, { entryId: entry.id, actorStaffId: staff.id, operationId });
}
async function grant(db, f, quantity = 2) {
  return insert(db, 'entitlement_grants', {
    subscription_id: f.subscription.id,
    payment_distribution_id: f.distribution.id,
    quantity,
    basis: 'CONFIRMED_PAYMENT',
    granted_at: at,
    authorized_by_id: f.staff.id,
  });
}
async function consume(db, f, g, lesson) {
  return insert(db, 'entitlement_consumptions', {
    grant_id: g.id,
    subscription_id: f.subscription.id,
    lesson_occurrence_id: lesson.id,
    quantity: 1,
    basis: 'CONFIRMED_LESSON',
    reason: 'Synthetic confirmed lesson',
    authorized_by_id: f.staff.id,
    consumed_at: '2026-10-03T12:00:00Z',
  });
}

test('money is NUMERIC(20,4), command identities are unique, consumption has its required partial index', () =>
  tx(async (db) => {
    const numeric = await db.query(
      "SELECT table_name,column_name,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' AND data_type='numeric'",
    );
    // TASK-08 adds two explicit promise money fields; keep checking every numeric column.
    assert.equal(numeric.rowCount, 23);
    assert.deepEqual(
      numeric.rows
        .filter((r) => r.table_name === 'teacher_rate_promises')
        .map((r) => r.column_name)
        .sort(),
      ['additive_rate', 'minimum_rate'],
    );
    assert.ok(numeric.rows.every((row) => row.numeric_precision === 20 && row.numeric_scale === 4));
    assert.equal(
      (
        await db.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND data_type IN ('real','double precision')",
        )
      ).rowCount,
      0,
    );
    const index = (
      await db.query(
        "SELECT indexdef FROM pg_indexes WHERE indexname='uq_entitlement_consumption_lesson'",
      )
    ).rows[0];
    assert.match(
      index.indexdef,
      /UNIQUE.*lesson_occurrence_id, subscription_id.*WHERE.*cancelled_at IS NULL/,
    );
    const commands =
      await db.query(`SELECT c.table_name FROM information_schema.columns c WHERE c.table_schema='public' AND c.column_name='source_operation_id'
    AND c.table_name NOT IN ('audit_events','outbox_events','job_records')
    AND NOT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_attribute a ON a.attrelid=t.oid
      WHERE t.relname=c.table_name AND a.attname='source_operation_id' AND i.indisunique AND a.attnum=ANY(i.indkey))`);
    assert.equal(commands.rowCount, 0);
  }));

test('incomplete payment never grants full access/paid rights; every admission is explicit and completion does not duplicate rights', () =>
  tx(async (db) => {
    const f = await seed(db, { amount: '40.0000' });
    await rejects(db, () => grant(db, f), 'ck_grant_paid_basis');
    const auth = await insert(
      db,
      'auth_accounts',
      { kind: 'STUDENT', login_id: randomUUID() },
      false,
    );
    const activation = {
      student_id: f.child.id,
      account_id: auth.id,
      activation_basis: 'FULL_PAYMENT',
      activation_subscription_id: f.subscription.id,
      activation_payment_confirmation_id: f.payment.id,
      activation_confirmed_by_staff_id: f.staff.id,
      activated_at: '2026-10-01T14:00:00Z',
    };
    await rejects(
      db,
      () => insert(db, 'student_accounts', activation, false),
      'ck_activation_full_payment',
    );
    const permission = await insert(db, 'temporary_access_permissions', {
      subscription_id: f.subscription.id,
      approved_by_director_id: f.staff.id,
      approved_at: at,
      valid_from: at,
      valid_to: '2026-11-01Z',
      max_lessons: 1,
      reason: 'Synthetic separate director decision',
    });
    await insert(
      db,
      'student_accounts',
      {
        ...activation,
        activation_basis: 'LIMITED_DIRECTOR_ADMISSION',
        activation_director_admission_id: permission.id,
      },
      false,
    );
    await lessonFixture(db, f, f.staff.id, { permissionId: permission.id });
    await rejects(
      db,
      () => lessonFixture(db, f, f.staff.id, { permissionId: permission.id }),
      'ck_outcome_admission',
    );
    const payment = await insert(db, 'payment_receipts', {
      amount: '60.0000',
      currency: 'MDL',
      registered_by_manager_id: f.staff.id,
      registered_at: '2026-10-03Z',
      confirmed_by_director_id: f.staff.id,
      confirmed_by_director_at: '2026-10-03Z',
      confirmation_operation_id: randomUUID(),
    });
    await insert(db, 'payment_distributions', {
      payment_id: payment.id,
      subscription_id: f.subscription.id,
      amount: '60.0000',
      currency: 'MDL',
      approved_by_director_id: f.staff.id,
      approved_at: '2026-10-03Z',
      approval_operation_id: randomUUID(),
    });
    const granted = {
      subscription_id: f.subscription.id,
      payment_distribution_id: f.distribution.id,
      quantity: 2,
      basis: 'CONFIRMED_PAYMENT',
      granted_at: '2026-10-04Z',
      authorized_by_id: f.staff.id,
    };
    await insert(db, 'entitlement_grants', granted);
    await rejects(db, () => insert(db, 'entitlement_grants', granted), 'ck_grant_total');
    assert.equal(
      (
        await db.query(
          'SELECT sum(quantity)::int AS quantity FROM entitlement_grants WHERE subscription_id=$1',
          [f.subscription.id],
        )
      ).rows[0].quantity,
      2,
    );
  }));

test('payment allocation requires confirmation, matching currency and a bounded total', () =>
  tx(async (db) => {
    const f = await seed(db);
    const data = {
      payment_id: f.payment.id,
      subscription_id: f.subscription.id,
      amount: '1.0000',
      currency: 'MDL',
      approved_by_director_id: f.staff.id,
      approved_at: at,
      approval_operation_id: randomUUID(),
    };
    await rejects(db, () => insert(db, 'payment_distributions', data), 'ck_distribution_total');
    const pending = await insert(db, 'payment_receipts', {
      amount: '10.0000',
      currency: 'MDL',
      registered_at: at,
      registered_by_manager_id: f.staff.id,
    });
    await rejects(
      db,
      () => insert(db, 'payment_distributions', { ...data, payment_id: pending.id }),
      'ck_distribution_confirmed_payment',
    );
    await rejects(
      db,
      () => insert(db, 'payment_distributions', { ...data, currency: 'EUR' }),
      'ck_distribution_currency',
    );
  }));

test('consumption is single per lesson and closed lesson periods cannot be bypassed by changing consumed_at', () =>
  tx(async (db) => {
    const f = await seed(db);
    const g = await grant(db, f);
    const l = await lessonFixture(db, f, f.staff.id);
    await consume(db, f, g, l.lesson);
    await rejects(db, () => consume(db, f, g, l.lesson), undefined, '23505');
    const other = await lessonFixture(db, f, f.staff.id);
    await db.query(
      'UPDATE financial_periods SET closed_at=now(),closed_by_id=$1,closure_operation_id=$2 WHERE id=$3',
      [f.staff.id, randomUUID(), period.id],
    );
    await rejects(db, () => consume(db, f, g, other.lesson), 'ck_open_financial_period');
    await rejects(
      db,
      () =>
        db.query(
          'UPDATE financial_periods SET closed_at=NULL,closed_by_id=NULL,closure_operation_id=NULL WHERE id=$1',
          [period.id],
        ),
      'ck_closed_period_immutable',
    );
  }));

test('two concurrent lessons cannot consume the same last paid unit', async () => {
  const f = await seed(pool);
  const g = await grant(pool, f, 1);
  const lessons = [
    await lessonFixture(pool, f, f.staff.id),
    await lessonFixture(pool, f, f.staff.id),
  ];
  const results = await Promise.allSettled(lessons.map((item) => consume(pool, f, g, item.lesson)));
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(
    results.find((item) => item.status === 'rejected').reason.constraint,
    'ck_entitlement_nonnegative',
  );
});

test('ordinary points are 200/220/250; individual promises and actual teacher snapshots remain separate', () =>
  tx(async (db) => {
    const f = await seed(db);
    for (const [points, rate] of [
      [4, '200.0000'],
      [5, '220.0000'],
      [9, '220.0000'],
      [10, '250.0000'],
    ]) {
      await lessonFixture(db, f, f.staff.id, { points, rate });
    }
    await rejects(
      db,
      () => lessonFixture(db, f, f.staff.id, { points: 5, rate: '230.0000' }),
      'ck_lesson_start_rate',
    );
    const individual = await lessonFixture(db, f, f.staff.id, {
      rate: '230.0000',
      rateBasis: 'INDIVIDUAL_PROMISE',
    });
    await rejects(
      db,
      () =>
        db.query('UPDATE lesson_actual_outcomes SET rate_snapshot=250 WHERE id=$1', [
          individual.outcome.id,
        ]),
      'ck_financial_history_immutable',
    );
  }));

test('default policy denies publication; equal overall totals cannot hide per-currency imbalance', async () => {
  const f = await seed(pool);
  const entry = await draft(pool, f, [
    { currency: 'MDL', direction: 'DEBIT', amount: '10.0000' },
    { currency: 'MDL', direction: 'CREDIT', amount: '9.0000' },
    { currency: 'EUR', direction: 'DEBIT', amount: '9.0000' },
    { currency: 'EUR', direction: 'CREDIT', amount: '10.0000' },
  ]);
  const denied = await new LedgerPublicationService(new DenyLedgerPublicationPolicy()).publish(
    client.value,
    { entryId: entry.id, actorStaffId: f.staff.id, operationId: randomUUID() },
  );
  assert.deepEqual(denied, { ok: false, error: { code: 'FORBIDDEN' } });
  assert.deepEqual(await publish(entry, f.staff), { ok: false, error: { code: 'UNBALANCED' } });
  assert.equal(
    (await client.value.ledgerEntry.findUnique({ where: { id: entry.id } })).published_at,
    null,
  );
});

test('Decimal publication is exact, idempotent, and immutable for both owner and runtime role', async () => {
  const f = await seed(pool, { price: '900719925474099.1234' });
  const entry = await draft(pool, f, [
    { currency: 'MDL', direction: 'DEBIT', amount: '900719925474099.1234' },
    { currency: 'MDL', direction: 'CREDIT', amount: '900719925474099.1234' },
    { currency: 'EUR', direction: 'DEBIT', amount: '9999999999999999.9999' },
    { currency: 'EUR', direction: 'DEBIT', amount: '9999999999999999.9999' },
    { currency: 'EUR', direction: 'CREDIT', amount: '9999999999999999.9999' },
    { currency: 'EUR', direction: 'CREDIT', amount: '9999999999999999.9999' },
  ]);
  const operation = randomUUID();
  const result = await publish(entry, f.staff, operation);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.value.balance_snapshot, {
    MDL: { debit: '900719925474099.1234', credit: '900719925474099.1234' },
    EUR: { debit: '19999999999999999.9998', credit: '19999999999999999.9998' },
  });
  assert.equal((await publish(entry, f.staff, operation)).ok, true);
  assert.deepEqual(await publish(entry, f.staff), {
    ok: false,
    error: { code: 'ALREADY_PUBLISHED' },
  });
  await tx(async (db) => {
    await rejects(
      db,
      () => db.query('UPDATE ledger_lines SET amount=1 WHERE entry_id=$1', [entry.id]),
      'ck_published_ledger_immutable',
    );
    await rejects(
      db,
      () => db.query('DELETE FROM ledger_entries WHERE id=$1', [entry.id]),
      'ck_published_ledger_immutable',
    );
    await db.query('SET LOCAL ROLE online_school_runtime');
    assert.equal(
      (
        await db.query('UPDATE ledger_entries SET balanced_at=now() WHERE id=$1 RETURNING id', [
          entry.id,
        ])
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await db.query('UPDATE ledger_lines SET amount=1 WHERE entry_id=$1 RETURNING id', [
          entry.id,
        ])
      ).rowCount,
      0,
    );
  });
});

test('accrual, recognized obligation, attempt and confirmed payout are distinct; unknown attempts do not pay', async () => {
  const f = await seed(pool);
  const l = await lessonFixture(pool, f, f.staff.id);
  const accrual = await insert(pool, 'teacher_accruals', {
    lesson_actual_outcome_id: l.outcome.id,
    teacher_id: l.teacher.id,
    rate_snapshot: '200.0000',
    points_snapshot: 4,
    rate_basis: 'ORDINARY_POINTS',
    amount: '200.0000',
    currency: 'MDL',
    basis: 'Synthetic approved accrual; no consumption prerequisite',
    recognized_at: '2026-10-03Z',
    authorized_by_id: f.staff.id,
    financial_period_id: period.id,
  });
  const obligation = await insert(pool, 'payroll_obligations', {
    accrual_id: accrual.id,
    amount: '200.0000',
    currency: 'MDL',
    recognized_at: '2026-10-03Z',
  });
  const document = await insert(pool, 'ledger_documents', {
    accrual_id: accrual.id,
    basis: 'Synthetic payable recognition',
  });
  const entry = await insert(pool, 'ledger_entries', {
    document_id: document.id,
    financial_period_id: period.id,
    currency: 'MDL',
    effective_at: '2026-10-03Z',
  });
  for (const [position, direction] of [
    [1, 'DEBIT'],
    [2, 'CREDIT'],
  ])
    await insert(
      pool,
      'ledger_lines',
      {
        entry_id: entry.id,
        position,
        direction,
        account_type: direction === 'DEBIT' ? 'TEACHER_EXPENSE' : 'TEACHER_PAYABLE',
        amount: '200.0000',
        currency: 'MDL',
      },
      false,
    );
  assert.equal((await publish(entry, f.staff)).ok, true);
  await pool.query('UPDATE payroll_obligations SET recognition_entry_id=$1 WHERE id=$2', [
    entry.id,
    obligation.id,
  ]);
  await tx(async (db) => {
    const attempt = await insert(db, 'payout_attempts', {
      obligation_id: obligation.id,
      amount: '150.0000',
      currency: 'MDL',
      status: 'UNKNOWN',
      provider: 'synthetic',
      provider_request_id: randomUUID(),
      attempted_by_id: f.staff.id,
      attempted_at: '2026-10-04Z',
    });
    const payout = {
      attempt_id: attempt.id,
      amount: '150.0000',
      currency: 'MDL',
      confirmed_at: '2026-10-04Z',
      confirmed_by_id: f.staff.id,
      provider: 'synthetic',
      provider_confirmation_id: randomUUID(),
    };
    await rejects(db, () => insert(db, 'confirmed_payouts', payout), 'ck_confirmed_payout_basis');
    await db.query("UPDATE payout_attempts SET status='SUCCEEDED' WHERE id=$1", [attempt.id]);
    await insert(db, 'confirmed_payouts', payout);
    const next = await insert(db, 'payout_attempts', {
      obligation_id: obligation.id,
      amount: '100.0000',
      currency: 'MDL',
      status: 'SUCCEEDED',
      provider: 'synthetic',
      provider_request_id: randomUUID(),
      attempted_by_id: f.staff.id,
      attempted_at: '2026-10-04Z',
    });
    await rejects(
      db,
      () =>
        insert(db, 'confirmed_payouts', {
          ...payout,
          attempt_id: next.id,
          amount: '100.0000',
          provider_confirmation_id: randomUUID(),
        }),
      'ck_confirmed_payout_basis',
    );
    assert.equal(
      (
        await db.query(
          'SELECT sum(p.amount)::text AS amount FROM confirmed_payouts p JOIN payout_attempts a ON a.id=p.attempt_id WHERE a.obligation_id=$1',
          [obligation.id],
        )
      ).rows[0].amount,
      '150.0000',
    );
  });
});

test('refund retains the original discounted rights price and cannot execute before approval', () =>
  tx(async (db) => {
    const f = await seed(db);
    const refund = {
      subscription_id: f.subscription.id,
      calculated_amount: '50.0000',
      original_paid_unit_price: '50.0000',
      paid_unused_quantity: 1,
      calculation_basis: 'Original paid unused rights including initial discount',
      currency: 'MDL',
    };
    await rejects(
      db,
      () =>
        insert(db, 'refund_records', {
          ...refund,
          executed_amount: '50.0000',
          executed_at: later,
          execution_reference: randomUUID(),
        }),
      'ck_refund_execution',
    );
    await rejects(db, () =>
      insert(db, 'refund_records', { ...refund, original_paid_unit_price: '60.0000' }),
    );
    await insert(db, 'refund_records', {
      ...refund,
      approved_amount: '50.0000',
      approved_by_director_id: f.staff.id,
      approved_by_director_at: at,
      approval_operation_id: randomUUID(),
      executed_amount: '50.0000',
      executed_at: later,
      execution_reference: randomUUID(),
    });
  }));
