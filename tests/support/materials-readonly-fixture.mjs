export const asOf = '2026-10-27T12:00:00Z';
export const owner = '10000000-0000-4000-8000-000000000001',
  other = '10000000-0000-4000-8000-000000000002';
export const user = '11000000-0000-4000-8000-000000000001',
  otherUser = '11000000-0000-4000-8000-000000000002';
export const subject = '12000000-0000-4000-8000-000000000001',
  otherSubject = '12000000-0000-4000-8000-000000000002';
export const ids = Array.from(
  { length: 14 },
  (_, i) => `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
);
export const student = {
  userId: user,
  studentProfileId: owner,
  hasActiveAccess: true,
  mustChangePassword: false,
  subjectIds: [subject, otherSubject],
};
export const fixtureCte = `WITH
 student_accounts AS(SELECT '${user}'::uuid account_id,'${owner}'::uuid student_id UNION ALL SELECT '${otherUser}'::uuid,'${other}'::uuid),
 teacher_accounts AS(SELECT '30000000-0000-4000-8000-000000000001'::uuid account_id,'Teacher'::text full_name),
 subjects AS(SELECT '${subject}'::uuid id,'Math'::text name UNION ALL SELECT '${otherSubject}'::uuid,'Language'),
 student_subject_enrollments AS(SELECT '40000000-0000-4000-8000-000000000001'::uuid id,'${owner}'::uuid student_id,'${subject}'::uuid subject_id
   UNION ALL SELECT '40000000-0000-4000-8000-000000000002'::uuid,'${owner}'::uuid,'${otherSubject}'::uuid
   UNION ALL SELECT '40000000-0000-4000-8000-000000000003'::uuid,'${other}'::uuid,'${subject}'::uuid),
 lesson_occurrences AS(SELECT '50000000-0000-4000-8000-000000000001'::uuid id,'40000000-0000-4000-8000-000000000001'::uuid enrollment_id
   UNION ALL SELECT '50000000-0000-4000-8000-000000000002'::uuid,'40000000-0000-4000-8000-000000000003'::uuid),
 s3_objects AS(SELECT id::uuid,'private-bucket'::text bucket,'never-return-this-key'::text key,file_name::text,8::bigint size,mime::text content_type,status::text,'2026-10-01T12:00:00Z'::timestamptz uploaded_at
   FROM(VALUES ${ids.map((id, i) => `('${id}',${i === 2 ? 'NULL' : `'Material ${i + 1}'`},'${i === 1 ? 'video/mp4' : i === 2 ? 'application/msword' : 'application/pdf'}','${i === 7 ? 'QUARANTINED' : i === 12 ? 'PENDING' : i === 13 ? 'DELETED' : 'VERIFIED'}')`).join(',')})v(id,file_name,mime,status)),
 file_permissions AS(SELECT id::uuid,s3_object_id::uuid,subject_id::uuid,'STUDENT'::text subject_type,granted_by::uuid,
   granted_at::timestamptz,revoked_at::timestamptz,expires_at::timestamptz,educational_subject_id::uuid,lesson_occurrence_id::uuid,lesson_title::text,can_download
   FROM(VALUES ${ids
     .filter((_, i) => i !== 3)
     .map((id) => {
       const i = ids.indexOf(id),
         account = i === 9 ? otherUser : user,
         by =
           i === 8
             ? '30000000-0000-4000-8000-000000000002'
             : '30000000-0000-4000-8000-000000000001';
       return `('${id}','${id}','${account}','${by}','${i === 6 ? '2026-10-28' : i === 0 ? '2026-10-24' : i === 1 ? '2026-10-25' : '2026-10-26'}T12:00:00Z',${i === 4 ? "'2026-10-27T11:00:00Z'" : 'NULL'},${i === 5 ? "'2026-10-27T12:00:00Z'" : 'NULL'},${i === 2 ? 'NULL' : `'${i === 1 ? otherSubject : i === 11 ? '12000000-0000-4000-8000-000000000003' : subject}'`},${i === 0 ? "'50000000-0000-4000-8000-000000000001'" : i === 10 ? "'50000000-0000-4000-8000-000000000002'" : 'NULL'},${i === 0 ? "'Fractions'" : 'NULL'},${i === 1 ? 'true' : 'false'})`;
     })
     .join(
       ',',
     )})v(id,s3_object_id,subject_id,granted_by,granted_at,revoked_at,expires_at,educational_subject_id,lesson_occurrence_id,lesson_title,can_download))`;
export const listCases = [
  {
    name: 'only explicit teacher permissions, current/verified/context scoped, newest first',
    student,
    query: { page: 1, pageSize: 30 },
    ids: [ids[2], ids[1], ids[0]],
    total: 3,
  },
  {
    name: 'educational subject filter',
    student,
    query: { page: 1, pageSize: 30, subjectId: subject },
    ids: [ids[0]],
    total: 1,
  },
  { name: 'second page', student, query: { page: 2, pageSize: 2 }, ids: [ids[0]], total: 3 },
  {
    name: 'foreign account isolation',
    student: { ...student, userId: otherUser, studentProfileId: other },
    query: { page: 1, pageSize: 30 },
    ids: [ids[9]],
    total: 1,
  },
  {
    name: 'empty page retains total',
    student,
    query: { page: 4, pageSize: 30 },
    ids: [],
    total: 3,
  },
];
export const accessCases = [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((index) => ({
  name: `file-${index + 1} ${index === 0 ? 'READ allowed' : 'denied'}`,
  student,
  id: ids[index],
  allowed: index === 0,
}));
