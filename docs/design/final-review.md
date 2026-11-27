# Final review

## Checks (2026-11-27)
| Check | Result |
|---|---|
| `tsc -p apps/manager-web` | pass |
| `vitest run` (manager-web) | 29/29 pass (5 files; 9 new tests) |
| `eslint apps/manager-web --max-warnings 0` | pass |
| `vite build` | pass; chunk-size warning 523 kB (A19) |
| `prettier --check` | fails on 49 files incl. untouched ones — pre-existing (A20) |
| Live UI | director, manager, teacher screens viewed at 1920, 1440, 1280, 375 px; no page-level horizontal scroll at 375 |
| Cross-cabinet flow | director confirms a payment → manager payments show "Подтверждён" (verified in the browser) |

## Before → after
| Area | Before | After |
|---|---|---|
| Director | no cabinet | overview, decision queue with approve/decline rules, team (managers, teachers, escalations), finance (payroll, periods, unresolved) |
| Manager overview | colourful tiles, decorative shapes, chart from synthetic series | KPI strip with baselines and drill-downs, prioritised work queue, honest charts |
| Schedule | all teachers mixed, week only, browser timezone | teacher filter, day view by teacher, school timezone, no dropped lessons |
| Tables | card-like rows, no sort | dense rows, sticky header, sorting with `aria-sort`, numeric alignment |
| Teacher | alarm banner, decorative bars | calm alert row, columns with limit line; same features |

## Remaining limitations
- All cabinets still run on in-memory demo data; no loading/error states until HTTP wiring.
- Director analytics limited to what `/api/v1/director/*` provides; revenue, retention and per-manager conversion need backend work (see implementation plan).
- Student cabinet only inherited the new tokens; no dedicated pass.
- Product references were researched from public help pages, not live product sessions.
- No automated visual-regression or keyboard e2e tests; checks were manual in the browser.
