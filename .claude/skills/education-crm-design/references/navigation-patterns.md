# Navigation patterns

- Sidebar: one group per cabinet unless a cabinet has > 6 items (teacher: Работа / Ученики / Финансы).
  Counts on items only for "needs action" (overdue, waiting decisions), never for totals.
- Active state: `NavLink` with `end` on the cabinet root.
- **URL is the state** for filters, tabs, period, selected teacher and opened record:
  - Manager: `/manager/leads?view=closed&overdue=1&lead=<id>`, `/manager/students?status=DEBT&id=<id>`,
    `/manager/tasks?filter=overdue&task=<id>`, `/manager/schedule?view=day&date=YYYY-MM-DD&teacher=<id>&lesson=<id>`.
  - Director: `/director/decisions?kind=<DecisionKind>&ready=READY|BLOCKED`, `/director/team?tab=teachers|escalations&q=`,
    `/director/finance?kind=<UnresolvedKind>`.
- Update params with `setParams(next, { replace: true })` so Back leaves the page, not each filter click.
- Every KPI and breakdown row is a link to level 3 with the matching params.
- Global search submits to the cabinet's main list with `?q=`.
- New routes must also be added to the SPA rewrite in `vercel.json`.
