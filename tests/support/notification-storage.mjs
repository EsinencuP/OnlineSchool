import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
export const notificationMatches = (r, w = {}) =>
  r &&
  Object.entries(w).every(([k, v]) => {
    if (k === 'OR') return v.some((x) => notificationMatches(r, x));
    if (v === null) return r[k] == null;
    if (v instanceof Date) return +r[k] === +v;
    if (typeof v !== 'object') return r[k] === v;
    return Object.entries(v).every(([op, b]) =>
      op === 'gt'
        ? r[k] > b
        : op === 'gte'
          ? r[k] >= b
          : op === 'lt'
            ? r[k] < b
            : op === 'lte'
              ? r[k] <= b
              : op === 'in'
                ? b.includes(r[k])
                : false,
    );
  });
export const notificationSnapshotFields = ['dispatches', 'notificationSources', 'inbox'];
export function resetNotificationStorage(s) {
  for (const k of notificationSnapshotFields) s[k] = new Map();
}
export function installNotificationStorage(db, state) {
  const s = () => state();
  db.student.findUnique = jest.fn(async ({ where }) => s().students.get(where.id) ?? null);
  db.notificationDispatch = {
    findUnique: jest.fn(
      async ({ where }) =>
        [...s().dispatches.values()].find((r) => notificationMatches(r, where)) ?? null,
    ),
    findMany: jest.fn(async ({ where, take }) =>
      [...s().dispatches.values()]
        .filter((r) => notificationMatches(r, where))
        .sort((a, b) => +a.created_at - +b.created_at || a.id.localeCompare(b.id))
        .slice(0, take),
    ),
    count: jest.fn(
      async ({ where }) =>
        [...s().dispatches.values()].filter((r) => notificationMatches(r, where)).length,
    ),
    create: jest.fn(async ({ data }) => {
      const row = {
        id: randomUUID(),
        status: 'QUEUED',
        sent_at: null,
        first_attempt_at: null,
        failure_reason: null,
        provider_reference: null,
        ...data,
      };
      s().dispatches.set(row.id, row);
      return row;
    }),
    update: jest.fn(async ({ where, data }) => {
      const row = [...s().dispatches.values()].find((r) => notificationMatches(r, where));
      Object.assign(row, data);
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }) => {
      const rows = [...s().dispatches.values()].filter((r) => notificationMatches(r, where));
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    }),
  };
  db.studentNotificationSource = {
    createMany: jest.fn(async ({ data }) => {
      for (const input of data)
        if (![...s().notificationSources.values()].some((r) => r.event_key === input.event_key)) {
          const row = { id: randomUUID(), delivered_at: null, ...input };
          s().notificationSources.set(row.id, row);
        }
      return { count: data.length };
    }),
    findUnique: jest.fn(
      async ({ where }) =>
        [...s().notificationSources.values()].find((r) => notificationMatches(r, where)) ?? null,
    ),
    update: jest.fn(async ({ where, data }) => {
      const row = [...s().notificationSources.values()].find((r) => notificationMatches(r, where));
      Object.assign(row, data);
      return row;
    }),
  };
  db.studentNotification = {
    createMany: jest.fn(async ({ data }) => {
      for (const row of data) if (!s().inbox.has(row.id)) s().inbox.set(row.id, row);
      return { count: data.length };
    }),
  };
  db.$executeRaw ??= jest.fn(async () => 0);
}
export function standaloneNotificationStorage(studentId, now = new Date()) {
  const state = {
    students: new Map([
      [studentId, { id: studentId, notification_locale: 'ru', email: 'student@example.invalid' }],
    ]),
    audit: [],
    outbox: [],
  };
  resetNotificationStorage(state);
  const tx = {
    student: {},
    studentAccount: { findFirst: jest.fn(async () => ({ id: randomUUID() })) },
    $queryRaw: jest.fn(async () => [{ now }]),
    auditEvent: {
      create: jest.fn(async ({ data }) => {
        state.audit.push(data);
        return data;
      }),
    },
    outboxEvent: {
      create: jest.fn(async ({ data }) => {
        state.outbox.push(data);
        return data;
      }),
    },
  };
  installNotificationStorage(tx, () => state);
  return { tx, state };
}
