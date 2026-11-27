# Design system (apps/manager-web/src/styles.css)

## Tokens (`:root`)
- Canvas: `--bg #f3f4f7`, `--surface #fff`, `--surface-2`, `--surface-3`, `--line`, `--line-strong`.
- Text: `--ink`, `--ink-2`, `--muted` (≥ 4.5:1 on white).
- Semantic: `--ok/--ok-tint`, `--warn/--warn-tint`, `--danger/--danger-tint`, `--info/--info-tint`.
- Data: `--c-people` (people/lessons), `--c-money` (money), `--c-prev` (previous period, secondary,
  cancelled), `--c-grid`.
- Brand (meaning only, never decoration): `--yellow` manager accent / trial lesson, `--teal` teacher,
  `--violet`, `--coral`, `--blue` + tints. Role accent: `.shell[data-role] --accent`.
- Spacing `--s1..--s6` = 4/8/12/16/24/32. Type `--fs-xs..--fs-2xl` = 12/13/14/16/20/24.
- Radii `--radius-sm 8`, `--radius 10`, `--radius-lg 12`. Shadows: `--shadow` (hairline), `--shadow-pop` (drawers).

## Components
| Need | Use |
|---|---|
| KPI tile with drill-down | `KpiCard` (`tone`: neutral/problem/warn/ok, `to`) inside `.kpis` |
| Category comparison | `HBarList` (ranked, linkable rows) |
| Small daily counts | `DailyColumns` |
| Composition, ≤ 5 parts | `ShareBar` |
| 2–5 exclusive options | `Segmented` |
| Filter by category with counts | `.chips` + `.chip[aria-pressed]` |
| Sortable column | `useSort` + `SortTh` |
| Work queue row | `AttentionItem` in `ul.attn-list` |
| Calendar | `WeekGrid` (`days` = week, `columns` = resources on one day) |
| Details / edit | `Panel` drawer (Esc, focus return) |
| Status | `Badge tone` |

## Density
Buttons 36 px (sm 30), chips 30, table rows ≈ 38 px, sticky table header, numbers `tabular-nums`
and right-aligned (`th.r`, `td.r`).

## Breakpoints
1280 (dashboard side column drops), 1100 (schedule side panel drops, `.grid-dir` stacks),
960 (sidebar becomes drawer), 560 (KPI 2-up, top bar wraps). No page-level horizontal scroll;
wide tables scroll inside `.table-wrap`.

## Icons
lucide-react, 14–18 px, only where they add meaning (nav, status, action). Not on every heading.
