# Quality checklist (run on the changed screens only)

Data
- [ ] Every number traces to a DTO field or a formula in `metric-definitions.md`.
- [ ] The same number agrees across screens (KPI ↔ list ↔ other cabinet).
- [ ] Missing data shows `—` or an empty state, not 0.
- [ ] Dates/times use school timezone helpers (`dayKey`, `hourOf`, `fmt*`).

UX
- [ ] The screen's question is answered in the first viewport at 1440×900.
- [ ] Each KPI/breakdown links to filtered records; filters survive reload (URL).
- [ ] Problem states are warm and have an action next to them.
- [ ] Loading/empty/error/partial states exist where data can be absent.

Accessibility
- [ ] Keyboard: rows that open drawers are focusable and open on Enter; drawers close on Esc.
- [ ] `aria-pressed` on chips/segments, `aria-sort` on sortable headers, labels on inputs.
- [ ] Colour is never the only carrier of status (badge text, edge + label).

Visual
- [ ] No card-in-card, no decorative shapes/gradients, title ≤ 24 px.
- [ ] 1920, 1440, 1280 and 375 px checked; no page-level horizontal scroll.

Commands
- `pnpm --filter @online-school/manager-web typecheck`
- `pnpm --filter @online-school/manager-web test`
- `npx eslint apps/manager-web --max-warnings 0`
- `pnpm --filter @online-school/manager-web build`
