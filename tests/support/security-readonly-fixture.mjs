import { readFile } from 'node:fs/promises';
import { Prisma } from '../../packages/db/dist/index.js';
import { studentManagerContacts } from '../../apps/api/dist/student/manager-contacts.js';
const models = JSON.parse(
  await readFile(new URL('../../packages/db/schema.contract.json', import.meta.url), 'utf8'),
);
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const securitySqlCases = [
  {
    name: 'personal manager for owned pupil',
    student: id(1),
    count: 1,
    whatsapp: 'https://wa.me/37360000123',
  },
  {
    name: 'another pupil receives only its own manager',
    student: id(2),
    count: 1,
    whatsapp: 'https://wa.me/37360000456',
  },
  { name: 'unassigned pupil never receives another manager', student: id(3), count: 0 },
  { name: 'disabled manager login excluded', student: id(1), disabled: true, count: 0 },
  { name: 'ended assignment excluded', student: id(1), ended: true, count: 0 },
  {
    name: 'staff without current manager/director role excluded',
    student: id(1),
    noRole: true,
    count: 0,
  },
];
export async function securityFixtureQuery(item) {
  let query;
  await studentManagerContacts(
    {
      $queryRaw: async (strings, ...values) => {
        query = Prisma.sql(strings, ...values);
        return [];
      },
    },
    item.student,
  );
  const tables = {
    assigned_managers: [
      {
        id: id(10),
        student_id: id(1),
        manager_id: id(20),
        assigned_at: '2000-01-01T00:00:00Z',
        ended_at: item.ended ? '2001-01-01T00:00:00Z' : null,
      },
      {
        id: id(11),
        student_id: id(2),
        manager_id: id(21),
        assigned_at: '2000-01-01T00:00:00Z',
        ended_at: null,
      },
    ],
    staff_accounts: [
      {
        id: id(20),
        account_id: id(30),
        deactivated_at: null,
        student_whatsapp_url: 'https://wa.me/37360000123',
        student_telegram_url: 'https://t.me/manager_one',
      },
      {
        id: id(21),
        account_id: id(31),
        deactivated_at: null,
        student_whatsapp_url: 'https://wa.me/37360000456',
        student_telegram_url: 'https://t.me/manager_two',
      },
    ],
    auth_accounts: [
      { id: id(30), disabled_at: item.disabled ? '2001-01-01T00:00:00Z' : null },
      { id: id(31), disabled_at: null },
    ],
    roles: [{ id: id(40), code: 'MANAGER' }],
    role_assignments: [
      {
        account_id: id(30),
        role_id: id(40),
        valid_from: item.noRole ? '9999-01-01T00:00:00Z' : '2000-01-01T00:00:00Z',
        valid_to: null,
      },
      { account_id: id(31), role_id: id(40), valid_from: '2000-01-01T00:00:00Z', valid_to: null },
    ],
  };
  const cte =
    'WITH ' +
    Object.entries(tables)
      .map(([table, rows]) => {
        const model = models.find((m) => m.table === table),
          cols = model.fields
            .map(
              (f) =>
                `"${f.column}" ${f.native?.[0] === 'Uuid' ? 'uuid' : f.native?.[0] === 'Inet' ? 'inet' : f.type === 'DateTime' ? 'timestamptz' : f.type === 'Json' ? 'jsonb' : f.type === 'Boolean' ? 'boolean' : f.type === 'Int' ? 'integer' : 'text'}`,
            )
            .join(',');
        return `${table} AS(SELECT * FROM jsonb_to_recordset('${JSON.stringify(rows).replaceAll("'", "''")}'::jsonb) AS source(${cols}))`;
      })
      .join(',');
  return {
    text: `${cte},projection AS(${query.text}) SELECT * FROM projection`,
    values: query.values,
  };
}
