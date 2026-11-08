import { expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import {
  listManagerSchedule,
  createManagerLesson,
  rescheduleManagerLesson,
  cancelManagerLesson,
  setManagerLessonMeetLink,
  clearManagerLessonMeetLink,
  getScheduleChangeApproval,
  approveScheduleChange,
} from '../../packages/api-contracts/dist/generated/client.js';
const lesson = {
  lessonId: 'lesson',
  studentId: 'student',
  startsAt: '2026-11-02T10:00:00.000Z',
  status: 'SCHEDULED',
  chargedLessons: 0,
  meetLink: null,
  pendingChangeId: null,
  requiresApproval: false,
};
test.each([
  [
    createManagerLesson,
    '/students/id/lessons',
    'POST',
    {
      teacherId: 't',
      startsAt: '2026-11-02T12:00:00+02:00',
      durationMinutes: 60,
      subscriptionId: 's',
    },
  ],
  [
    rescheduleManagerLesson,
    '/lessons/id/reschedule',
    'POST',
    { newStartsAt: '2026-11-03T10:00:00Z', reason: 'Emergency', overrideLateRule: true },
  ],
  [
    cancelManagerLesson,
    '/lessons/id/cancel',
    'POST',
    { reason: 'late cancellation', chargeable: true },
  ],
  [
    setManagerLessonMeetLink,
    '/lessons/id/meet-link',
    'PUT',
    { url: 'https://meet.google.com/abc-defg-hij' },
  ],
])(
  'generated command%s forwards exact timezone/body and CSRF/idempotency',
  async (call, path, method, body) => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(lesson)));
    try {
      const opts = { headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'uuid' } };
      expect(await call('id', body, opts)).toEqual({ ok: true, value: lesson });
      const [url, req] = spy.mock.calls[0];
      expect(url).toBe('/api/v1/manager' + path);
      expect(req).toMatchObject({ method, credentials: 'include', headers: opts.headers });
      expect(JSON.parse(req.body)).toEqual(body);
    } finally {
      spy.mockRestore();
    }
  },
);
test('generated Meet DELETE sends security headers and no replacement URL', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(lesson)));
  try {
    await clearManagerLessonMeetLink('id', undefined, {
      headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'uuid' },
    });
    expect(spy.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'uuid' },
    });
    expect(spy.mock.calls[0][1].body).toBeUndefined();
  } finally {
    spy.mockRestore();
  }
});
test('generated schedule list preserves range and portfolio filters', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify([lesson])));
  try {
    expect(
      await listManagerSchedule({
        from: '2026-11-01T00:00:00Z',
        to: '2026-11-20T00:00:00Z',
        teacherId: 't',
        status: 'SCHEDULED',
      }),
    ).toEqual({ ok: true, value: [lesson] });
    const url = new URL(spy.mock.calls[0][0], 'https://local.invalid');
    expect(url.searchParams.get('from')).toBe('2026-11-01T00:00:00Z');
    expect(url.searchParams.get('teacherId')).toBe('t');
  } finally {
    spy.mockRestore();
  }
});
test('director review and approve are separate generated operations', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ id: 'id', status: 'PENDING' })));
  try {
    await getScheduleChangeApproval('id');
    await approveScheduleChange(
      'id',
      {},
      { headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'uuid' } },
    );
    expect(spy.mock.calls[0][0]).toBe('/api/v1/schedule-change-approvals/id');
    expect(spy.mock.calls[1][0]).toBe('/api/v1/schedule-change-approvals/id/approve');
    expect(spy.mock.calls[1][1].method).toBe('POST');
  } finally {
    spy.mockRestore();
  }
});
test('OpenAPI exposes all six manager routes, strict DTOs, pending exceptions and protected mutations', async () => {
  const doc = JSON.parse(await readFile('packages/api-contracts/openapi/openapi.json', 'utf8'));
  const ops = [
    ['schedule', 'get'],
    ['students/{studentId}/lessons', 'post'],
    ['lessons/{lessonId}/reschedule', 'post'],
    ['lessons/{lessonId}/cancel', 'post'],
    ['lessons/{lessonId}/meet-link', 'put'],
    ['lessons/{lessonId}/meet-link', 'delete'],
  ];
  for (const [path, verb] of ops) {
    const op = doc.paths['/api/v1/manager/' + path][verb];
    expect(op.tags).toContain('manager');
    expect(op.security).toContainEqual({ sessionCookie: [] });
    for (const code of ['401', '403', '404', '409', '422'])
      expect(op.responses[code]).toBeDefined();
    if (verb !== 'get')
      for (const name of ['Idempotency-Key', 'X-CSRF-Token'])
        expect(op.parameters).toContainEqual(expect.objectContaining({ name, required: true }));
  }
  const schemas = doc.components.schemas;
  for (const name of [
    'CreateManagerLessonDto',
    'RescheduleManagerLessonDto',
    'CancelManagerLessonDto',
    'SetManagerMeetDto',
    'ScheduleChangeReviewDto',
  ])
    expect(schemas[name].additionalProperties).toBe(false);
  expect(doc.paths['/api/v1/manager/schedule'].get.parameters.map((p) => p.name)).toEqual(
    expect.arrayContaining(['from', 'to', 'studentId', 'teacherId', 'status']),
  );
  expect(schemas.ManagerLessonDto.properties.pendingChangeId).toBeDefined();
  expect(schemas.ManagerLessonDto.properties.chargedLessons.type).toBe('integer');
  expect(schemas.CreateManagerLessonDto.properties.durationMinutes.enum).toEqual([30, 45, 60, 90]);
  expect(doc.paths['/api/v1/schedule-change-approvals/{id}'].get.responses['403']).toBeDefined();
});
