import { Prisma } from '@online-school/db';
import { MEET_LINK_REGEX } from '../../schedule/meet-link.js';
// Overlap is the MGR06 calendar contract; upcoming starts are an inclusive subwindow.
export const scheduleOverlapWhere = (from: Date, to: Date): Prisma.LessonOccurrenceWhereInput => ({
  scheduled_at: { lt: to },
  scheduled_end_at: { gt: from },
});
export const upcomingLessonWhere = (from: Date, to: Date): Prisma.LessonOccurrenceWhereInput => ({
  status: 'SCHEDULED',
  scheduled_at: { gte: from, lte: to },
});
export const upcomingLessonSql = (from: Date, to: Date): Prisma.Sql =>
  Prisma.sql`l.status='SCHEDULED' AND l.scheduled_at>=${from} AND l.scheduled_at<=${to}`;
export const hasMeetLinkSql = (): Prisma.Sql =>
  Prisma.sql`coalesce((CASE WHEN l.meet_link_overridden THEN l.google_meet_link ELSE a.google_meet_link END) ~ ${MEET_LINK_REGEX.source},false)`;
