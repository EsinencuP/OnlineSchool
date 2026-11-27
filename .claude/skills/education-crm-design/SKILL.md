---
name: education-crm-design
description: Governing design rules for the OnlineSchool (2K Academy) cabinets — director, manager, teacher, student. Use for ANY frontend change in apps/manager-web that touches screens, navigation, dashboards, KPIs, charts, tables, filters, forms, schedule/calendar or role cabinets; it decides which specialised skill to load and in what order conflicts are resolved.
---

# Education CRM design (coordinator)

Project: `apps/manager-web` (Vite, React 18, react-router 7, lucide-react, plain CSS tokens in
`src/styles.css`). Data comes from in-memory stores whose shapes mirror `/api/v1/*` OpenAPI DTOs
(`packages/api-contracts/openapi/openapi.json`). A screen is "real" only if every number on it can
be traced to a DTO field or a documented derivation from DTO fields.

## Decision order (when rules conflict)

1. Security and existing business logic (RBAC, backend rules mirrored in `*/logic.ts`).
2. Data truth (no invented metrics, `—` for missing, one number = one value everywhere).
3. The role's work task.
4. Functional completeness.
5. Information architecture.
6. Interaction cost.
7. Visual hierarchy.
8. Aesthetics.

## Which skill owns what

| Concern | Load | Notes |
|---|---|---|
| Dashboard composition, KPI tiles, QA pass | `dashboard-design` (+ `dashboard-dataviz`) | Skip its promotional sign-off block. |
| Chart choice and data honesty | `data-visualization`, `validate-data` | Principles only; never add Python/matplotlib to the web app. |
| Navigation, IA | `navigation-ux` | |
| Tables, sort, filter, search, forms | `data-table-ux`, `sorting-ux`, `filtering-ux`, `search-and-content-ux`, `web-forms-ux` | |
| Tokens, typography, a11y, responsive | `ui-ux-pro-max` | `python .claude/skills/ui-ux-pro-max/scripts/search.py "<q>" --domain ux` |

Load a specialised skill only when the change touches its concern; read this skill's references
first, they hold the project-specific decisions.

## Workflow for a frontend change

1. Name the role and the question the screen answers (`references/role-based-ux.md`).
2. Check data sources: DTO field or derivation (`references/metric-definitions.md`). Missing in
   API → add to the backlog in `docs/design/implementation-plan.md`, do not fake it.
3. Pick components from `src/shared/analytics.tsx`, `ui.tsx`, `WeekGrid.tsx` before writing new ones
   (`references/design-system.md`).
4. Charts: `references/data-visualization.md`. Tables: `references/data-table-patterns.md`.
5. Keep filters/period/selection in the URL (`references/navigation-patterns.md`).
6. Verify: `pnpm --filter @online-school/manager-web typecheck`, `... test`, `npx eslint apps/manager-web`,
   `vite build`, then look at the screen at 1440 and 375 px (`references/quality-checklist.md`).

## References

- `references/design-principles.md` — the non-negotiables.
- `references/design-system.md` — tokens, components, density.
- `references/information-architecture.md` — entities, cabinets, levels of detail.
- `references/navigation-patterns.md` — sidebar, URL state, drill-down.
- `references/dashboard-patterns.md` — per-role dashboard recipes.
- `references/data-visualization.md` — chart selection and honesty rules.
- `references/data-table-patterns.md` — tables, sort, filters.
- `references/metric-definitions.md` — every KPI with source and formula.
- `references/role-based-ux.md` — what each role needs and must not see.
- `references/quality-checklist.md` — pre-merge checks.
