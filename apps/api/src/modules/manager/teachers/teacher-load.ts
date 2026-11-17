import type { Prisma } from '@online-school/db';
import { clip, minutes, subtract } from './intervals.js';
import type { Span } from './intervals.js';
import type { TeacherDirectoryItemDto } from './manager-teachers.dto.js';

export type TeacherRow = { id: string; full_name: string };
export type TeacherData = Awaited<ReturnType<typeof loadTeacherData>>;

/** Free spans of each teacher inside [from, to) and the facts the directory shows. */
export async function loadTeacherData(
  tx: Prisma.TransactionClient,
  teachers: TeacherRow[],
  from: Date,
  to: Date,
  now: Date,
) {
  const ids = teachers.map((t) => t.id);
  const [assignments, windows, lessons] = await Promise.all([
    tx.teachingAssignment.findMany({
      where: {
        teacher_id: { in: ids },
        valid_from: { lte: now },
        OR: [{ valid_to: null }, { valid_to: { gt: now } }],
        enrollment_ref: { valid_to: null, status: 'ACTIVE' },
      },
      select: {
        teacher_id: true,
        enrollment_ref: {
          select: {
            student_id: true,
            subject_id: true,
            subject_ref: { select: { name: true } },
          },
        },
      },
    }),
    tx.teacherAvailability.findMany({
      where: {
        teacher_id: { in: ids },
        cancelled_at: null,
        starts_at: { lt: to },
        ends_at: { gt: from },
      },
      orderBy: [{ starts_at: 'asc' }, { id: 'asc' }],
      select: { id: true, teacher_id: true, starts_at: true, ends_at: true, timezone: true },
    }),
    tx.lessonOccurrence.findMany({
      where: {
        scheduled_teacher_id: { in: ids },
        status: { not: 'CANCELLED' },
        scheduled_at: { lt: to },
        scheduled_end_at: { gt: from },
      },
      select: { scheduled_teacher_id: true, scheduled_at: true, scheduled_end_at: true },
    }),
  ]);
  const busyOf = (teacherId: string): Span[] =>
    lessons
      .filter((l) => l.scheduled_teacher_id === teacherId)
      .map((l) => ({ start: l.scheduled_at, end: l.scheduled_end_at }));
  return { assignments, windows, busyOf };
}

export function teacherItem(
  teacher: TeacherRow,
  data: TeacherData,
  from: Date,
  to: Date,
  subjectId?: string,
): { item: TeacherDirectoryItemDto; free: Span[] } {
  const mine = data.assignments.filter((a) => a.teacher_id === teacher.id);
  const subjects = new Map<string, string>();
  for (const a of mine)
    subjects.set(a.enrollment_ref.subject_id, a.enrollment_ref.subject_ref.name);
  const busy = data.busyOf(teacher.id);
  const open = data.windows
    .filter((w) => w.teacher_id === teacher.id)
    .flatMap((w) => {
      const span = clip({ start: w.starts_at, end: w.ends_at }, from, to);
      return span ? [span] : [];
    });
  const free = open.flatMap((span) => subtract(span, busy));
  const item: TeacherDirectoryItemDto = {
    teacherId: teacher.id,
    fullName: teacher.full_name,
    subjects: [...subjects]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    activeStudents: new Set(mine.map((a) => a.enrollment_ref.student_id)).size,
    lessonsNext7Days: busy.filter((b) => b.start >= from && b.start < to).length,
    availableMinutesNext7Days: minutes(open),
    freeMinutesNext7Days: minutes(free),
    teachesSubject: subjectId ? subjects.has(subjectId) : false,
  };
  return { item, free };
}
