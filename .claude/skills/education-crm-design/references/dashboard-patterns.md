# Dashboard patterns

Layout order: header (title, "Данные на HH:MM", one primary action) → `.kpis` strip (3–5) →
main question view → breakdowns → record lists. Most important top-left; no half-empty cards.

## Director — "Всё ли в порядке и что ждёт моего решения?"
KPIs: decisions waiting (+ oldest age, blocked), open escalations, managers available, payroll owed,
period blockers. Then: decisions by type (HBarList → queue filtered), escalations (attention list),
managers table, lessons next 7 days by teacher, unresolved finance facts by type.
Not available in API (do not draw): revenue trend, retention, churn, per-manager conversion.

## Manager — workspace, "Что сделать сейчас?"
KPIs: overdue tasks, new leads, conversion 30 d, payments in progress, student debt.
Main: "Требует внимания" queue (overdue tasks → lessons without Meet link → rejected payments →
payments not sent → subscriptions with ≤ 2 lessons), max 6 rows + "Показать все".
Then: leads by stage (now), leads per day (14 d), expiring subscriptions, lessons in 48 h;
side column: month calendar + today timeline.

## Teacher — "Что у меня сегодня?"
Hero with today's actions, one alert row for lessons without result > 24 h, 4 KPI tiles,
today's lessons, submitted work, week load (columns + daily limit line), notifications.
No money beyond own accruals, no other teachers' data.

## Problem rules
- Decision waiting ≥ 3 days → problem tone. Escalation open → problem.
- Overdue task, lesson without Meet link within 48 h → problem. Debt (negative balance) → problem.
- Subscription ≤ 2 lessons left → info row with "Продлить".
