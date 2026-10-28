// SQL-only rows scoped to a single SELECT. No tables, schemas or test databases are created.
export const asOf = '2026-10-27T12:00:00Z';
export const owner = '10000000-0000-4000-8000-000000000001',
  other = '10000000-0000-4000-8000-000000000002';
export const ids = [1, 2, 3, 4].map(
  (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
);
export const fixtureCte = `WITH
  student_subject_enrollments AS (SELECT '30000000-0000-4000-8000-000000000001'::uuid id,'${owner}'::uuid student_id),
  homework_assignments AS (SELECT '40000000-0000-4000-8000-000000000001'::uuid id,'50000000-0000-4000-8000-000000000001'::uuid subject_id,'Task'::text title,'{"text":"Description"}'::jsonb content,NULL::timestamptz archived_at),
  subjects AS (SELECT '50000000-0000-4000-8000-000000000001'::uuid id,'Math'::text name),
  teacher_accounts AS (SELECT '60000000-0000-4000-8000-000000000001'::uuid id,'Teacher'::text full_name),
  homework_deliveries AS (
    SELECT id::uuid,'40000000-0000-4000-8000-000000000001'::uuid assignment_id,'30000000-0000-4000-8000-000000000001'::uuid enrollment_id,
      '60000000-0000-4000-8000-000000000001'::uuid issued_by,issued_at::timestamptz,due_at::timestamptz,NULL::timestamptz cancelled_at FROM (VALUES
      ('${ids[0]}','2026-10-24T10:00:00Z',NULL),('${ids[1]}','2026-10-25T10:00:00Z','2026-10-26T10:00:00Z'),
      ('${ids[2]}','2026-10-26T10:00:00Z','2026-10-28T10:00:00Z'),('${ids[3]}','2026-10-27T10:00:00Z',NULL)) v(id,issued_at,due_at)),
  homework_submissions AS (SELECT id::uuid,delivery_id::uuid,'${owner}'::uuid student_id,version,submitted_at::timestamptz,content::jsonb FROM (VALUES
    ('70000000-0000-4000-8000-000000000001','${ids[1]}',1,'2026-10-27T10:00:00Z','{"text":"Late answer"}'),
    ('70000000-0000-4000-8000-000000000002','${ids[2]}',1,'2026-10-26T11:00:00Z','{"text":"Old answer"}'),
    ('70000000-0000-4000-8000-000000000003','${ids[2]}',2,'2026-10-26T12:00:00Z','{"text":"Revised answer"}'),
    ('70000000-0000-4000-8000-000000000004','${ids[3]}',1,'2026-10-27T11:00:00Z','{"text":"Needs work"}')) v(id,delivery_id,version,submitted_at,content)),
  submission_reviews AS (SELECT submission_id::uuid,version,result::text,comment::text,reviewed_at::timestamptz FROM (VALUES
    ('70000000-0000-4000-8000-000000000002',1,'NEEDS_REVISION','Keep this comment','2026-10-26T11:30:00Z'),
    ('70000000-0000-4000-8000-000000000003',1,'ACCEPTED','Looks good','2026-10-26T13:00:00Z'),
    ('70000000-0000-4000-8000-000000000004',1,'NEEDS_REVISION','Explain why','2026-10-27T11:30:00Z')) v(submission_id,version,result,comment,reviewed_at)),
  homework_drafts AS (SELECT delivery_id::uuid,content::text,expires_at::timestamptz FROM (VALUES
    ('${ids[0]}','expired secret','2026-10-27T12:00:00Z'),('${ids[3]}','current draft','2026-11-26T12:00:00Z')) v(delivery_id,content,expires_at)),
  s3_objects AS (SELECT id::uuid,file_name::text,size::bigint,content_type::text,status::text FROM (VALUES
    ('80000000-0000-4000-8000-000000000001','revised.txt',8,'text/plain','VERIFIED'),
    ('80000000-0000-4000-8000-000000000002','pending.txt',8,'text/plain','PENDING'))v(id,file_name,size,content_type,status)),
  homework_submission_attachments AS (SELECT submission_id::uuid,file_id::uuid FROM (VALUES
    ('70000000-0000-4000-8000-000000000003','80000000-0000-4000-8000-000000000001'),
    ('70000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000002'))v(submission_id,file_id)),
  homework_assignment_attachments AS (SELECT NULL::uuid assignment_id,NULL::uuid file_id WHERE false)`;
export const cases = [
  {
    name: 'all statuses, immutable history, expiry and attachments',
    studentId: owner,
    query: { page: 1, pageSize: 20 },
    total: 4,
    ids: [ids[3], ids[2], ids[1], ids[0]],
    statuses: ['NEEDS_REVISION', 'REVIEWED', 'SUBMITTED', 'NOT_SUBMITTED'],
  },
  {
    name: 'status filter',
    studentId: owner,
    query: { page: 1, pageSize: 20, status: 'REVIEWED' },
    total: 1,
    ids: [ids[2]],
    statuses: ['REVIEWED'],
  },
  {
    name: 'second page',
    studentId: owner,
    query: { page: 2, pageSize: 2 },
    total: 4,
    ids: [ids[1], ids[0]],
    statuses: ['SUBMITTED', 'NOT_SUBMITTED'],
  },
  {
    name: 'foreign account isolation',
    studentId: other,
    query: { page: 1, pageSize: 20 },
    total: 0,
    ids: [],
    statuses: [],
  },
  {
    name: 'empty page keeps total',
    studentId: owner,
    query: { page: 5, pageSize: 20 },
    total: 4,
    ids: [],
    statuses: [],
  },
];
export function summarize(row) {
  return {
    total: row.total,
    ids: row.items.map((x) => x.homeworkId),
    statuses: row.items.map((x) => x.status),
  };
}
