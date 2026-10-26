import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { createDirectClient } from '../../dist/index.js';
import { fundedSubscription } from './finance-fixtures.mjs';

const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(
  connectionString,
  'Set TEST_DATABASE_URL to an isolated, migrated PostgreSQL 18 database.',
);
const target = new URL(connectionString);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_(test|task02)[a-z0-9_]*$/);
const pool = new pg.Pool({ connectionString, max: 4 });
const hash = () => createHash('sha256').update(randomUUID()).digest('hex');

before(async () => {
  const version = await pool.query("SELECT current_setting('server_version_num')::int AS version");
  assert.equal(Math.floor(version.rows[0].version / 10000), 18);
});
after(() => pool.end());

async function transaction(run) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await run(db);
  } finally {
    await db.query('ROLLBACK');
    db.release();
  }
}

async function rejected(db, code, constraint, sql, values = []) {
  await db.query('SAVEPOINT expected_failure');
  try {
    await assert.rejects(db.query(sql, values), (error) => {
      assert.equal(error.code, code);
      if (constraint) assert.equal(error.constraint, constraint);
      return true;
    });
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT expected_failure');
    await db.query('RELEASE SAVEPOINT expected_failure');
  }
}

async function account(db, kind = 'STAFF') {
  const id = randomUUID();
  await db.query('INSERT INTO auth_accounts (id, kind, login_id) VALUES ($1, $2, $3)', [
    id,
    kind,
    `fixture-${id}`,
  ]);
  return id;
}

async function staff(db, role = 'DIRECTOR') {
  const accountId = await account(db);
  const id = randomUUID();
  await db.query('INSERT INTO staff_accounts (id, account_id, full_name) VALUES ($1, $2, $3)', [
    id,
    accountId,
    'Synthetic staff',
  ]);
  await db.query(
    `INSERT INTO role_assignments (id, account_id, role_id, valid_from)
     SELECT $1, $2, id, '2000-01-01Z' FROM roles WHERE code = $3`,
    [randomUUID(), accountId, role],
  );
  return { id, accountId };
}

async function student(db) {
  const id = randomUUID();
  await db.query('INSERT INTO students (id, full_name, phone) VALUES ($1, $2, $3)', [
    id,
    'Synthetic child',
    '+000000000',
  ]);
  return id;
}

async function household(db) {
  const id = randomUUID();
  await db.query('INSERT INTO households (id) VALUES ($1)', [id]);
  return id;
}

async function membership(db, studentId, householdId, staffId) {
  return db.query(
    `INSERT INTO household_memberships
       (id, household_id, student_id, basis, recorded_by_staff_id, valid_from)
     VALUES ($1, $2, $3, 'Synthetic membership', $4, '2026-01-01Z') RETURNING id`,
    [randomUUID(), householdId, studentId, staffId],
  );
}

test('required partial indexes and non-cascading historical FKs exist in PostgreSQL', () =>
  transaction(async (db) => {
    const indexes = await db.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
       AND indexname IN ('uq_student_active_household', 'uq_student_active_account')`,
    );
    assert.equal(indexes.rowCount, 2);
    for (const row of indexes.rows) assert.match(row.indexdef, /UNIQUE INDEX.*WHERE/);
    const foreignKeys = await db.query(
      `SELECT confdeltype FROM pg_constraint WHERE contype = 'f'
       AND conrelid IN ('relationship_verifications'::regclass, 'access_revocations'::regclass)`,
    );
    assert.ok(foreignKeys.rowCount >= 5);
    assert.ok(foreignKeys.rows.every((row) => row.confdeltype === 'r'));
    const roles = await db.query('SELECT code FROM roles ORDER BY code::text');
    assert.deepEqual(
      roles.rows.map((row) => row.code),
      ['DIRECTOR', 'MANAGER', 'STUDENT', 'TEACHER', 'TECH_OPERATOR'],
    );
  }));

test('household membership rejects missing/both people and a second active group', () =>
  transaction(async (db) => {
    const recorder = await staff(db);
    const child = await student(db);
    const first = await household(db);
    const second = await household(db);
    await rejected(
      db,
      '23514',
      'ck_membership_one_person',
      `INSERT INTO household_memberships (id, household_id, basis, recorded_by_staff_id)
       VALUES ($1, $2, 'Synthetic', $3)`,
      [randomUUID(), first, recorder.id],
    );
    const representative = randomUUID();
    await db.query('INSERT INTO representatives (id, full_name) VALUES ($1, $2)', [
      representative,
      'Synthetic adult',
    ]);
    await rejected(
      db,
      '23514',
      'ck_membership_one_person',
      `INSERT INTO household_memberships
       (id, household_id, student_id, representative_id, basis, recorded_by_staff_id)
       VALUES ($1, $2, $3, $4, 'Synthetic', $5)`,
      [randomUUID(), first, child, representative, recorder.id],
    );
    await membership(db, child, first, recorder.id);
    await rejected(
      db,
      '23505',
      'uq_student_active_household',
      `INSERT INTO household_memberships
       (id, household_id, student_id, basis, recorded_by_staff_id)
       VALUES ($1, $2, $3, 'Synthetic', $4)`,
      [randomUUID(), second, child, recorder.id],
    );
  }));

test('historical household intervals cannot overlap; an adjacent transfer is valid', () =>
  transaction(async (db) => {
    const recorder = await staff(db);
    const child = await student(db);
    const first = await household(db);
    const second = await household(db);
    await db.query(
      `INSERT INTO household_memberships
       (id, household_id, student_id, status, valid_from, valid_to, basis, recorded_by_staff_id)
       VALUES ($1, $2, $3, 'ENDED', '2026-01-01Z', '2026-02-01Z', 'Synthetic', $4)`,
      [randomUUID(), first, child, recorder.id],
    );
    await rejected(
      db,
      '23P01',
      'ex_student_household_period',
      `INSERT INTO household_memberships
       (id, household_id, student_id, status, valid_from, valid_to, basis, recorded_by_staff_id)
       VALUES ($1, $2, $3, 'ENDED', '2026-01-15Z', '2026-02-15Z', 'Synthetic', $4)`,
      [randomUUID(), second, child, recorder.id],
    );
    await db.query(
      `INSERT INTO household_memberships
       (id, household_id, student_id, valid_from, basis, recorded_by_staff_id)
       VALUES ($1, $2, $3, '2026-02-01Z', 'Synthetic transfer', $4)`,
      [randomUUID(), second, child, recorder.id],
    );
  }));

test('verification history blocks deletion and does not require household membership', () =>
  transaction(async (db) => {
    const verifier = await staff(db);
    const child = await student(db);
    const adult = randomUUID();
    const link = randomUUID();
    await db.query('INSERT INTO representatives (id, full_name) VALUES ($1, $2)', [adult, 'Adult']);
    await db.query(
      `INSERT INTO student_representative_links
       (id, student_id, representative_id, role, basis)
       VALUES ($1, $2, $3, 'PARENT', 'Synthetic evidence')`,
      [link, child, adult],
    );
    await rejected(
      db,
      '23514',
      'ck_relation_verification',
      "UPDATE student_representative_links SET verification_status = 'VERIFIED' WHERE id = $1",
      [link],
    );
    await db.query(
      `INSERT INTO relationship_verifications
       (id, link_id, result, basis, verified_by_staff_id)
       VALUES ($1, $2, 'VERIFIED', 'Synthetic evidence', $3)`,
      [randomUUID(), link, verifier.id],
    );
    await rejected(
      db,
      '23001',
      'fk_verification_link',
      'DELETE FROM student_representative_links WHERE id = $1',
      [link],
    );
  }));

test('student account requires a director, admission reference and unique active identity', () =>
  transaction(async (db) => {
    const director = await staff(db);
    const manager = await staff(db, 'MANAGER');
    const child = await student(db);
    const firstAuth = await account(db, 'STUDENT');
    const secondAuth = await account(db, 'STUDENT');
    const finance = await fundedSubscription(db, director.id, child);
    const insert = `INSERT INTO student_accounts
      (id, student_id, account_id, activation_basis, activation_payment_confirmation_id,
       activation_confirmed_by_staff_id, activated_at, activation_subscription_id)
      VALUES ($1, $2, $3, $4, $5, $6, now(), $7)`;
    await rejected(db, '23514', 'ck_student_activation_director', insert, [
      randomUUID(),
      child,
      firstAuth,
      'FULL_PAYMENT',
      randomUUID(),
      manager.id,
      finance.subscription.id,
    ]);
    await rejected(db, '23514', 'ck_activation_payment_basis', insert, [
      randomUUID(),
      child,
      firstAuth,
      'FULL_PAYMENT',
      null,
      director.id,
      finance.subscription.id,
    ]);
    await rejected(db, '23514', 'ck_activation_limited_admission', insert, [
      randomUUID(),
      child,
      firstAuth,
      'LIMITED_DIRECTOR_ADMISSION',
      finance.payment.id,
      director.id,
      finance.subscription.id,
    ]);
    const profile = randomUUID();
    await db.query(insert, [
      profile,
      child,
      firstAuth,
      'FULL_PAYMENT',
      finance.payment.id,
      director.id,
      finance.subscription.id,
    ]);
    await rejected(db, '23505', 'uq_student_active_account', insert, [
      randomUUID(),
      child,
      secondAuth,
      'FULL_PAYMENT',
      finance.payment.id,
      director.id,
      finance.subscription.id,
    ]);
    await db.query('UPDATE student_accounts SET deactivated_at = now() WHERE id = $1', [profile]);
    await db.query(insert, [
      randomUUID(),
      child,
      secondAuth,
      'FULL_PAYMENT',
      finance.payment.id,
      director.id,
      finance.subscription.id,
    ]);
    assert.equal(
      (await db.query('SELECT id FROM student_accounts WHERE student_id = $1', [child])).rowCount,
      2,
    );
  }));

test('profile kinds and role assignments cannot turn a student into staff', () =>
  transaction(async (db) => {
    const principal = await account(db, 'STUDENT');
    await rejected(
      db,
      '23503',
      'fk_staff_account_auth',
      "INSERT INTO staff_accounts (id, account_id, full_name) VALUES ($1, $2, 'Synthetic')",
      [randomUUID(), principal],
    );
    await rejected(
      db,
      '23514',
      'ck_staff_account_kind',
      "INSERT INTO staff_accounts (id, account_id, account_kind, full_name) VALUES ($1, $2, 'STUDENT', 'Synthetic')",
      [randomUUID(), principal],
    );
    await rejected(
      db,
      '23514',
      'ck_role_account_kind',
      "INSERT INTO role_assignments (id, account_id, role_id) SELECT $1, $2, id FROM roles WHERE code = 'DIRECTOR'",
      [randomUUID(), principal],
    );
    await rejected(
      db,
      '23514',
      'ck_account_kind_immutable',
      "UPDATE auth_accounts SET kind = 'STAFF' WHERE id = $1",
      [principal],
    );
  }));

test('sessions and challenges reject missing expiry, invalid times and cross-account ownership', () =>
  transaction(async (db) => {
    const owner = await account(db);
    const other = await account(db);
    const session = randomUUID();
    await rejected(
      db,
      '23502',
      null,
      'INSERT INTO sessions (id, account_id, token_hash) VALUES ($1, $2, $3)',
      [session, owner, hash()],
    );
    await rejected(
      db,
      '23514',
      'ck_session_expiry',
      "INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, '2000-01-01Z')",
      [session, owner, hash()],
    );
    await db.query(
      "INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, '2099-01-01Z')",
      [session, owner, hash()],
    );
    await rejected(
      db,
      '23503',
      'fk_challenge_session_owner',
      `INSERT INTO mfa_challenges (id, account_id, session_id, purpose, challenge_hash, expires_at)
       VALUES ($1, $2, $3, 'AUTHENTICATION', $4, '2099-01-01Z')`,
      [randomUUID(), other, session, hash()],
    );
    await rejected(
      db,
      '23502',
      null,
      "INSERT INTO mfa_challenges (id, account_id, purpose, challenge_hash) VALUES ($1, $2, 'AUTHENTICATION', $3)",
      [randomUUID(), owner, hash()],
    );
    await rejected(
      db,
      '23514',
      'ck_challenge_used_time',
      `INSERT INTO mfa_challenges (id, account_id, purpose, challenge_hash, expires_at, used_at)
       VALUES ($1, $2, 'AUTHENTICATION', $3, '2099-01-01Z', '2099-02-01Z')`,
      [randomUUID(), owner, hash()],
    );
  }));

test('WebAuthn stores the full uint32 counter and rejects negative/overflow counters', () =>
  transaction(async (db) => {
    const owner = await account(db);
    const insert = `INSERT INTO webauthn_credentials
      (id, account_id, credential_id, public_key, sign_count, transports)
      VALUES ($1, $2, $3, $4, $5, ARRAY['internal'])`;
    for (const counter of [-1, 4294967296]) {
      await rejected(db, '23514', 'ck_credential_sign_count', insert, [
        randomUUID(),
        owner,
        Buffer.from(randomUUID()),
        Buffer.from('synthetic-key'),
        counter,
      ]);
    }
    await db.query(insert, [
      randomUUID(),
      owner,
      Buffer.from(randomUUID()),
      Buffer.from('synthetic-key'),
      4294967295,
    ]);
  }));

test('revocation history preserves sessions and enforces their owner', () =>
  transaction(async (db) => {
    const owner = await account(db);
    const other = await account(db);
    const session = randomUUID();
    await db.query(
      "INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, '2099-01-01Z')",
      [session, owner, hash()],
    );
    const insert = `INSERT INTO access_revocations (id, account_id, session_id, reason, source)
      VALUES ($1, $2, $3, 'Synthetic revoke', 'integration-test')`;
    await rejected(db, '23503', 'fk_revocation_session_owner', insert, [
      randomUUID(),
      other,
      session,
    ]);
    await db.query(insert, [randomUUID(), owner, session]);
    await rejected(
      db,
      '23001',
      'fk_revocation_session_owner',
      'DELETE FROM sessions WHERE id = $1',
      [session],
    );
  }));

test('CRM preserves duplicate contacts and enforces targets and task idempotency', () =>
  transaction(async (db) => {
    const recorder = await staff(db, 'MANAGER');
    const child = await student(db);
    const sibling = await student(db);
    assert.notEqual(child, sibling);
    const lead = randomUUID();
    await db.query(
      "INSERT INTO leads (id, full_name, phone) VALUES ($1, 'Synthetic contact', '+000000000')",
      [lead],
    );
    await rejected(
      db,
      '23514',
      'ck_manager_one_target',
      'INSERT INTO assigned_managers (id, manager_id, lead_id, student_id) VALUES ($1, $2, $3, $4)',
      [randomUUID(), recorder.id, lead, child],
    );
    await rejected(
      db,
      '23514',
      'ck_contact_target',
      "INSERT INTO contact_logs (id, manager_id, channel, outcome) VALUES ($1, $2, 'CALL', 'Synthetic')",
      [randomUUID(), recorder.id],
    );
    const key = randomUUID();
    const task = `INSERT INTO crm_tasks (id, lead_id, type, title, due_at, idempotency_key)
      VALUES ($1, $2, 'FOLLOW_UP', 'Synthetic task', now(), $3)`;
    await db.query(task, [randomUUID(), lead, key]);
    await rejected(db, '23505', 'crm_tasks_idempotency_key_key', task, [randomUUID(), lead, key]);
    assert.equal(
      (
        await db.query('SELECT id FROM student_accounts WHERE student_id IN ($1, $2)', [
          child,
          sibling,
        ])
      ).rowCount,
      0,
    );
  }));

test('generated Prisma delegates read/write UUID models against PostgreSQL 18', async () => {
  const client = createDirectClient({ DIRECT_URL: connectionString });
  assert.equal(client.ok, true);
  let child;
  try {
    child = await client.value.student.create({ data: { full_name: 'Synthetic Prisma child' } });
    assert.match(child.id, /^[0-9a-f-]{36}$/);
    assert.equal(
      (await client.value.student.findUnique({ where: { id: child.id } })).full_name,
      child.full_name,
    );
  } finally {
    if (child) await client.value.student.delete({ where: { id: child.id } });
    await client.value.$disconnect();
  }
});

test('concurrent active household inserts commit exactly one membership', async () => {
  const recorder = await staff(pool);
  const child = await student(pool);
  const groups = [await household(pool), await household(pool)];
  try {
    const results = await Promise.allSettled(
      groups.map((group) => membership(pool, child, group, recorder.id)),
    );
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    const failure = results.find((result) => result.status === 'rejected');
    assert.ok(['23505', '23P01'].includes(failure.reason.code));
  } finally {
    await pool.query('DELETE FROM household_memberships WHERE student_id = $1', [child]);
    await pool.query('DELETE FROM households WHERE id = ANY($1::uuid[])', [groups]);
    await pool.query('DELETE FROM students WHERE id = $1', [child]);
    await pool.query('DELETE FROM role_assignments WHERE account_id = $1', [recorder.accountId]);
    await pool.query('DELETE FROM staff_accounts WHERE id = $1', [recorder.id]);
    await pool.query('DELETE FROM auth_accounts WHERE id = $1', [recorder.accountId]);
  }
});
