# Design system (apps/manager-web/src/styles.css)

Base = the v1 stylesheet (cream canvas, navy sidebar, tinted tiles with shapes, large radii).
The "Staff cabinets layer" at the end of `styles.css` adds tables, charts, calendar and KPI tiles
on top of it. The student cabinet uses only the v1 base.

## Tokens (`:root`)
- Canvas (v1): `--bg #f4f1ea` cream, `--surface #fff`, `--surface-2`, `--surface-3`, `--line`; staff layer adds `--line-strong`.
- Text: `--ink`, `--ink-2`, `--muted`. Sidebar: `--navy-deep`.
- Brand colours with tints and inks: `--yellow`, `--coral`, `--teal`, `--blue`, `--violet` — used as entity
  colours (see design-principles §2). Role accent: `.shell[data-role] --accent`.
- Staff layer aliases: `--danger`, `--ok`, `--c-people` (= blue), `--c-money` (= teal), `--c-prev`, `--shadow-pop`.
- Radii (v1): `--radius-lg 26`, `--radius 18`, `--radius-sm 12`.

## Components
| Need | Use |
|---|---|
| KPI tile with drill-down | `KpiCard` (`color` = entity, `tone` problem colours the number, `to`) inside `.kpis` |
| Interactive chart | `Chart` (bars/lines/areas, hover tooltip, keyboard, sr-only table) |
| Notion-style calendar | `MonthPicker`, `MonthGrid` + `WeekGrid`; teachers as colour-coded toggleable calendars |
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
