# Improvement log

## Pass 1 — Architecture & UX
- Added the director cabinet (`/director`, 4 sections) on `DecisionItemDto`, `EscalationDto`, `StaffItemDto`, `PayrollSummaryDto`, `UnresolvedDto`, `PeriodDto`.
- Role switch and start page include the director; `vercel.json` rewrite covers `/director/*`.
- Manager overview became a workspace: KPI strip with baselines + "Требует внимания" queue with actions.
- Filters/tabs/period/teacher/record moved to URL params (manager leads, students, schedule; director decisions, team, finance).
- Design system: neutral canvas, semantic + data colour tokens, spacing/type scales, smaller radii, borders instead of shadows, no decorative shapes, compact tables with sticky headers.

## Pass 2 — Data & visual intelligence
- Removed unsourced `leadTrend` (contradicted KPI) and `loadPercent`; replaced by values derived from records.
- Funnel pills → ranked horizontal bars labelled as a snapshot; smoothed curve → daily columns with sr-only table.
- Hard-coded denominators (8, 12 lessons) → `totalLessons`.
- Teacher week load: solid columns + daily limit line; over-limit days red.
- Schedule: teacher chips, Day view with teachers as columns, Week view per teacher, lessons per teacher (count + hours); status on block edge, trial on fill.
- Director: decisions by type with "3+ days" problem tier; payroll table with paid share; unresolved facts by type → filtered table.

## Pass 3 — Independent review (subagent `mvp-reviewer`) and fixes
- Fixed inverted "Сегодня" button state in the schedule.
- `?date=` validated (bad links no longer crash the page); decisions `kind`/`ready` whitelisted.
- WeekGrid: hour range widens for early/late lessons (none dropped); cluster-based lanes so chained overlaps never cover each other; invalid `grid/gridcell` roles replaced with region/group.
- Decision rows: single tab stop (the "Открыть" button) instead of row + button.
- Mobile: top bar no longer overflows with four roles; KPI strip 2-up.
- Added regression tests (`WeekGrid.test.ts`, `director/logic.test.ts`).
