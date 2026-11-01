import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../packages/db/dist/index.js';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { managerFixture } from './manager-crm-fixture.mjs';
const roleId = randomUUID();
const unique = (target) =>
  new Prisma.PrismaClientKnownRequestError('unique constraint', {
    code: 'P2002',
    clientVersion: '7.10.1',
    meta: { target: [target] },
  });
export async function managerAccountsFixture() {
  let stateOf;
  const f = await managerFixture({
    module: AppModule,
    snapshotFields: [
      'auth',
      'profiles',
      'roleRows',
      'sessions',
      'revocations',
      'credentials',
      'challenges',
      'emailChanges',
    ],
    reset(s, accounts) {
      s.auth = new Map(
        accounts.map((a) => [
          a.id,
          { ...a, login_id: `${a.id}@example.invalid`, password_hash: null },
        ]),
      );
      s.profiles = new Map();
      s.roleRows = [];
      s.revocations = [];
      s.credentials = [];
      s.challenges = [];
      s.emailChanges = [];
      s.finance = new Map();
      s.rateAttempts = 1;
      s.failCommit = 0;
      s.replayAfterFailure = false;
      s.simulatedWinner = null;
      s.lockQueries = [];
    },
    beforeCommit(s) {
      if (s.failCommit > 0 && s.profiles.size) {
        s.failCommit--;
        if (s.replayAfterFailure)
          s.simulatedWinner = structuredClone({
            auth: s.auth,
            profiles: s.profiles,
            roleRows: s.roleRows,
            idem: s.idem,
            audit: s.audit,
            outbox: s.outbox,
          });
        throw new Prisma.PrismaClientKnownRequestError('synthetic serialization conflict', {
          code: 'P2034',
          clientVersion: '7.10.1',
        });
      }
    },
    afterRollback(s) {
      if (s.simulatedWinner) {
        Object.assign(s, s.simulatedWinner);
        s.simulatedWinner = null;
      }
    },
    configure(db, getState, accounts) {
      stateOf = getState;
      const raw = db.$queryRaw;
      const clock = () =>
        new Date(Math.max(Date.now(), ...getState().revocations.map((r) => +r.revoked_at + 1)));
      db.$queryRaw = jest.fn(async (parts, ...values) => {
        const s = getState();
        if (parts.text && parts.text.includes('AS subscription_id')) {
          const id = parts.values.find((x) => s.students.has(x)),
            fin = s.finance.get(id);
          if (
            !fin?.confirmed ||
            !fin.receiptPublished ||
            !fin.distributed ||
            !fin.distributionPublished
          )
            return [];
          const full = new Prisma.Decimal(fin.paid).gte(fin.price);
          if (
            !full &&
            (!fin.admission ||
              !fin.admission.valid ||
              !fin.admission.afterPayment ||
              !fin.admission.remaining)
          )
            return [];
          return [
            {
              subscription_id: fin.subscriptionId,
              payment_id: fin.paymentId,
              distribution_id: fin.distributionId,
              admission_id: full ? null : fin.admission.id,
              director_id: accounts[4].staffId,
              basis: full ? 'FULL_PAYMENT' : 'LIMITED_DIRECTOR_ADMISSION',
            },
          ];
        }
        const sql = parts.text ?? parts.join('?');
        if (sql.includes('INSERT INTO auth_rate_limits')) return [{ attempts: s.rateAttempts }];
        if (sql.includes('SELECT r.code')) {
          const id = values[0],
            initial = accounts.find((a) => a.id === id);
          return initial
            ? [{ code: initial.role }]
            : s.roleRows.filter((r) => r.account_id === id).map(() => ({ code: 'STUDENT' }));
        }
        if (sql.includes('AS has_active_access')) {
          const fin = s.finance.get(values[0]);
          return [{ subject_ids: [randomUUID()], has_active_access: !!fin?.hasRights }];
        }
        if (sql.includes('student_whatsapp_url')) return [];
        if (sql.includes('SELECT id FROM students') && sql.includes('FOR UPDATE')) {
          s.lockQueries.push(sql);
          return s.students.has(values[0]) ? [{ id: values[0] }] : [];
        }
        if (sql.includes('SELECT id FROM auth_accounts'))
          return s.auth.has(values[0]) ? [{ id: values[0] }] : [];
        if (sql.includes('clock_timestamp') || sql.includes('AS now')) return [{ now: clock() }];
        return raw(parts, ...values);
      });
      db.$executeRaw = jest.fn(async () => 0);
      const profile = (where) => {
        const s = getState(),
          row = [...s.profiles.values()].find(
            (p) =>
              (!where.account_id || p.account_id === where.account_id) &&
              (!where.student_id || p.student_id === where.student_id) &&
              (!('deactivated_at' in where) || p.deactivated_at === where.deactivated_at),
          );
        if (!row)
          return accounts.some((a) => a.id === where.account_id && a.role === 'STUDENT')
            ? { deactivated_at: null, must_change_password: false }
            : null;
        return {
          ...row,
          student: s.students.get(row.student_id),
          account: s.auth.get(row.account_id),
        };
      };
      db.studentAccount.findFirst = jest.fn(async ({ where }) => profile(where));
      db.studentAccount.create = jest.fn(async ({ data }) => {
        const s = getState();
        if (
          [...s.profiles.values()].some(
            (p) => p.student_id === data.student_id && !p.deactivated_at,
          )
        )
          throw unique('uq_student_active_account');
        const row = {
          id: randomUUID(),
          timezone: 'Europe/Chisinau',
          created_at: clock(),
          deactivated_at: null,
          ...data,
        };
        s.profiles.set(row.id, row);
        return row;
      });
      db.studentAccount.update = jest.fn(async ({ where, data }) => {
        const row = getState().profiles.get(where.id);
        Object.assign(row, data);
        return row;
      });
      db.authAccount.findUnique = jest.fn(async ({ where }) =>
        where.id
          ? (getState().auth.get(where.id) ?? null)
          : ([...getState().auth.values()].find((a) => a.login_id === where.login_id) ?? null),
      );
      db.authAccount.findUniqueOrThrow = jest.fn(async (input) => {
        const row = await db.authAccount.findUnique(input);
        if (!row) throw Error('missing auth');
        return row;
      });
      db.authAccount.create = jest.fn(async ({ data }) => {
        const s = getState();
        if ([...s.auth.values()].some((a) => a.login_id === data.login_id))
          throw unique('login_id');
        const row = {
          id: randomUUID(),
          disabled_at: null,
          recovery_registration_required: false,
          ...data,
        };
        s.auth.set(row.id, row);
        return row;
      });
      db.authAccount.update = jest.fn(async ({ where, data }) => {
        const row = getState().auth.get(where.id);
        Object.assign(row, data);
        return row;
      });
      db.role = { findUnique: jest.fn(async () => ({ id: roleId })) };
      db.roleAssignment = {
        create: jest.fn(async ({ data }) => {
          getState().roleRows.push(data);
          return data;
        }),
      };
      db.student.update = jest.fn(async ({ where, data }) => {
        const row = getState().students.get(where.id);
        Object.assign(row, data);
        return row;
      });
      db.session.findUnique = jest.fn(async ({ where }) => {
        const row = [...getState().sessions.values()].find(
          (r) => r.id === where.id || r.token_hash === where.token_hash,
        );
        return row ? { ...row, account: getState().auth.get(row.account_id) } : null;
      });
      db.session.updateMany = jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const row of getState().sessions.values())
          if (
            (!where.account_id || where.account_id === row.account_id) &&
            (!where.id || where.id === row.id) &&
            (!('revoked_at' in where) || where.revoked_at === row.revoked_at)
          ) {
            Object.assign(row, data);
            count++;
          }
        return { count };
      });
      db.accessRevocation.create = jest.fn(async ({ data }) => {
        getState().revocations.push(data);
        return data;
      });
      db.accessRevocation.findFirst = jest.fn(
        async ({ where }) =>
          getState().revocations.find(
            (r) =>
              r.account_id === where.account_id &&
              where.OR.some((c) =>
                c.session_id === null
                  ? r.session_id === null && r.revoked_at >= c.revoked_at.gte
                  : r.session_id === c.session_id,
              ),
          ) ?? null,
      );
      db.auditEvent.count = jest.fn(
        async ({ where }) =>
          getState().audit.filter(
            (a) =>
              a.action === where.action &&
              a.resource_id === where.resource_id &&
              a.result === 'SUCCESS' &&
              a.recorded_at > where.recorded_at.gt,
          ).length,
      );
      db.webAuthnCredential = {
        updateMany: jest.fn(async ({ where, data }) => {
          for (const row of getState().credentials)
            if (row.account_id === where.account_id && !row.revoked_at) Object.assign(row, data);
          return { count: 1 };
        }),
      };
      db.mfaChallenge = {
        updateMany: jest.fn(async ({ where, data }) => {
          for (const row of getState().challenges)
            if (row.account_id === where.account_id && !row.used_at) Object.assign(row, data);
          return { count: 1 };
        }),
      };
      db.studentEmailChange = {
        updateMany: jest.fn(async ({ where, data }) => {
          for (const row of getState().emailChanges)
            if (row.account_id === where.account_id && !row.revoked_at) Object.assign(row, data);
          return { count: 1 };
        }),
      };
    },
  });
  const finance = (id, patch = {}) => {
    const data = {
      subscriptionId: randomUUID(),
      distributionId: randomUUID(),
      paymentId: randomUUID(),
      confirmed: true,
      receiptPublished: true,
      distributed: true,
      distributionPublished: true,
      paid: '1500.0000',
      price: '1500.0000',
      hasRights: true,
      ...patch,
    };
    stateOf().finance.set(id, data);
    return data;
  };
  return { f, finance };
}
