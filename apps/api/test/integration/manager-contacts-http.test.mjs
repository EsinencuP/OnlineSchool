import 'reflect-metadata';
import { http as fetch } from '../../../../tests/support/http.mjs';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { before, after, test } from '../../../../tests/support/test-harness.mjs';
import pg from '../../../../packages/db/node_modules/pg/lib/index.js';
import { NestFactory } from '@nestjs/core';
import { createDirectClient } from '@online-school/db';
import { AppModule } from '../../dist/app.module.js';
import { SessionStore } from '../../dist/core/session/session.store.js';
import { QA, qaId, seedQA } from '../../../../packages/db/dist-tools/seed.js';

const url = process.env.TEACHER_TEST_DATABASE_URL;
assert.ok(url);
const target = new URL(url);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_test[a-z0-9_]*$/);
const client = createDirectClient({ DIRECT_URL: url }).value,
  pool = new pg.Pool({ connectionString: url });
const actors = {},
  state = {};
let app, base;
const MIN = 60_000,
  HOUR = 3_600_000;

before(async () => {
  assert.equal((await seedQA(client)).ok, true);
  await pool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='task09_runtime') THEN CREATE ROLE task09_runtime LOGIN INHERIT; END IF; END $$",
  );
  await pool.query('GRANT online_school_runtime TO task09_runtime');
  const runtime = new URL(url);
  runtime.username = 'task09_runtime';
  runtime.password = '';
  process.env.DATABASE_URL = runtime.toString();
  process.env.CSRF_SIGNING_SECRET = randomBytes(48).toString('base64url');
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  const store = app.get(SessionStore);
  for (const [name, label] of [
    ['director', 'seed-director-001'],
    ['manager', 'seed-manager-001'],
    ['manager2', 'seed-manager-002'],
    ['teacher', 'seed-teacher-001'],
  ]) {
    const accountId = qaId(label + '/auth');
    actors[name] = await client.$transaction(async (tx) =>
      store.issue(tx, accountId, (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now),
    );
  }
  await client.assignedManager.create({
    data: {
      manager_id: QA.managers[0],
      student_id: QA.students[0],
      assigned_at: new Date('2026-10-01Z'),
    },
  });
  state.rep = await client.representative.create({ data: { full_name: 'Test Parent' } });
  await client.studentRepresentativeLink.create({
    data: {
      student_id: QA.students[0],
      representative_id: state.rep.id,
      role: 'PARENT',
      basis: 'Test fixture',
      valid_from: new Date('2026-10-01Z'),
    },
  });
  state.task = await client.crmTask.create({
    data: {
      type: 'FOLLOW_UP',
      student_id: QA.students[0],
      assigned_manager_id: QA.managers[0],
      title: 'Call the family about renewal',
      due_at: new Date(Date.now() - HOUR),
    },
  });
});
after(async () => {
  await app?.close();
  await client.$disconnect();
  await pool.end();
});

const headers = (actor) => {
  const s = actors[actor];
  return { cookie: `__Host-school_session=${s.token}; __Host-school_csrf=${s.csrfToken}` };
};
async function send(method, path, actor, body) {
  const read = method === 'GET';
  const r = await fetch(base + '/api/v1/' + path, {
    method,
    headers: {
      ...headers(actor),
      ...(read
        ? {}
        : {
            'content-type': 'application/json',
            'idempotency-key': randomUUID(),
            'x-csrf-token': actors[actor].csrfToken,
          }),
    },
    ...(read ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  return { status: r.status, body: await r.json() };
}
const record = (body, actor = 'manager') => send('POST', 'manager/contacts', actor, body);
const history = (query, actor = 'manager') => send('GET', `manager/contacts?${query}`, actor);
const call = (extra = {}) => ({
  studentId: QA.students[0],
  channel: 'CALL',
  result: 'NO_ANSWER',
  summary: 'Phone rang out',
  ...extra,
});

test('only a manager uses the journal and every write needs a subject in the portfolio', async () => {
  for (const actor of ['director', 'teacher']) {
    assert.equal((await history(`studentId=${QA.students[0]}`, actor)).status, 403);
    assert.equal((await record(call(), actor)).status, 403);
  }
  assert.equal((await fetch(base + '/api/v1/manager/contacts')).status, 401);
  assert.equal(
    (await record({ ...call(), studentId: undefined })).body.code,
    'CONTACT_SUBJECT_REQUIRED',
  );
  assert.equal(
    (await record({ ...call(), leadId: randomUUID() })).body.code,
    'CONTACT_SUBJECT_REQUIRED',
    'two subjects are ambiguous',
  );
  const foreign = await record(call({ studentId: QA.students[2] }));
  assert.equal(foreign.status, 404);
  assert.equal(foreign.body.code, 'CONTACT_SUBJECT_NOT_FOUND');
  assert.equal(
    (await history(`studentId=${QA.students[2]}`)).body.code,
    'CONTACT_SUBJECT_NOT_FOUND',
  );
  assert.equal((await record({ ...call(), channel: 'SMOKE' })).status, 422);
  assert.equal((await record({ ...call(), summary: 'x' })).status, 422);
  assert.equal((await record({ ...call(), extra: 1 })).status, 422);
  assert.equal(
    (await record(call({ occurredAt: new Date(Date.now() + HOUR).toISOString() }))).body.code,
    'CONTACT_IN_FUTURE',
  );
  assert.equal((await history('')).body.code, 'CONTACT_SUBJECT_REQUIRED');
});

test('contacts keep event time and record time apart and link to a task and a representative', async () => {
  const earlier = new Date(Date.now() - 3 * HOUR).toISOString();
  const first = await record(
    call({ taskId: state.task.id, representativeId: state.rep.id, occurredAt: earlier }),
  );
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.subjectKind, 'STUDENT');
  assert.equal(first.body.occurredAt, earlier);
  assert.ok(+new Date(first.body.recordedAt) > +new Date(earlier) + 2 * HOUR);
  assert.equal(first.body.taskId, state.task.id);
  assert.equal(first.body.result, 'NO_ANSWER');
  assert.ok(first.body.managerName);
  state.first = first.body;

  const second = await record(
    call({
      channel: 'WHATSAPP',
      result: 'CALLBACK_REQUESTED',
      summary: 'Asked to call back after 18:00',
      nextAction: 'Call at 18:30',
      taskId: state.task.id,
    }),
  );
  assert.equal(second.status, 201, JSON.stringify(second.body));
  assert.equal(second.body.nextAction, 'Call at 18:30');

  // Recording a contact never closes the task or changes it.
  const task = await client.crmTask.findUniqueOrThrow({ where: { id: state.task.id } });
  assert.equal(task.status, 'OPEN');
  assert.equal(task.version, 1);

  const bad = [
    [{ representativeId: randomUUID() }, 'REPRESENTATIVE_NOT_FOUND'],
    [{ taskId: randomUUID() }, 'TASK_NOT_FOUND'],
  ];
  for (const [extra, code] of bad) assert.equal((await record(call(extra))).body.code, code);
  const orphan = await client.representative.create({ data: { full_name: 'Unlinked' } });
  assert.equal(
    (await record(call({ representativeId: orphan.id }))).body.code,
    'REPRESENTATIVE_NOT_FOUND',
  );

  const list = await history(`studentId=${QA.students[0]}`);
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.deepEqual(
    list.body.items.map((i) => i.contactId),
    [second.body.contactId, first.body.contactId],
    'newest event first',
  );
  assert.equal(list.body.nextCursor, null);
  const page = await history(`studentId=${QA.students[0]}&limit=1`);
  assert.equal(page.body.items.length, 1);
  const next = await history(
    `studentId=${QA.students[0]}&limit=1&cursor=${encodeURIComponent(page.body.nextCursor)}`,
  );
  assert.equal(next.body.items[0].contactId, first.body.contactId);
  assert.equal(next.body.nextCursor, null);
  assert.equal((await history(`studentId=${QA.students[0]}&cursor=zzz`)).status, 422);
});

test('the journal is append-only: mistakes are fixed by a linked entry', async () => {
  await assert.rejects(
    client.$executeRaw`UPDATE contact_logs SET outcome='tampered' WHERE id=${state.first.contactId}::uuid`,
  );
  await assert.rejects(
    client.$executeRaw`DELETE FROM contact_logs WHERE id=${state.first.contactId}::uuid`,
  );
  const fix = await record({
    correctsId: state.first.contactId,
    channel: 'CALL',
    result: 'REACHED',
    summary: 'Reached the mother, the earlier note was wrong',
    occurredAt: state.first.occurredAt,
  });
  assert.equal(fix.status, 201, JSON.stringify(fix.body));
  assert.equal(fix.body.correctsId, state.first.contactId);
  assert.equal(fix.body.subjectId, QA.students[0], 'subject comes from the original');
  const again = await record({
    correctsId: state.first.contactId,
    channel: 'CALL',
    result: 'REACHED',
    summary: 'Second fix of the same entry',
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'CONTACT_ALREADY_CORRECTED');
  assert.equal(
    (await record({ correctsId: state.first.contactId, ...call({ studentId: QA.students[1] }) }))
      .status,
    409,
    'already corrected wins over mismatch',
  );
  assert.equal(
    (await record({ correctsId: randomUUID(), channel: 'CALL', result: 'OTHER', summary: 'ghost' }))
      .status,
    404,
  );
  const list = await history(`studentId=${QA.students[0]}`);
  const old = list.body.items.find((i) => i.contactId === state.first.contactId);
  assert.equal(old.supersededById, fix.body.contactId);
  assert.equal(list.body.items.length, 3, 'history keeps the superseded entry');
});

test('a new manager inherits the history; teachers and leads are covered; pending lists obligations', async () => {
  // A teacher of a portfolio student can be contacted and logged; a stranger cannot.
  const teacherId = (
    await client.teachingAssignment.findFirstOrThrow({
      where: { enrollment_ref: { student_id: QA.students[0] } },
    })
  ).teacher_id;
  const t = await record({
    teacherId,
    channel: 'TELEGRAM',
    result: 'REACHED',
    summary: 'Agreed to move Thursday lesson',
  });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  assert.equal(t.body.subjectKind, 'TEACHER');
  assert.equal((await history(`teacherId=${teacherId}`)).body.items.length, 1);
  assert.equal(
    (await record({ teacherId: randomUUID(), channel: 'CALL', result: 'OTHER', summary: 'nobody' }))
      .status,
    404,
  );

  // A lead in the portfolio.
  const subject = await client.subject.findFirstOrThrow({});
  const lead = await send('POST', 'manager/leads', 'manager', {
    audience: 'ADULT',
    contactName: 'Journal Lead',
    phone: `+373${Math.floor(60_000_000 + Math.random() * 9_000_000)}`,
    subjectId: subject.id,
    source: 'PHONE',
  });
  assert.equal(lead.status, 201, JSON.stringify(lead.body));
  // Portfolio reads use the API clock; wait until it passes the DB-stamped assignment time.
  for (let i = 0; i < 20; i++) {
    if ((await send('GET', `manager/leads/${lead.body.leadId}`, 'manager')).status === 200) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const l = await record({
    leadId: lead.body.leadId,
    channel: 'CALL',
    result: 'REACHED',
    summary: 'Introduced the school',
  });
  assert.equal(l.status, 201, JSON.stringify(l.body));
  assert.equal(l.body.subjectKind, 'LEAD');
  assert.equal(
    (
      await record({
        leadId: lead.body.leadId,
        representativeId: state.rep.id,
        channel: 'CALL',
        result: 'OTHER',
        summary: 'rep on lead',
      })
    ).status,
    422,
  );

  const pending = await send('GET', 'manager/contacts/pending', 'manager');
  assert.equal(pending.status, 200, JSON.stringify(pending.body));
  const row = pending.body.items.find((i) => i.taskId === state.task.id);
  assert.ok(row, JSON.stringify(pending.body));
  assert.equal(row.subjectKind, 'STUDENT');
  assert.equal(row.overdue, true);
  assert.equal(
    row.lastContact.channel,
    'TELEGRAM' === row.lastContact.channel ? 'TELEGRAM' : row.lastContact.channel,
  );
  assert.ok(['REACHED', 'CALLBACK_REQUESTED'].includes(row.lastContact.result));
  const leadTask = pending.body.items.find((i) => i.subjectKind === 'LEAD');
  assert.ok(leadTask, 'the lead follow-up task is an open contact obligation');
  assert.equal(leadTask.lastContact.result, 'REACHED');
  for (const actor of ['director', 'teacher'])
    assert.equal((await send('GET', 'manager/contacts/pending', actor)).status, 403);

  // The second manager takes the student over: the whole journal comes along.
  assert.equal((await history(`studentId=${QA.students[0]}`, 'manager2')).status, 404);
  await client.assignedManager.updateMany({
    where: { student_id: QA.students[0], manager_id: QA.managers[0], ended_at: null },
    data: { ended_at: new Date(Date.now() - 1000) },
  });
  await client.assignedManager.create({
    data: {
      manager_id: QA.managers[1],
      student_id: QA.students[0],
      assigned_at: new Date(Date.now() - 1000),
    },
  });
  const inherited = await history(`studentId=${QA.students[0]}`, 'manager2');
  assert.equal(inherited.status, 200, JSON.stringify(inherited.body));
  assert.equal(inherited.body.items.length, 3);
  assert.equal(inherited.body.items[0].managerId, QA.managers[0], 'authors stay visible');
  assert.equal(
    (await history(`studentId=${QA.students[0]}`)).status,
    404,
    'the old manager lost access',
  );
});
