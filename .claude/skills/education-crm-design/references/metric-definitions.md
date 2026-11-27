# Metric definitions

All money values are decimal strings from the API; sums in the UI are display-only.
School timezone: `Europe/Chisinau` (`shared/format.ts`: `dayKey`, `hourOf`).

## Manager
| KPI | Source | Formula |
|---|---|---|
| Просроченные задачи | `ManagerDashboardDto.overdueTasks.count` | open tasks with `isOverdue` |
| Открытые задачи | tasks | status OPEN or IN_PROGRESS |
| Новые заявки | `leads.countsByStage.NEW` | snapshot |
| Без контакта в срок | `leads.overdueFollowups` | open leads with `isOverdue` |
| Конверсия в учеников | `leads.conversion30dBp` / 100 | CONVERTED ÷ leads created in last 30 d; shows `—` if none created |
| Платежи в работе | `pendingPayments` | PENDING + AWAITING_APPROVAL, totals per currency |
| Долги учеников | `StudentListItemDto.balance` | count and sum of negative balances (pending payments excluded by API) |
| Заявки по дням | `LeadDto.createdAt`, `stageChangedAt` | per school day, 14 days; "стали учениками" = CONVERTED by `stageChangedAt` |
| Уроки по преподавателям | lessons in view | non-cancelled lessons of the manager's portfolio, count + hours |

## Director
| KPI | Source | Formula |
|---|---|---|
| Ждут решения | `GET /director/decisions` | all kinds; oldest = min `requestedAt`; age in whole days |
| Заблокированы | `DecisionItemDto.ready=false` | reason in `blockedBy` |
| Открытые эскалации | `EscalationDto.state=OPEN` | |
| Менеджеры на связи | `StaffItemDto.metrics.availability` | AVAILABLE ÷ active managers |
| Долг перед преподавателями | `PayrollSummaryDto.totals[].outstanding` | accrued − paid, per currency |
| Ждут начисления | `totals[].pendingAccrual` | confirmed lessons not accrued |
| Блокеры периода | `PeriodDto.blockers` | unresolved facts in the period |
| Уроки на 7 дней | `metrics.lessonsNext7Days` | non-cancelled lessons in next 7 days |

## Not available (backlog, do not fake)
Revenue by period, retention/churn cohorts, per-manager conversion, teacher utilisation %,
plan vs actual. The former manager-cabinet `leadTrend` and teacher `loadPercent` had no API source
and were removed.
