import { beforeAll, beforeEach, afterAll, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { managerLeadsFixture } from '../support/manager-leads-fixture.mjs';
import { applyLeadEvent } from '../../apps/api/dist/modules/manager/leads/worker.js';
import { unwrap } from '../../apps/api/dist/core/errors/domain-error.js';
let fx, f;
beforeAll(async () => {
  fx = await managerLeadsFixture();
  f = fx.f;
});
beforeEach(async () => f.reset());
afterAll(async () => f?.app.close());
const api = (verb, path = '', index = 0, body, key = randomUUID(), csrf = true) =>
  f.api(verb, '/api/v1/manager/leads' + path, index, { body, key, csrf });
const dto = (patch = {}) => ({
  audience: 'CHILD',
  contactName: 'Trial student',
  guardianName: 'Guardian',
  phone: '+373 60000123',
  email: 'contact@example.test',
  subjectId: fx.subjectId,
  source: 'PHONE',
  ...patch,
});
const create = async (patch = {}, index = 0) => {
  const res = await api('post', '', index, dto(patch));
  expect(res.status).toBe(201);
  return res.body;
};
const claim = async (lead) => {
  const res = await api('post', `/${lead.leadId}/claim`, 0, { version: lead.version });
  expect(res.status).toBe(200);
  return res.body;
};
const trial = async (lead) =>
  api('post', `/${lead.leadId}/trial`, 0, {
    version: lead.version,
    teacherId: fx.teacherId,
    startsAt: new Date(+f.state.now + 2 * 3600000).toISOString(),
  });

test('new lead is separate from student/account; tasks, audit and outbox commit together', async () => {
  const lead = await create();
  expect(lead.stage).toBe('NEW');
  expect(lead.studentId).toBeNull();
  expect(f.state.students.size).toBe(0);
  expect(lead.openTasks.map((t) => t.type).sort()).toEqual(['ASSIGN_TEACHER', 'LEAD_FOLLOWUP']);
  expect(+new Date(lead.nextActionAt) - +f.state.now).toBe(120 * 60000);
  expect(f.client.studentAccount.create).not.toHaveBeenCalled();
  expect(f.state.audit.some((a) => a.action === 'LEAD_CREATED')).toBe(true);
  expect(JSON.stringify(f.state.audit)).not.toContain(lead.phone);
  expect(JSON.stringify(f.state.outbox)).not.toContain(lead.email);
});
test('list masks contacts; own duplicate is suspected but other portfolio is never checked', async () => {
  const own = await create();
  await create({ contactName: 'Foreign secret' }, 1);
  const list = await api('get');
  expect(list.status).toBe(200);
  expect(list.body.items.map((l) => l.leadId)).toEqual([own.leadId]);
  for (const secret of [own.phone, own.email, 'Foreign secret'])
    expect(JSON.stringify(list.body)).not.toContain(secret);
  const duplicate = await api('post', '', 0, dto());
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.details.existingId).toBe(own.leadId);
  const forced = await create({ forceCreate: true });
  expect(forced.leadId).not.toBe(own.leadId);
  expect(f.state.audit.findLast((a) => a.action === 'LEAD_CREATED').metadata.forceCreate).toBe(
    true,
  );
});
test('create replay stays scoped after reassignment; mismatched payload conflicts', async () => {
  const key = randomUUID(),
    first = await api('post', '', 0, dto(), key),
    again = await api('post', '', 0, dto(), key);
  expect(again.body.leadId).toBe(first.body.leadId);
  expect(f.state.leads.size).toBe(1);
  expect((await api('post', '', 0, dto({ contactName: 'Changed' }), key)).status).toBe(409);
  f.state.leads.get(first.body.leadId).managerId = f.accounts[1].staffId;
  expect((await api('post', '', 0, dto(), key)).status).toBe(404);
});
test.each([
  {},
  { phone: undefined, email: undefined },
  { guardianName: undefined },
  { audience: 'CHILD', guardianName: '' },
  { subjectId: 'bad-id' },
])('invalid input does not write: %j', async (patch) => {
  const input = Object.keys(patch).length ? dto(patch) : {};
  const res = await api('post', '', 0, input);
  expect(res.status).toBe(422);
  expect(f.state.leads.size).toBe(0);
  expect(f.state.audit.filter((a) => a.resource_type === 'Lead')).toHaveLength(0);
});
test.each([null, 2, 3, 4, 5])('role/session matrix %s', async (index) => {
  const lead = await create();
  for (const [verb, path, body] of [
    ['get', '', undefined],
    ['get', '/summary', undefined],
    ['get', `/${lead.leadId}`, undefined],
    ['post', '', dto()],
    ['patch', `/${lead.leadId}`, { version: 1 }],
    ...['claim', 'trial', 'transition', 'lose', 'reopen'].map((p) => [
      'post',
      `/${lead.leadId}/${p}`,
      { version: 1 },
    ]),
  ]) {
    expect((await api(verb, path, index, body)).status).toBe(index === null ? 401 : 403);
  }
});
test('foreign, unassigned and absent leads have the same 404 on detail and all resource mutations', async () => {
  const other = await create({}, 1),
    unassigned = await create({ phone: '+37369999999', email: 'unassigned@example.test' });
  f.state.leads.get(unassigned.leadId).managerId = null;
  for (const id of [other.leadId, unassigned.leadId, randomUUID()])
    for (const [verb, path] of [
      ['get', ''],
      ['patch', ''],
      ...['claim', 'trial', 'transition', 'lose', 'reopen'].map((p) => ['post', '/' + p]),
    ]) {
      const res = await api(verb, `/${id}${path}`, 0, verb === 'get' ? undefined : { version: 1 });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('LEAD_NOT_FOUND');
    }
});
test('mutations require CSRF; claim closes only first-contact task; stale version rolls back', async () => {
  const lead = await create();
  expect(
    (await api('post', `/${lead.leadId}/claim`, 0, { version: 1 }, randomUUID(), false)).status,
  ).toBe(403);
  const claimed = await claim(lead);
  expect(claimed.openTasks.map((t) => t.type)).toEqual(['ASSIGN_TEACHER']);
  const before = f.state.audit.length;
  expect(
    (await api('patch', `/${lead.leadId}`, 0, { version: 1, comment: 'stale' })).body.code,
  ).toBe('LEAD_VERSION_CONFLICT');
  expect(f.state.audit.length).toBe(before);
});
test.each(['LEAD_CREATED', 'outbox'])(
  'failure of %s rolls back lead, tasks, audit and outbox',
  async (failure) => {
    if (failure === 'outbox') f.state.failOutbox = true;
    else f.state.failAudit = failure;
    expect((await api('post', '', 0, dto())).status).toBe(503);
    expect(f.state.leads.size).toBe(0);
    expect(f.state.tasks.size).toBe(0);
    expect(f.state.audit).toHaveLength(0);
  },
);
test('trial atomically creates LEAD student and TRIAL without paid subscription, grant, consumption or ledger', async () => {
  const claimed = await claim(await create()),
    scheduled = await trial(claimed);
  expect(scheduled.status).toBe(200);
  expect(scheduled.body.stage).toBe('TRIAL');
  expect(scheduled.body.studentId).toBeTruthy();
  expect(scheduled.body.openTasks).toHaveLength(0);
  const lesson = f.state.lessons.get(scheduled.body.trial.lessonId);
  expect(lesson.kind).toBe('TRIAL');
  expect(lesson.manager_subscription_id).toBeNull();
  expect(+lesson.scheduled_end_at - +lesson.scheduled_at).toBe(50 * 60000);
  expect(f.client.studentAccount.create).not.toHaveBeenCalled();
  expect(f.state.entries.size).toBe(0);
  expect(f.state.consumptions.size).toBe(0);
  expect(f.state.grants.size).toBe(0);
  const dispatch = [...f.state.dispatches.values()].find((n) => n.lead_id === claimed.leadId);
  expect(dispatch?.channel).toBe('EMAIL');
  expect(dispatch?.recipient_email).toBe('contact@example.test');
  expect(
    (
      await api('post', `/${claimed.leadId}/transition`, 0, {
        version: scheduled.body.version,
        to: 'AWAITING_PAYMENT',
      })
    ).body.code,
  ).toBe('TRIAL_OUTCOME_REQUIRED');
});
test('slot conflict rolls back newly created student/link/lesson and preserves the lead version', async () => {
  const lead = await claim(await create());
  f.state.failExclusion = true;
  const res = await trial(lead);
  expect(res.status).toBe(409);
  expect(res.body.code).toBe('SLOT_CONFLICT');
  expect(f.state.students.size).toBe(0);
  expect(f.state.leadStudentLinks).toHaveLength(0);
  expect(f.state.lessons.size).toBe(0);
  expect(f.state.leads.get(lead.leadId).version).toBe(lead.version);
});
test('trial replay and two simultaneous attempts create a single lesson', async () => {
  const lead = await claim(await create()),
    key = randomUUID(),
    otherKey = randomUUID(),
    body = {
      version: lead.version,
      teacherId: fx.teacherId,
      startsAt: new Date(+f.state.now + 2 * 3600000).toISOString(),
    };
  const [a, b] = await Promise.all([
    api('post', `/${lead.leadId}/trial`, 0, body, key),
    api('post', `/${lead.leadId}/trial`, 0, body, otherKey),
  ]);
  expect([a.status, b.status].sort()).toEqual([200, 409]);
  expect(f.state.lessons.size).toBe(1);
  expect(f.state.students.size).toBe(1);
  const replay = await api(
    'post',
    `/${lead.leadId}/trial`,
    0,
    body,
    a.status === 200 ? key : otherKey,
  );
  expect(replay.status).toBe(200);
  expect(f.state.lessons.size).toBe(1);
});
test('skip-trial path requires reason and creates a CRM student without an account', async () => {
  const lead = await claim(await create());
  expect(
    (
      await api('post', `/${lead.leadId}/transition`, 0, {
        version: lead.version,
        to: 'AWAITING_PAYMENT',
      })
    ).status,
  ).toBe(422);
  const res = await api('post', `/${lead.leadId}/transition`, 0, {
    version: lead.version,
    to: 'AWAITING_PAYMENT',
    skipTrialReason: 'Ученик готов начать без пробного',
  });
  expect(res.status).toBe(200);
  expect(res.body.studentId).toBeTruthy();
  expect(f.state.lessons.size).toBe(0);
  expect(f.client.studentAccount.create).not.toHaveBeenCalled();
});
test('teacher reports attendance and feedback; manager cannot report; visibility flag redacts text', async () => {
  const res = await trial(await claim(await create()));
  expect(res.status).toBe(200);
  const lead = res.body,
    lesson = f.state.lessons.get(lead.trial.lessonId);
  f.state.now = new Date(+lesson.scheduled_end_at + 60000);
  const body = {
    result: 'CONDUCTED',
    actualStartedAt: lesson.scheduled_at.toISOString(),
    durationMin: 50,
    note: 'Teacher feedback: ready for regular lessons',
  };
  const manager = await f.api('post', `/api/v1/lessons/${lesson.id}/outcome`, 0, {
    body,
    key: randomUUID(),
  });
  expect(manager.status).toBe(403);
  const reported = await f.api('post', `/api/v1/lessons/${lesson.id}/outcome`, 3, {
    body,
    key: randomUUID(),
  });
  expect(reported.status).toBe(200);
  const viewed = await api('get', `/${lead.leadId}`);
  expect(viewed.body.trial.outcome).toBe('ATTENDED');
  expect(viewed.body.trial.feedbackSummary).toBe(body.note);
  const saved = process.env.TRIAL_FEEDBACK_VISIBLE_TO_MANAGER;
  try {
    process.env.TRIAL_FEEDBACK_VISIBLE_TO_MANAGER = 'false';
    expect((await api('get', `/${lead.leadId}`)).body.trial.feedbackSummary).toBeNull();
  } finally {
    saved === undefined
      ? delete process.env.TRIAL_FEEDBACK_VISIBLE_TO_MANAGER
      : (process.env.TRIAL_FEEDBACK_VISIBLE_TO_MANAGER = saved);
  }
  expect(
    (
      await api('post', `/${lead.leadId}/transition`, 0, {
        version: lead.version,
        to: 'AWAITING_PAYMENT',
      })
    ).status,
  ).toBe(200);
  expect(f.state.entries.size).toBe(0);
  expect(f.state.consumptions.size).toBe(0);
  const distributionId = randomUUID(),
    paymentId = randomUUID(),
    subscriptionId = randomUUID(),
    studentId = lead.studentId;
  const distribution = {
    approved_at: f.state.now,
    payment_ref: { confirmed_by_director_at: f.state.now, purpose: 'FIRST_PAYMENT' },
    subscription_ref: { enrollment_ref: { student_id: studentId } },
    ledger_document: {
      t03_ledgerentry_document_id: { published_at: f.state.now, effective_at: f.state.now },
    },
  };
  f.client.paymentDistribution.findUnique.mockResolvedValueOnce(distribution);
  expect(
    (
      await applyLeadEvent(
        f.client,
        {
          id: randomUUID(),
          aggregate_id: distributionId,
          topic: 'finance.lead-first-payment.allocated.v1',
          source_operation_id: randomUUID(),
        },
        f.state.now,
      )
    ).ok,
  ).toBe(true);
  expect(f.state.leads.get(lead.leadId).stage).toBe('CONVERTED');
  f.state.activationEvidence.set(studentId, {
    subscription_id: subscriptionId,
    distribution_id: distributionId,
    payment_id: paymentId,
    director_id: f.accounts[4].staffId,
    admission_id: null,
    basis: 'FULL_PAYMENT',
  });
  const account = await f.api('post', `/api/v1/manager/students/${studentId}/account`, 0, {
    body: { loginEmail: 'new-student@example.test' },
    key: randomUUID(),
  });
  expect(account.status).toBe(201);
  expect(typeof account.body.temporaryPassword).toBe('string');
  expect(f.state.leadProfiles.size).toBe(1);
});
test('cancelled trial never charges and worker replay creates only one followup', async () => {
  const scheduled = await trial(await claim(await create()));
  expect(scheduled.status).toBe(200);
  const lead = scheduled.body;
  const cancel = await f.api('post', `/api/v1/manager/lessons/${lead.trial.lessonId}/cancel`, 0, {
    body: { reason: 'Пробный отменён клиентом', chargeable: true },
    key: randomUUID(),
  });
  expect(cancel.status).toBe(200);
  expect(cancel.body.chargedLessons).toBe(0);
  const source = f.state.outbox.find(
      (e) => e.topic === 'schedule.lesson.changed.v1' && e.payload.action === 'LESSON_CANCELLED',
    ),
    event = { ...source, id: randomUUID() };
  const run = () =>
    f.client.$transaction(async (tx) => unwrap(await applyLeadEvent(tx, event, f.state.now)));
  await run();
  await run();
  const current = await api('get', `/${lead.leadId}`);
  expect(current.body.stage).toBe('IN_PROGRESS');
  expect(current.body.openTasks.filter((t) => t.type === 'LEAD_FOLLOWUP')).toHaveLength(1);
  expect(f.state.entries.size).toBe(0);
  expect(f.state.consumptions.size).toBe(0);
});
test('published FIRST_PAYMENT allocation converts exactly once; mere receipt or unpublished allocation does not', async () => {
  const lead = await claim(await create()),
    waiting = await api('post', `/${lead.leadId}/transition`, 0, {
      version: lead.version,
      to: 'AWAITING_PAYMENT',
      skipTrialReason: 'Пропуск по согласованию',
    });
  expect(waiting.status).toBe(200);
  const studentId = waiting.body.studentId,
    id = randomUUID(),
    event = {
      id: randomUUID(),
      aggregate_id: id,
      topic: 'finance.lead-first-payment.allocated.v1',
      source_operation_id: randomUUID(),
    },
    distribution = {
      approved_at: f.state.now,
      payment_ref: { confirmed_by_director_at: f.state.now, purpose: 'FIRST_PAYMENT' },
      subscription_ref: { enrollment_ref: { student_id: studentId } },
      ledger_document: {
        t03_ledgerentry_document_id: { published_at: null, effective_at: f.state.now },
      },
    };
  f.client.paymentDistribution.findUnique.mockResolvedValue(distribution);
  expect((await applyLeadEvent(f.client, event, f.state.now)).ok).toBe(true);
  expect(f.state.leads.get(lead.leadId).stage).toBe('AWAITING_PAYMENT');
  distribution.ledger_document.t03_ledgerentry_document_id.published_at = f.state.now;
  const run = () =>
    f.client.$transaction(async (tx) => unwrap(await applyLeadEvent(tx, event, f.state.now)));
  await run();
  await run();
  expect(f.state.leads.get(lead.leadId).stage).toBe('CONVERTED');
  expect(f.state.audit.filter((a) => a.action === 'LEAD_CONVERTED')).toHaveLength(1);
  expect(f.state.leadEvents.filter((e) => e.to_stage === 'CONVERTED')).toHaveLength(1);
  expect(f.client.studentAccount.create).not.toHaveBeenCalled();
  expect(
    (
      await api('patch', `/${lead.leadId}`, 0, {
        version: f.state.leads.get(lead.leadId).version,
        comment: 'terminal',
      })
    ).body.code,
  ).toBe('LEAD_TERMINAL');
});
test('loss archives an unpaid student; reopen revives only the archive created by that loss', async () => {
  const lead = await claim(await create()),
    waiting = await api('post', `/${lead.leadId}/transition`, 0, {
      version: lead.version,
      to: 'AWAITING_PAYMENT',
      skipTrialReason: 'Пропуск по согласованию',
    });
  expect(waiting.status).toBe(200);
  const student = f.state.students.get(waiting.body.studentId);
  student.archived_at = null;
  const lost = await api('post', `/${lead.leadId}/lose`, 0, {
    version: waiting.body.version,
    reason: 'PRICE',
  });
  expect(lost.status).toBe(200);
  expect(student.archived_at).toEqual(f.state.now);
  const reopened = await api('post', `/${lead.leadId}/reopen`, 0, { version: lost.body.version });
  expect(reopened.status).toBe(200);
  expect(student.archived_at).toBeNull();
});

test('published first payment after loss converts the lead and revives only its own archive', async () => {
  const lead = await claim(await create());
  const waiting = await api('post', `/${lead.leadId}/transition`, 0, {
    version: lead.version,
    to: 'AWAITING_PAYMENT',
    skipTrialReason: 'Без пробного',
  });
  const studentId = waiting.body.studentId;
  f.state.students.get(studentId).archived_at = null;
  const lost = await api('post', `/${lead.leadId}/lose`, 0, {
    version: waiting.body.version,
    reason: 'PRICE',
  });
  expect(lost.status).toBe(200);
  expect(f.state.students.get(studentId).archived_at).toEqual(f.state.now);
  const event = {
    id: randomUUID(),
    aggregate_id: randomUUID(),
    topic: 'finance.lead-first-payment.allocated.v1',
    source_operation_id: randomUUID(),
  };
  f.client.paymentDistribution.findUnique.mockResolvedValue({
    approved_at: f.state.now,
    payment_ref: { confirmed_by_director_at: f.state.now, purpose: 'FIRST_PAYMENT' },
    subscription_ref: { enrollment_ref: { student_id: studentId } },
    ledger_document: {
      t03_ledgerentry_document_id: { published_at: f.state.now, effective_at: f.state.now },
    },
  });
  expect((await applyLeadEvent(f.client, event, f.state.now)).ok).toBe(true);
  expect(f.state.leads.get(lead.leadId)).toMatchObject({
    stage: 'CONVERTED',
    lost_reason: null,
    archived_student_at: null,
  });
  expect(f.state.students.get(studentId).archived_at).toBeNull();
  expect(f.client.studentAccount.create).not.toHaveBeenCalled();
});
test('lead tasks appear in MGR07 with a lead link and nullable studentId', async () => {
  const lead = await create();
  const tasks = await f.api('get', '/api/v1/manager/tasks');
  expect(tasks.status).toBe(200);
  expect(
    tasks.body.items
      .filter((t) => t.leadId === lead.leadId)
      .map((t) => t.type)
      .sort(),
  ).toEqual(['ASSIGN_TEACHER', 'LEAD_FOLLOWUP']);
  expect(tasks.body.items.every((t) => t.studentId === null)).toBe(true);
});
test('missing contact email preserves trial and records failed CONTACT notification', async () => {
  const lead = await claim(await create({ email: undefined }));
  const scheduled = await trial(lead);
  expect(scheduled.status).toBe(200);
  const dispatch = [...f.state.dispatches.values()].find((n) => n.lead_id === lead.leadId);
  expect(dispatch).toMatchObject({
    channel: 'EMAIL',
    status: 'FAILED',
    failure_reason: 'NO_DELIVERY_CHANNEL',
  });
});
test('per-manager creation rate is enforced even for forceCreate', async () => {
  const prior = process.env.LEADS_PER_MANAGER_PER_MINUTE;
  process.env.LEADS_PER_MANAGER_PER_MINUTE = '2';
  try {
    await create();
    await create({ forceCreate: true });
    const denied = await api('post', '', 0, dto({ forceCreate: true }));
    expect(denied.status).toBe(429);
    expect(denied.body.code).toBe('LEAD_RATE_LIMITED');
    expect(f.state.leads.size).toBe(2);
  } finally {
    prior === undefined
      ? delete process.env.LEADS_PER_MANAGER_PER_MINUTE
      : (process.env.LEADS_PER_MANAGER_PER_MINUTE = prior);
  }
});
