import { readFile } from 'node:fs/promises';
import { Prisma } from '../../packages/db/dist/index.js';
import { notificationsSql } from '../../apps/api/dist/student/notifications/notifications.service.js';
import { archiveNotifications } from '../../apps/api/dist/modules/notifications/notification.service.js';
import { subscriptionNotificationSql } from '../../apps/worker/dist/notifications.js';
// Parameterized source queries, with virtual relations only. No persistent fixture writes.
const models = JSON.parse(
  await readFile(new URL('../../packages/db/schema.contract.json', import.meta.url), 'utf8'),
);
const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const notificationAsOf = new Date('2026-10-28T22:30:00Z');
export const notificationOwner = id(1),
  notificationOther = id(2);
const row = (n, overrides = {}) => ({
  id: id(100 + n),
  student_id: notificationOwner,
  type: 'REPORT_READY',
  title: 'Public title',
  body: 'Public body',
  payload: { reportId: id(50) },
  created_at: new Date(+notificationAsOf - n * 1000).toISOString(),
  read_at: null,
  archived_at: null,
  ...overrides,
});
const basic = [
  row(1),
  row(2, {
    created_at: new Date(+notificationAsOf - 1000).toISOString(),
    read_at: notificationAsOf.toISOString(),
  }),
  row(3, { created_at: new Date(+notificationAsOf - 89 * 86400000).toISOString() }),
  row(4, { student_id: notificationOther }),
  row(5, { archived_at: notificationAsOf.toISOString() }),
  row(6, { created_at: new Date(+notificationAsOf - 90 * 86400000).toISOString() }),
  row(7, { created_at: new Date(+notificationAsOf + 1000).toISOString() }),
];
export function notificationFixtureCte(tables) {
  return (
    'WITH ' +
    Object.entries(tables)
      .map(([table, rows]) => {
        const model = models.find((m) => m.table === table);
        const columns = model.fields
          .map(
            (f) =>
              `"${f.column}" ${f.native?.[0] === 'Uuid' ? 'uuid' : f.type === 'Json' ? 'jsonb' : f.type === 'DateTime' ? 'timestamptz' : f.type === 'Int' ? 'integer' : f.type === 'Boolean' ? 'boolean' : 'text'}`,
          )
          .join(',');
        return `${table} AS(SELECT * FROM jsonb_to_recordset('${JSON.stringify(rows).replaceAll("'", "''")}'::jsonb) AS fixture(${columns}))`;
      })
      .join(',')
  );
}
export const notificationSqlCases = [
  {
    name: 'owned newest-first shared status, TTL, archive and future exclusion',
    mode: 'list',
    student: notificationOwner,
    rows: basic,
    page: 1,
    size: 30,
    total: 3,
    unread: 2,
    ids: [id(102), id(101), id(103)],
  },
  {
    name: 'paging retains total and global unread',
    mode: 'list',
    student: notificationOwner,
    rows: basic,
    page: 2,
    size: 1,
    total: 3,
    unread: 2,
    ids: [id(101)],
  },
  {
    name: 'page beyond end',
    mode: 'list',
    student: notificationOwner,
    rows: basic,
    page: 20,
    size: 30,
    total: 3,
    unread: 2,
    ids: [],
  },
  {
    name: 'foreign pupil sees only own record',
    mode: 'list',
    student: notificationOther,
    rows: basic,
    page: 1,
    size: 30,
    total: 1,
    unread: 1,
    ids: [id(104)],
  },
  {
    name: 'empty pupil has zero total and unread',
    mode: 'list',
    student: id(3),
    rows: basic,
    page: 1,
    size: 30,
    total: 0,
    unread: 0,
    ids: [],
  },
  {
    name: '501 recent entries archive exactly the oldest',
    mode: 'archive',
    rows: Array.from({ length: 501 }, (_, i) => row(i + 1)),
    ids: [id(601)],
  },
  {
    name: '500 recent entries remain active',
    mode: 'archive',
    rows: Array.from({ length: 500 }, (_, i) => row(i + 1)),
    ids: [],
  },
  {
    name: '90-day boundary archived, existing archive unchanged and foreign excluded',
    mode: 'archive',
    rows: basic,
    ids: [id(106)],
  },
  {
    name: 'equal timestamps retain500 deterministically by UUID descending',
    mode: 'archive',
    rows: Array.from({ length: 501 }, (_, i) =>
      row(i + 1, { created_at: notificationAsOf.toISOString() }),
    ),
    ids: [id(101)],
  },
  {
    name: '7 and3 pupil-calendar days only; finite validity, account and duplicate filtering',
    mode: 'expiry',
    events: 2,
  },
];
export async function notificationFixtureQuery(item) {
  if (item.mode === 'list')
    return {
      tables: { student_notifications: item.rows },
      query: notificationsSql(
        item.student,
        { page: item.page, pageSize: item.size },
        notificationAsOf,
      ),
    };
  if (item.mode === 'archive') {
    let query;
    await archiveNotifications(
      {
        $executeRaw: async (strings, ...values) => {
          query = Prisma.sql(strings, ...values);
        },
      },
      notificationOwner,
      notificationAsOf,
    );
    // The exact candidate CTE/predicate from the real UPDATE, projected read-only.
    const text = query.text.replace(
      /UPDATE student_notifications n SET archived_at=(\$\d+) FROM ranked r WHERE n.id=r.id\s+AND/,
      (_match, stamp) => `SELECT r.id FROM ranked r WHERE ${stamp}::timestamptz IS NOT NULL AND`,
    );
    return { tables: { student_notifications: item.rows }, query: { text, values: query.values } };
  }
  const enroll = id(10),
    sub = (n, valid_to) => ({
      id: id(20 + n),
      enrollment_id: enroll,
      valid_from: '2026-10-01T00:00:00Z',
      valid_to,
    });
  const tables = {
    student_notification_sources: [],
    students: [{ id: notificationOwner, archived_at: null }],
    auth_accounts: [{ id: id(40), disabled_at: null }],
    student_accounts: [
      {
        id: id(41),
        student_id: notificationOwner,
        account_id: id(40),
        timezone: 'Europe/Chisinau',
        deactivated_at: null,
      },
    ],
    student_subject_enrollments: [{ id: enroll, student_id: notificationOwner }],
    subscriptions: [
      sub(1, '2026-11-05T10:00:00Z'),
      sub(2, '2026-11-01T10:00:00Z'),
      sub(3, '2026-11-04T10:00:00Z'),
      sub(4, null),
      sub(5, '2026-10-27T00:00:00Z'),
    ],
  };
  tables.subscriptions.push(sub(6, '2026-11-05T10:00:00Z'), {
    ...sub(7, '2026-11-05T10:00:00Z'),
    enrollment_id: id(11),
  });
  tables.student_subject_enrollments.push({ id: id(11), student_id: notificationOther });
  tables.student_notification_sources.push({
    id: id(60),
    event_key: `subscription-expiry:${id(26)}:${+new Date('2026-11-05T10:00:00Z')}:7`,
  });
  const q = subscriptionNotificationSql(notificationAsOf);
  return {
    tables,
    query: {
      text: q.text
        .replace(/^INSERT INTO student_notification_sources\([^)]*\)\s*/, '')
        .replace(/ON CONFLICT\(event_key\) DO NOTHING$/, ''),
      values: q.values,
    },
  };
}
