import { domainError, fail } from '../../core/errors/domain-error.js';
import { Prisma } from '@online-school/db';
export const MEET_LINK_REGEX = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
export const effectiveMeetLink = (
  overridden: boolean,
  local: string | null,
  inherited: string | null,
): string | null => {
  const link = overridden ? local : inherited;
  return link && MEET_LINK_REGEX.test(link) ? link : null;
};

// The lesson timestamp selects the published version without rewriting old lesson or assignment rows.
export const publishedLessonMeetLinkSql = (): Prisma.Sql => Prisma.sql`(
  SELECT m.meeting_uri FROM teacher_meet_spaces m
  JOIN student_subject_enrollments en ON en.student_id=m.student_id
  WHERE l.kind='REGULAR' AND en.id=l.enrollment_id AND m.teacher_id=l.scheduled_teacher_id
    AND m.published_at<=l.scheduled_at AND (m.retired_at IS NULL OR m.retired_at>l.scheduled_at)
  ORDER BY m.published_at DESC,m.id LIMIT 1
)`;

export const effectiveLessonMeetLinkSql = (): Prisma.Sql => Prisma.sql`CASE
  WHEN l.meet_link_overridden THEN l.google_meet_link
  ELSE coalesce(${publishedLessonMeetLinkSql()},a.google_meet_link) END`;

export async function readPublishedMeetLinks(tx: Prisma.TransactionClient, lessonIds: string[]) {
  if (!lessonIds.length) return new Map<string, string>();
  const rows = await tx.$queryRaw<{ lesson_id: string; link: string | null }[]>(
    Prisma.sql`SELECT l.id AS lesson_id,${publishedLessonMeetLinkSql()} AS link
      FROM lesson_occurrences l WHERE l.id IN(${Prisma.join(lessonIds.map((id) => Prisma.sql`${id}::uuid`))})`,
  );
  const links = new Map<string, string>();
  for (const row of rows)
    if (row.link && MEET_LINK_REGEX.test(row.link)) links.set(row.lesson_id, row.link);
  return links;
}

export function redactMeet(value: unknown): unknown {
  if (typeof value === 'string')
    return value.replace(
      /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/gi,
      'https://meet.google.com/***',
    );
  if (Array.isArray(value)) return value.map(redactMeet);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactMeet(v)]));
  return value;
}

export function meetLink(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !MEET_LINK_REGEX.test(value))
    return fail(domainError('INVALID_MEET_LINK', 422));
  return value;
}
