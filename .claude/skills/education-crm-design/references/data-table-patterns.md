# Data tables

- Structure: `.table-wrap > table`, sticky header, row divider lines, hover tint, `tbody tr`
  focusable (`tabIndex=0`, Enter opens) when the row opens a drawer.
- Numbers right-aligned (`th.r`, `td.r`), tabular figures, units in the cell ("2 400 лей").
- Sorting: `useSort` + `SortTh` (sets `aria-sort`). Default sort = the work order of the role
  (oldest decision first, most overdue tasks first, biggest debt to teachers first). Missing values last.
- Filters: chips with counts above the table; segmented control for 2–3 states; free-text search box
  only when the list can exceed one screen. Keep filters in the URL.
- Row actions: one primary inline button ("Открыть", "Принять"); destructive actions only in the drawer
  with a reason field when the API requires one.
- Empty state: `Empty` with the reason and how to reset the filter.
- Inside a card: `.table-wrap.flush` (no double frame).
- Mobile: the table scrolls inside its wrapper; the page never scrolls horizontally.
- Do not turn rows into decorative cards; cards are for entities where identity beats comparison
  (kanban leads).
