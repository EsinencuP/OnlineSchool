# Implementation plan

Done in this increment (order followed dependencies):
1. Design tokens and shared primitives — `styles.css`, `shared/analytics.tsx`, `shared/WeekGrid.tsx`, `shared/charts.tsx`.
2. IA/navigation — director cabinet routes, four-role switch, URL state for filters.
3. Director cabinet — Обзор, Решения, Команда, Финансы (`src/director/*`).
4. Manager — workspace overview, students table (sort, debt filter), leads filters in URL.
5. Charts — removed unsourced series, ranked bars, daily columns, limit line.
6. Schedule — teacher filter, day view by teacher, school timezone, lane clustering.
7. Teacher — calm alert row, honest week-load chart (inherits the design system).
8. Consistency — director PAYMENT decisions read the manager's payments; director confirms via `payment.decide`.

## Backend backlog (frontend must not fake these)
| Need | Why | Suggested endpoint |
|---|---|---|
| Revenue by period (received/recognised) with previous-period comparison | Director "Что изменилось?" | `GET /director/analytics/revenue?from&to&granularity` |
| Student retention / churn cohorts | Growth and churn | `GET /director/analytics/retention` |
| Lead conversion per manager and per source | Manager effectiveness | `GET /director/analytics/leads` |
| Teacher utilisation vs available hours | Load % with a real denominator | extend `StaffItemDto.metrics` with `availableHours7d` |
| Plans/targets | Bullet charts "fact vs plan" | targets model |
| Typed `StaffItemDto.metrics` in OpenAPI | Remove casts in `director/logic.ts` | oneOf Manager/Teacher metrics DTO |
| Manager-facing lead daily series | Avoid client-side aggregation | `ManagerDashboardDto.leads.daily` |

## Frontend backlog
- Wire stores to HTTP (`/api/v1/*`) and add loading/error/stale states (A18).
- Route-level code splitting (A19). Dark theme (A17). Fix `Today.tsx` local weekday (A21).
- Student cabinet visual pass (not in scope of this increment).
