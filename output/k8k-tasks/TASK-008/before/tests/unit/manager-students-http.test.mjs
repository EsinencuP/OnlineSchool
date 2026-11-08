import { beforeAll, beforeEach, afterAll, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { managerFixture } from '../support/manager-crm-fixture.mjs';
let f, own, foreign;
beforeAll(async () => {
  f = await managerFixture();
});
afterAll(async () => f?.app.close());
beforeEach(async () => {
  await f.reset();
  own = f.addStudent();
  foreign = f.addStudent(1, { full_name: 'Foreign secret' });
});

test.each([
  ['get', 'list'],
  ['get', 'card'],
  ['post', 'list'],
  ['patch', 'contacts'],
])('anonymous %s %s is 401', async (verb, view) => {
  const res = await f.api(
    verb,
    view === 'card' ? `/${own.id}` : verb === 'patch' ? `/${own.id}/contacts` : '',
    null,
    {
      body: verb === 'get' ? undefined : { fullName: 'New', version: 1 },
      key: randomUUID(),
    },
  );
  expect(res.status).toBe(401);
});
test.each([2, 3, 4, 5])('forbidden role %i is 403 on all four routes', async (index) => {
  for (const [verb, path, body] of [
    ['get', '', undefined],
    ['get', `/${own.id}`, undefined],
    ['post', '', { fullName: 'New student' }],
    ['patch', `/${own.id}/contacts`, { version: 1, phone: '+373123456' }],
  ]) {
    const res = await f.api(verb, path, index, { body, key: randomUUID() });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  }
});
test('list is portfolio-only, hides raw contacts and uses one business query', async () => {
  const res = await f.api('get', '');
  expect(res.status).toBe(200);
  expect(res.body.items.map((s) => s.studentId)).toEqual([own.id]);
  expect(res.body.items[0]).toMatchObject({
    maskedPhone: '***42',
    balance: '0.0000',
    balanceCurrency: 'MDL',
  });
  for (const value of [foreign.id, foreign.full_name, own.phone, own.email, own.manager_note])
    expect(JSON.stringify(res.body)).not.toContain(value);
  expect(f.state.businessQueries).toHaveLength(1);
});
test.each([
  '?limit=0',
  '?limit=101',
  '?limit=2.5',
  '?search=x',
  '?hasOverdueTask=maybe',
  '?subscriptionExpiringSoon=1',
  '?sort=secret',
  '?managerId=spoof',
  '?status=INVALID',
])('query %s is strictly rejected with 422', async (query) => {
  const res = await f.api('get', query);
  expect(res.status).toBe(422);
});
test('card is audited on every open and contains only allowed educational aggregates', async () => {
  for (let i = 0; i < 2; i++) {
    const res = await f.api('get', `/${own.id}`);
    expect(res.status).toBe(200);
    expect(res.body.contacts.phone).toBe(own.phone);
    expect(Object.keys(res.body.learning).sort()).toEqual(
      [
        'skillsMastered',
        'skillsTotal',
        'homeworkSubmitted',
        'homeworkPending',
        'homeworkOverdue',
        'lastReportAt',
        'lastReportStatus',
      ].sort(),
    );
  }
  expect(f.state.audit.filter((a) => a.action === 'STUDENT_PII_VIEWED')).toHaveLength(2);
  for (const value of [own.phone, own.email, own.manager_note, foreign.full_name])
    expect(JSON.stringify(f.state.audit)).not.toContain(value);
});
test('foreign and missing card/update are identical 404 errors with no PII read', async () => {
  for (const verb of ['get', 'patch']) {
    const suffix = verb === 'patch' ? '/contacts' : '';
    const results = [];
    for (const id of [foreign.id, randomUUID(), 'invalid'])
      results.push(
        await f.api(verb, `/${id}${suffix}`, 0, {
          body: verb === 'patch' ? { version: 1, phone: '+373123456' } : undefined,
        }),
      );
    for (const res of results) {
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('STUDENT_NOT_FOUND');
    }
  }
  expect(f.state.businessQueries).toHaveLength(0);
});
test.each(['post', 'patch'])('%s without CSRF is rejected before mutation', async (verb) => {
  const res = await f.api(verb, verb === 'patch' ? `/${own.id}/contacts` : '', 0, {
    csrf: false,
    key: randomUUID(),
    body: verb === 'post' ? { fullName: 'New student' } : { version: 1, phone: '+373123456' },
  });
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('CSRF_INVALID');
  expect(f.state.students.size).toBe(2);
  expect(f.state.students.get(own.id).version).toBe(1);
});
test.each(['managerId', 'status', 'hasAccount', 'fullName'])(
  'PATCH rejects forbidden field %s',
  async (field) => {
    const res = await f.api('patch', `/${own.id}/contacts`, 0, {
      body: { version: 1, [field]: 'spoof' },
    });
    expect(res.status).toBe(422);
  },
);
test('create is concurrent-idempotent, creates only a registry identity and an unverified contact', async () => {
  const key = randomUUID(),
    body = {
      fullName: 'New student',
      phone: '+373123456',
      email: 'new@example.invalid',
      guardianName: 'Contact',
      managerNote: 'sensitive note',
    };
  const results = await Promise.all([
    f.api('post', '', 0, { key, body }),
    f.api('post', '', 0, { key, body }),
  ]);
  expect(results.map((r) => r.status)).toEqual([201, 201]);
  expect(results[0].body).toEqual(results[1].body);
  expect(f.state.students.size).toBe(3);
  expect(f.state.students.get(results[0].body.studentId).managerId).toBe(f.accounts[0].staffId);
  expect(results[0].body.hasAccount).toBe(false);
  expect(results[0].body.contacts.guardianName).toBe('Contact');
  expect(f.state.links[0]).toMatchObject({
    verification_status: 'PENDING',
    basis: 'CRM_CONTACT_ONLY',
  });
  expect(f.client.authAccount.create).not.toHaveBeenCalled();
  expect(f.client.studentAccount.create).not.toHaveBeenCalled();
  const mismatch = await f.api('post', '', 0, { key, body: { ...body, fullName: 'Changed' } });
  expect(mismatch.status).toBe(409);
  expect(mismatch.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  for (const value of [body.phone, body.email, body.managerNote, body.guardianName])
    expect(JSON.stringify([...f.state.audit, ...f.state.outbox])).not.toContain(value);
});
test('replaying creation after reassignment is 404 and never returns cached contacts', async () => {
  const key = randomUUID(),
    body = { fullName: 'New student', phone: '+373123456' };
  const created = await f.api('post', '', 0, { key, body });
  expect(created.status).toBe(201);
  f.state.students.get(created.body.studentId).managerId = f.accounts[1].staffId;
  const replay = await f.api('post', '', 0, { key, body });
  expect(replay.status).toBe(404);
  expect(replay.body.code).toBe('STUDENT_NOT_FOUND');
  expect(JSON.stringify(replay.body)).not.toContain(body.phone);
});
test('successful contact update increments version and logs only fields/redactions', async () => {
  const res = await f.api('patch', `/${own.id}/contacts`, 0, {
    body: { version: 1, phone: '+373999999', managerNote: 'new private note' },
  });
  expect(res.status).toBe(200);
  expect(res.body.version).toBe(2);
  expect(res.body.contacts.phone).toBe('+373999999');
  const event = f.state.audit.find((a) => a.action === 'STUDENT_CONTACTS_UPDATED');
  expect(event.metadata.changedFields).toEqual(['phone', 'managerNote']);
  expect(f.state.outbox[0].audit_event_id).toBe(event.id);
  expect(JSON.stringify([...f.state.audit, ...f.state.outbox])).not.toContain('new private note');
  const conflict = await f.api('patch', `/${own.id}/contacts`, 0, {
    body: { version: 1, email: 'changed@example.invalid' },
  });
  expect(conflict.status).toBe(409);
  expect(conflict.body.code).toBe('VERSION_CONFLICT');
  expect(f.state.students.get(own.id).email).toBe(own.email);
});
test('competing versions allow one winner and return 409 to the other writer', async () => {
  const responses = await Promise.all(
    ['+373111111', '+373222222'].map((phone) =>
      f.api('patch', `/${own.id}/contacts`, 0, { body: { version: 1, phone } }),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(f.state.students.get(own.id).version).toBe(2);
  expect(f.state.audit.filter((a) => a.action === 'STUDENT_CONTACTS_UPDATED')).toHaveLength(1);
});
test.each(['audit', 'outbox', 'read'])(
  'PATCH %s failure rolls back contact, version, audit and outbox',
  async (failure) => {
    const previousPhone = own.phone;
    f.state.failAudit = failure === 'audit' ? 'STUDENT_CONTACTS_UPDATED' : null;
    f.state.failOutbox = failure === 'outbox';
    f.state.failRead = failure === 'read';
    const res = await f.api('patch', `/${own.id}/contacts`, 0, {
      body: { version: 1, phone: '+373999999' },
    });
    expect(res.status).toBe(503);
    expect(f.state.students.get(own.id)).toMatchObject({ version: 1, phone: previousPhone });
    expect(f.state.audit.filter((a) => a.result === 'SUCCESS')).toHaveLength(0);
    expect(f.state.outbox).toHaveLength(0);
  },
);
test('PII audit failure prevents GET card response', async () => {
  f.state.failAudit = 'STUDENT_PII_VIEWED';
  const res = await f.api('get', `/${own.id}`);
  expect(res.status).toBe(503);
  expect(res.body.code).toBe('AUDIT_UNAVAILABLE');
  expect(JSON.stringify(res.body)).not.toContain(own.phone);
});
test('create outbox failure rolls back identity, links, audit and idempotency cache', async () => {
  f.state.failOutbox = true;
  const res = await f.api('post', '', 0, {
    key: randomUUID(),
    body: { fullName: 'New student', guardianName: 'Contact' },
  });
  expect(res.status).toBe(503);
  expect(f.state.students.size).toBe(2);
  expect(f.state.links).toHaveLength(0);
  expect(f.state.idem.size).toBe(0);
  expect(f.state.audit.filter((a) => a.result === 'SUCCESS')).toHaveLength(0);
});
test('list and card expose negative ledger balance and independent currencies without adding pending payments', async () => {
  const row = f.state.students.get(own.id);
  row.ledgerBalance = '-20.1234';
  row.ledgerBalances = [
    { currency: 'MDL', amount: '-20.1234' },
    { currency: 'EUR', amount: '90.0010' },
  ];
  row.payments = [
    {
      id: randomUUID(),
      amount: '1000.0000',
      currency: 'MDL',
      status: 'PENDING',
      registeredAt: new Date().toISOString(),
      confirmedAt: null,
    },
  ];
  const list = await f.api('get', ''),
    card = await f.api('get', `/${own.id}`);
  expect(list.body.items[0].balance).toBe('-20.1234');
  expect(card.body.balance).toBe('-20.1234');
  expect(card.body.balances).toEqual([
    { currency: 'EUR', amount: '90.0010' },
    { currency: 'MDL', amount: '-20.1234' },
  ]);
  expect(card.body.recentPayments[0]).toMatchObject({ status: 'PENDING', amount: '1000.0000' });
});
test.each(['managerId', 'studentId', 'status', 'hasAccount'])(
  'POST rejects server-owned field %s and does not create an identity',
  async (field) => {
    const res = await f.api('post', '', 0, {
      key: randomUUID(),
      body: { fullName: 'New student', [field]: foreign.id },
    });
    expect(res.status).toBe(422);
    expect(f.state.students.size).toBe(2);
    expect(f.state.idem.size).toBe(0);
  },
);
test('replacing guardian contact never renames the shared representative', async () => {
  const made = await f.api('post', '', 0, {
    key: randomUUID(),
    body: { fullName: 'New student', guardianName: 'Original contact' },
  });
  const link = f.state.links[0],
    previousId = link.representative_id;
  const changed = await f.api('patch', `/${made.body.studentId}/contacts`, 0, {
    body: { version: 1, guardianName: 'Replacement contact' },
  });
  expect(changed.status).toBe(200);
  expect(changed.body.contacts.guardianName).toBe('Replacement contact');
  expect(f.state.representatives.get(previousId).full_name).toBe('Original contact');
  expect(link.valid_to).toBeInstanceOf(Date);
  expect(f.state.links[1]).toMatchObject({
    verification_status: 'PENDING',
    basis: 'CRM_CONTACT_ONLY',
  });
});
