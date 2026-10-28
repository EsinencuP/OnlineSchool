import { readFile } from 'node:fs/promises';
const models = JSON.parse(
  await readFile(new URL('../../packages/db/schema.contract.json', import.meta.url), 'utf8'),
);
const id = (f, n) => `${String(f).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const reportFixtureIds = {
  owner: id(1, 1),
  other: id(1, 2),
  empty: id(1, 3),
  subject: id(2, 1),
  foreignSubject: id(2, 2),
  latest: id(5, 3),
  previous: id(5, 1),
  legacy: id(5, 4),
};
export const reportAsOf = '2026-10-28T00:00:00Z';
const time = (day) => `2026-10-${String(day).padStart(2, '0')}T12:00:00Z`;
const teacher = id(3, 1),
  foreignTeacher = id(3, 2),
  old = id(4, 1),
  current = id(4, 2),
  foreign = id(4, 3),
  foreignSubjectEnrollment = id(4, 4),
  root = id(6, 1),
  legacyCheckpoint = id(6, 2),
  badCheckpoint = id(6, 3);
const publicContent = {
  achievements: 'Public achievement',
  growthAreas: 'Public growth',
  recommendations: 'Public advice',
  teacherSignature: 'Public teacher signature',
};
export function reportFixtureCte({ read = false, cancelLegacy = false } = {}) {
  const u = reportFixtureIds;
  const lessons = Array.from({ length: 16 }, (_, i) => ({
    id: id(7, i + 1),
    enrollment_id: i < 4 ? old : current,
    scheduled_teacher_id: teacher,
    scheduled_at: time(i < 8 ? i + 1 : i + 4),
    status: cancelLegacy && i === 0 ? 'CANCELLED' : 'CONDUCTED',
  }));
  lessons.push(
    {
      id: id(7, 20),
      enrollment_id: current,
      scheduled_teacher_id: teacher,
      scheduled_at: time(9),
      status: 'CANCELLED',
      confirmed_report_id: id(8, 1),
    },
    {
      id: id(7, 21),
      enrollment_id: current,
      scheduled_teacher_id: teacher,
      scheduled_at: time(10),
      status: 'CANCELLED',
    },
    {
      id: id(7, 22),
      enrollment_id: current,
      scheduled_teacher_id: teacher,
      scheduled_at: time(20),
      status: 'SCHEDULED',
    },
    {
      id: id(7, 23),
      enrollment_id: current,
      scheduled_teacher_id: teacher,
      scheduled_at: time(21),
      status: 'DISPUTED',
    },
    {
      id: id(7, 24),
      enrollment_id: foreign,
      scheduled_teacher_id: foreignTeacher,
      scheduled_at: time(22),
      status: 'CONDUCTED',
    },
    {
      id: id(7, 25),
      enrollment_id: current,
      scheduled_teacher_id: teacher,
      scheduled_at: '2026-11-03T12:00:00Z',
      status: 'SCHEDULED',
    },
  );
  const makeReport = (
    reportId,
    checkpoint,
    version,
    status,
    created,
    published,
    from,
    to,
    snapshot,
    content = publicContent,
  ) => ({
    id: reportId,
    checkpoint_id: checkpoint,
    author_id: teacher,
    version,
    status,
    created_at: time(created),
    published_at: published ? time(published) : null,
    period_start: time(from),
    period_end: time(to),
    confirmed_lesson_count_snapshot: snapshot,
    content,
  });
  const tables = {
    subjects: [
      { id: u.subject, name: 'Math' },
      { id: u.foreignSubject, name: 'OTHER PRIVATE SUBJECT' },
    ],
    student_subject_enrollments: [
      { id: old, student_id: u.owner, subject_id: u.subject, valid_from: '2026-09-01T00:00:00Z' },
      {
        id: current,
        student_id: u.owner,
        subject_id: u.subject,
        valid_from: '2026-10-05T00:00:00Z',
      },
      {
        id: foreign,
        student_id: u.other,
        subject_id: u.subject,
        valid_from: '2026-09-01T00:00:00Z',
      },
      {
        id: foreignSubjectEnrollment,
        student_id: u.other,
        subject_id: u.foreignSubject,
        valid_from: '2026-09-01T00:00:00Z',
      },
    ],
    teacher_accounts: [
      { id: teacher, full_name: 'Own teacher' },
      { id: foreignTeacher, full_name: 'OTHER PRIVATE TEACHER' },
    ],
    progress_checkpoints: [
      { id: root, enrollment_id: current, type: 'LESSON_8', confirmed_lesson_count: 16 },
      { id: legacyCheckpoint, enrollment_id: old, type: 'LESSON_8', confirmed_lesson_count: 8 },
      { id: badCheckpoint, enrollment_id: current, type: 'LESSON_4', confirmed_lesson_count: 4 },
      { id: id(6, 4), enrollment_id: foreign, type: 'LESSON_8', confirmed_lesson_count: 8 },
      { id: id(6, 5), enrollment_id: current, type: 'LESSON_8', confirmed_lesson_count: 24 },
    ],
    education_reports: [
      makeReport(u.previous, root, 1, 'PUBLISHED', 20, 20, 12, 19, null, {
        ...publicContent,
        internalNote: 'INTERNAL_NOT_FOR_FAMILY',
      }),
      makeReport(id(5, 2), root, 2, 'DRAFT', 21, null, 12, 19, null),
      makeReport(u.latest, root, 3, 'PUBLISHED', 22, 23, 12, 19, 8),
      makeReport(u.legacy, legacyCheckpoint, 1, 'PUBLISHED', 9, 10, 1, 8, null),
      makeReport(id(5, 5), badCheckpoint, 1, 'PUBLISHED', 20, 20, 1, 2, 8),
      makeReport(id(5, 6), id(6, 4), 1, 'PUBLISHED', 24, 24, 1, 8, 8, {
        ...publicContent,
        achievements: 'OTHER PRIVATE REPORT',
      }),
      makeReport(id(5, 7), id(6, 5), 1, 'PUBLISHED', 24, 24, 24, 24, null),
    ],
    education_report_reads: read
      ? [{ id: id(9, 1), report_id: u.latest, student_id: u.owner, read_at: time(24) }]
      : [],
    lesson_occurrences: lessons,
    lesson_actual_outcomes: Array.from({ length: 16 }, (_, i) => ({
      id: id(10, i + 1),
      lesson_occurrence_id: id(7, i + 1),
      actual_teacher_id: teacher,
      actual_started_at: time(i < 8 ? i + 1 : i + 4),
      confirmed_at: time(i < 8 ? i + 1 : i + 4),
    })),
    lesson_outcome_reports: [
      {
        id: id(8, 1),
        lesson_occurrence_id: id(7, 20),
        result: 'NOT_CONDUCTED',
        student_no_show: true,
        reported_at: time(9),
      },
    ],
    skill_entries: [
      {
        id: id(11, 1),
        subject_id: u.subject,
        label: 'Fractions',
        category: 'Arithmetic',
        created_at: time(1),
      },
      {
        id: id(11, 2),
        subject_id: u.subject,
        student_id: u.owner,
        label: 'Personal skill',
        category: '',
        created_at: time(1),
      },
      {
        id: id(11, 3),
        subject_id: u.subject,
        student_id: u.other,
        label: 'OTHER PRIVATE SKILL',
        category: '',
        created_at: time(1),
      },
    ],
    skill_assessments: [
      {
        id: id(12, 1),
        enrollment_id: current,
        skill_id: id(11, 1),
        assessed_by: teacher,
        assessed_at: time(15),
        version: 1,
        level: 'PRACTICING',
        basis: 'INTERNAL_NOT_FOR_FAMILY',
      },
    ],
    learning_goals: [
      {
        id: id(13, 1),
        enrollment_id: current,
        text: 'Public goal',
        target_date: '2026-11-01',
        status: 'ACTIVE',
        created_at: time(1),
      },
    ],
    skill_snapshots: [],
  };
  const sqlType = (f) =>
    f.native?.[0] === 'Uuid'
      ? 'uuid'
      : f.type === 'DateTime'
        ? f.native?.[0] === 'Date'
          ? 'date'
          : 'timestamptz'
        : ({
            String: 'text',
            Int: 'integer',
            BigInt: 'bigint',
            Boolean: 'boolean',
            Decimal: 'numeric',
            Json: 'jsonb',
          }[f.type] ?? 'text');
  return (
    'WITH ' +
    Object.entries(tables)
      .map(([table, rows]) => {
        const model = models.find((m) => m.table === table);
        const columns = model.fields
          .filter((f) => !f.list)
          .map((f) => `"${f.column}" ${sqlType(f)}`)
          .join(',');
        const json = JSON.stringify(rows).replaceAll("'", "''");
        return `${table} AS (SELECT * FROM jsonb_to_recordset('${json}'::jsonb) AS source(${columns}))`;
      })
      .join(',')
  );
}
export const reportSqlCases = [
  {
    name: 'latest published version and proven legacy eight-lesson report',
    mode: 'list',
    studentId: reportFixtureIds.owner,
    query: { page: 1, pageSize: 10 },
    total: 2,
    items: 2,
    first: reportFixtureIds.latest,
    new: true,
  },
  {
    name: 'draft correction does not hide prior publication',
    mode: 'list',
    studentId: reportFixtureIds.owner,
    time: time(21),
    query: { page: 1, pageSize: 10 },
    total: 2,
    items: 2,
    first: reportFixtureIds.previous,
  },
  {
    name: 'read receipt applies to exact published version',
    mode: 'list',
    studentId: reportFixtureIds.owner,
    read: true,
    query: { page: 1, pageSize: 10 },
    total: 2,
    items: 2,
    first: reportFixtureIds.latest,
    new: false,
  },
  {
    name: 'corrected legacy lesson count is not fabricated',
    mode: 'list',
    studentId: reportFixtureIds.owner,
    cancelLegacy: true,
    query: { page: 1, pageSize: 10 },
    total: 1,
    items: 1,
    first: reportFixtureIds.latest,
  },
  {
    name: 'pagination has deterministic totals past the last page',
    mode: 'list',
    studentId: reportFixtureIds.owner,
    query: { page: 99, pageSize: 1 },
    total: 2,
    items: 0,
  },
  {
    name: 'empty pupil reports',
    mode: 'list',
    studentId: reportFixtureIds.empty,
    query: { page: 1, pageSize: 10 },
    total: 0,
    items: 0,
  },
  {
    name: 'whole history includes skills goals reports and known attendance facts only',
    mode: 'export',
    studentId: reportFixtureIds.owner,
    query: {},
    reports: 2,
    lessons: 20,
    skills: 1,
  },
  {
    name: 'one-day inclusive filter keeps current map but selects attendance period',
    mode: 'export',
    studentId: reportFixtureIds.owner,
    query: { periodFrom: '2026-10-09', periodTo: '2026-10-09' },
    reports: 0,
    lessons: 1,
    skills: 1,
  },
  {
    name: 'foreign subject cannot be exported',
    mode: 'export',
    studentId: reportFixtureIds.owner,
    query: { subjectId: reportFixtureIds.foreignSubject },
    forbidden: true,
  },
  {
    name: 'empty pupil export projection',
    mode: 'export',
    studentId: reportFixtureIds.empty,
    query: {},
    reports: 0,
    lessons: 0,
    skills: 0,
  },
];
