# UI/UX audit — cabinets (2026-11-27)

Method: code reading of `apps/manager-web` + live app (Vite, `localhost:5174`) at 1440×900, then 1920, 1280, 375.
App state: one SPA with manager, teacher and student cabinets on in-memory seed data shaped like `/api/v1` DTOs.
The backend has a full `director` API module, but there was no director cabinet.

| ID | Page / role | Problem | Evidence | Impact | Pri | Fix | Acceptance | Skill | Status |
|---|---|---|---|---|---|---|---|---|---|
| A01 | — / director | No director cabinet although `/api/v1/director/*` exists (decisions, escalations, staff, payroll, periods) | `main.tsx` routes, `apps/api/src/modules/director` | Director cannot act in the product | P0 | New `/director` cabinet on DTO shapes | 4 screens, decisions executable, tests | dashboard-design, navigation-ux | Fixed |
| A02 | Manager overview | Lead chart used a synthetic `leadTrend` not present in API; its totals (68 leads / 23 converted in 14 d) contradicted the KPI (8 % conversion, 13 leads in 30 d) | `seed.ts` leadTrend vs `selectDashboard` | Two answers to one question | P0 | Removed `leadTrend`; daily columns computed from lead records | KPI and chart from same records | validate-data | Fixed |
| A03 | Manager schedule | "Загрузка преподавателей %" from seed `loadPercent`, no API field or formula | `types.ts` TeacherBrief | Unverifiable number | P1 | Replaced with lesson count + hours in the visible period | Count equals blocks on grid | validate-data | Fixed |
| A04 | Manager schedule | No way to pick a teacher and see their calendar; all teachers mixed | live screen | Core task (teacher's week) impossible | P1 | Teacher chips, day view by teacher columns, URL state | `?teacher=` shows only that teacher | navigation-ux | Fixed |
| A05 | Shared WeekGrid | Hours/day columns from the browser timezone while day keys use Europe/Chisinau | `WeekGrid.tsx` `getHours`, local `weekDays` | Lessons shift for users outside MD | P1 | `hourOf`, school-day keys | Unit tests across DST/month | — | Fixed |
| A06 | Manager overview | Expiring subscriptions ring assumed 8 lessons (`max={8}`); students table bar assumed 12 | `Dashboard.tsx`, `Students.tsx` | Wrong proportions for 12-lesson plans | P1 | Use `totalLessons` | "N из total" | data-visualization | Fixed |
| A07 | Manager overview | Funnel drawn as dashed vertical pills; stage snapshot read as a conversion funnel | `Bars` | Misleading | P1 | Horizontal ranked bars labelled "сейчас" | — | dashboard-design | Fixed |
| A08 | Manager overview | Smoothed curve for small integer counts | `Sparkline` | Invents in-between values | P2 | Daily columns | — | data-visualization | Fixed |
| A09 | All | Decorative shapes (cross, heart, star), tinted tiles, 34 px titles, 26 px radii, gradients | `styles.css`, tiles | Noise, low density | P2 | New token layer, tiles neutral with entity dot | No `.shape` visible | ui-ux-pro-max | Fixed |
| A10 | Manager overview | Main screen was an analytics board; no prioritised work queue; KPIs without baseline | live | Extra clicks to find work | P1 | "Требует внимания" queue + KPIs with context and drill-down | Each KPI links to filtered list | dashboard-design | Fixed |
| A11 | Manager students/leads | Filters in component state: lost on reload/back, not linkable | `useState` filters | Context lost | P2 | Filters in URL (`status`, `view`, `overdue`) | Reload keeps filter | navigation-ux | Fixed |
| A12 | Manager students | No sorting; no debt filter | live | Slow triage | P2 | `SortTh`, "С долгом" chip | `aria-sort` set | data-table-ux | Fixed |
| A13 | Tables | Rows as rounded cards with 6 px gaps, no sticky header, numbers left-aligned | `styles.css` table | Low density, hard compare | P2 | Divided rows, sticky header, right-aligned numbers | — | data-table-ux | Fixed |
| A14 | Teacher today | Full-saturation coral banner; week load drawn as dashed pills without the daily limit | `Today.tsx` | Alarm fatigue; limit invisible | P2 | Tinted alert row; solid columns + limit line | — | dashboard-design | Fixed |
| A15 | Mobile | Top bar overflowed with 4 roles (page scroll 415/375 px) | measured | Horizontal scroll | P2 | Wrapping top bar | scrollWidth = clientWidth | ui-ux-pro-max | Fixed |
| A16 | SPA hosting | `vercel.json` rewrite lacks new cabinet path | config | Deep link 404 | P1 | Added `director` | — | — | Fixed |
| A17 | All | No dark theme | `styles.css` | — | P3 | Tokens ready; theme not built | — | ui-ux-pro-max | Open |
| A18 | All | No loading/error states: data is synchronous in-memory | stores | Needed when HTTP is wired | P2 | Add with real API client | — | dashboard-design | Open |
| A19 | Build | Single JS chunk 523 kB (Vite warning) | `vite build` | Slower first load | P3 | Route-level `lazy` | chunk < 500 kB | — | Open |
| A20 | Repo | `prettier --check` fails on 49 files incl. untouched ones | `format:check` | CI noise | P3 | Separate formatting commit | — | — | Open (pre-existing) |
| A21 | Teacher today | Weekday highlight and week load use browser-local `getDay()` | `Today.tsx:40,152` | Off-by-one near midnight outside MD | P3 | Use `dayKey` | — | — | Open |
