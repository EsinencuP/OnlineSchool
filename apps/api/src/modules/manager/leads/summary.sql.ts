import { Prisma } from '@online-school/db';
export const leadSummarySql = (
  scope: Prisma.Sql,
  now: Date,
  zone: string,
): Prisma.Sql => Prisma.sql`/* mgr11:summary */
 WITH portfolio AS(SELECT ld.* FROM leads ld WHERE ${scope}),counts AS(
 SELECT jsonb_build_object('NEW',count(*) FILTER(WHERE stage='NEW'),'IN_PROGRESS',count(*) FILTER(WHERE stage='CONTACTED'),'TRIAL',count(*) FILTER(WHERE stage IN('TRIAL_SCHEDULED','TRIAL_DONE')),'AWAITING_PAYMENT',count(*) FILTER(WHERE stage='AWAITING_PAYMENT')) AS "countsByStage",
 count(*) FILTER(WHERE (created_at AT TIME ZONE ${zone})::date=(${now}::timestamptz AT TIME ZONE ${zone})::date)::int AS "createdToday",
 count(*) FILTER(WHERE created_at>=${now}-interval '30 days' AND created_at<=${now}) AS cohort,
 count(*) FILTER(WHERE created_at>=${now}-interval '30 days' AND created_at<=${now} AND converted_at<=${now}) AS converted FROM portfolio)
 SELECT "countsByStage","createdToday",(SELECT count(*)::int FROM lesson_occurrences l JOIN portfolio p ON p.id=l.trial_lead_id WHERE l.kind='TRIAL' AND (l.scheduled_at AT TIME ZONE ${zone})::date=(${now}::timestamptz AT TIME ZONE ${zone})::date) AS "trialsToday",
 (SELECT count(*)::int FROM crm_tasks t JOIN portfolio p ON p.id=t.lead_id WHERE t.type='LEAD_FOLLOWUP' AND t.status IN('OPEN','IN_PROGRESS') AND t.due_at<${now}) AS "overdueFollowups",
 CASE WHEN cohort=0 THEN 0 ELSE (converted*10000/cohort)::int END AS "conversion30dBp" FROM counts`;
