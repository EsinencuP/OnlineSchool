import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import request from 'supertest';
import { ManagerModule } from '../../apps/api/dist/modules/manager/manager.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
import {
  installNotificationStorage,
  resetNotificationStorage,
  notificationSnapshotFields,
} from './notification-storage.mjs';
const { Test } = createRequire(new URL('../../apps/api/package.json', import.meta.url))(
  '@nestjs/testing',
);

export function rawCard(row, guardian = null) {
  return {
    studentId: row.id,
    version: row.version,
    fullName: row.full_name,
    status: 'LEAD',
    hasAccount: false,
    contacts: { phone: row.phone, email: row.email, guardianName: guardian, guardianPhone: null },
    managerNote: row.manager_note,
    subscription: null,
    balance: row.ledgerBalance ?? '0.0000',
    balanceCurrency: 'MDL',
    balances: row.ledgerBalances ?? [{ currency: 'MDL', amount: row.ledgerBalance ?? '0.0000' }],
    upcomingLessons: [],
    openTasks: [],
    recentPayments: row.payments ?? [],
    learning: {
      skillsMastered: 1,
      skillsTotal: 4,
      homeworkSubmitted: 2,
      homeworkPending: 1,
      homeworkOverdue: 1,
      lastReportAt: null,
      lastReportStatus: null,
    },
  };
}
export function rawItem(row) {
  return {
    studentId: row.id,
    fullName: row.full_name,
    status: 'LEAD',
    hasAccount: false,
    maskedPhone: row.phone ? '***42' : null,
    activeSubscription: null,
    balance: row.ledgerBalance ?? '0.0000',
    balanceCurrency: 'MDL',
    balances: row.ledgerBalances ?? [{ currency: 'MDL', amount: row.ledgerBalance ?? '0.0000' }],
    nextLessonAt: null,
    openTasksCount: 0,
    overdueTasksCount: 0,
  };
}
export async function managerFixture(configuration = {}) {
  const roles = ['MANAGER', 'MANAGER', 'STUDENT', 'TEACHER', 'DIRECTOR', 'TECH_OPERATOR'];
  const accounts = roles.map((role, i) => ({
    id: randomUUID(),
    staffId: randomUUID(),
    role,
    kind: i === 2 ? 'STUDENT' : i === 3 ? 'TEACHER' : 'STAFF',
    disabled_at: null,
    recovery_registration_required: false,
  }));
  let state,
    tail = Promise.resolve();
  const client = {
    $queryRaw: jest.fn(async (parts, ...values) => {
      if (parts.text) {
        state.businessQueries.push(parts);
        if (state.failRead) throw Error('private SQL note teacher assessment');
        const manager = accounts.find((a) => parts.values.includes(a.staffId));
        if (parts.text.includes(' AS card')) {
          const id = parts.values.find((x) => state.students.has(x));
          const row = state.students.get(id);
          if (!row || row.managerId !== manager?.staffId) return [];
          const link = state.links.find((l) => l.student_id === id && !l.valid_to);
          return [
            {
              card: rawCard(
                row,
                link ? state.representatives.get(link.representative_id)?.full_name : null,
              ),
            },
          ];
        }
        return [
          {
            cursor_valid: state.cursorValid,
            items:
              state.listItems ??
              [...state.students.values()]
                .filter((s) => s.managerId === manager?.staffId)
                .map(rawItem),
          },
        ];
      }
      const sql = parts.join('?');
      if (sql.includes('SELECT r.code'))
        return [{ code: accounts.find((a) => a.id === values[0])?.role }];
      return [{ now: new Date() }];
    }),
    staffAccount: {
      findFirst: jest.fn(async ({ where }) => {
        const a = accounts.find((a) => a.id === where.account_id);
        return a ? { id: a.staffId, full_name: 'Manager', deactivated_at: null } : null;
      }),
    },
    studentAccount: {
      findFirst: jest.fn(async () => ({ deactivated_at: null })),
      create: jest.fn(),
    },
    teacherAccount: { findFirst: jest.fn(async () => ({ deactivated_at: null })) },
    authAccount: { create: jest.fn() },
    student: {
      findFirst: jest.fn(async ({ where }) => {
        const row = state.students.get(where.AND?.[0]?.id ?? where.id);
        const manager = where.AND?.[1]?.manager_assignments?.some?.manager_id;
        return row && (!manager || manager === row.managerId) ? { id: row.id } : null;
      }),
      create: jest.fn(async ({ data }) => {
        const row = {
          id: randomUUID(),
          phone: null,
          email: null,
          manager_note: null,
          version: 1,
          ...data,
        };
        state.students.set(row.id, row);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const expected = where.AND[0],
          row = state.students.get(expected.id);
        if (
          !row ||
          row.version !== expected.version ||
          row.managerId !== where.AND[1].manager_assignments.some.manager_id
        )
          return { count: 0 };
        for (const [key, value] of Object.entries(data)) if (key !== 'version') row[key] = value;
        row.version++;
        return { count: 1 };
      }),
    },
    assignedManager: {
      create: jest.fn(async ({ data }) => {
        state.students.get(data.student_id).managerId = data.manager_id;
        return { id: randomUUID(), ...data };
      }),
    },
    representative: {
      create: jest.fn(async ({ data }) => {
        const row = { id: randomUUID(), ...data };
        state.representatives.set(row.id, row);
        return row;
      }),
    },
    studentRepresentativeLink: {
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const link of state.links)
          if (link.student_id === where.student_id && !link.valid_to) {
            Object.assign(link, data);
            count++;
          }
        return { count };
      }),
      create: jest.fn(async ({ data }) => {
        const row = { id: randomUUID(), ...data };
        state.links.push(row);
        return row;
      }),
    },
    session: {
      create: jest.fn(async ({ data }) => {
        const row = { id: randomUUID(), revoked_at: null, ...data };
        state.sessions.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const row = [...state.sessions.values()].find(
          (r) => r.id === where.id || r.token_hash === where.token_hash,
        );
        return row ? { ...row, account: accounts.find((a) => a.id === row.account_id) } : null;
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    accessRevocation: { findFirst: jest.fn(async () => null) },
    auditEvent: {
      create: jest.fn(async ({ data }) => {
        if (state.failAudit === data.action) throw Error('private PII in audit failure');
        const row = { id: randomUUID(), ...data };
        state.audit.push(row);
        return row;
      }),
    },
    outboxEvent: {
      create: jest.fn(async ({ data }) => {
        if (state.failOutbox) throw Error('private outbox failure');
        state.outbox.push(data);
        return data;
      }),
    },
    idempotencyRecord: {
      findUnique: jest.fn(
        async ({ where }) =>
          [...state.idem.values()].find((row) =>
            ['scope', 'command_type', 'key'].every(
              (k) => row[k] === where.scope_command_type_key[k],
            ),
          ) ?? null,
      ),
      create: jest.fn(async ({ data }) => {
        const row = { status: 'PENDING', ...data };
        state.idem.set(row.id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }) => {
        Object.assign(state.idem.get(where.id), data);
        return state.idem.get(where.id);
      }),
      delete: jest.fn(async ({ where }) => state.idem.delete(where.id)),
    },
  };
  installNotificationStorage(client, () => state);
  configuration.configure?.(client, () => state, accounts);
  client.$transaction = jest.fn((fn) => {
    const job = tail.then(async () => {
      const snapshot = structuredClone({
        students: state.students,
        links: state.links,
        representatives: state.representatives,
        audit: state.audit,
        outbox: state.outbox,
        idem: state.idem,
        ...Object.fromEntries(notificationSnapshotFields.map((key) => [key, state[key]])),
        ...Object.fromEntries((configuration.snapshotFields ?? []).map((key) => [key, state[key]])),
      });
      try {
        const result = await fn(client);
        await configuration.beforeCommit?.(state, result);
        return result;
      } catch (error) {
        Object.assign(state, snapshot);
        configuration.afterRollback?.(state, error);
        throw error;
      }
    });
    tail = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  });
  const module = await Test.createTestingModule({
    imports: [configuration.module ?? ManagerModule],
  })
    .overrideProvider(DatabaseService)
    .useValue({ client })
    .compile();
  const app = module.createNestApplication();
  app.useLogger(false);
  await app.init();
  let issued = [];
  async function reset() {
    state = {
      students: new Map(),
      links: [],
      representatives: new Map(),
      audit: [],
      outbox: [],
      idem: new Map(),
      sessions: new Map(),
      businessQueries: [],
      cursorValid: true,
      failAudit: null,
      failOutbox: false,
      failRead: false,
      listItems: null,
    };
    resetNotificationStorage(state);
    configuration.reset?.(state, accounts);
    issued = [];
    for (const a of accounts)
      issued.push(await app.get(SessionStore).issue(client, a.id, new Date()));
  }
  function addStudent(index = 0, overrides = {}) {
    const row = {
      id: randomUUID(),
      managerId: accounts[index].staffId,
      full_name: 'Student',
      phone: '+373 12345642',
      email: 'private@example.invalid',
      manager_note: 'private manager note',
      version: 1,
      ...overrides,
    };
    state.students.set(row.id, row);
    return row;
  }
  const api = (verb, path, index = 0, { csrf = true, key, body } = {}) => {
    let cmd = request(app.getHttpServer())[verb](
      (configuration.basePath ?? '/api/v1/manager/students') + path,
    );
    if (index !== null) {
      cmd = cmd.set(
        'Cookie',
        `__Host-school_session=${issued[index].token}; __Host-school_csrf=${issued[index].csrfToken}`,
      );
      if (csrf) cmd = cmd.set('X-CSRF-Token', issued[index].csrfToken);
    }
    if (key) cmd = cmd.set('Idempotency-Key', key);
    if (body !== undefined) cmd = cmd.send(body);
    return cmd;
  };
  return {
    app,
    client,
    accounts,
    reset,
    addStudent,
    api,
    get state() {
      return state;
    },
  };
}
