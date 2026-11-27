# Working agreement

- Deliver one small, usable increment per task. The main Sonnet session owns implementation, tests, and fixes.
- Do not spawn subagents unless the user explicitly requests delegation or invokes mvp-research or mvp-review. Do not create agent teams, judges, consensus panels, or recursive review loops.
- Use the current owner request as the acceptance contract. Do not import every document into context.
- Start with targeted file/symbol search. Read the relevant code and direct dependencies; expand only to resolve a specific uncertainty.
- Research only a decision blocking this increment. Prefer existing project patterns and official documentation. Distinguish verified facts from assumptions.
- Before editing, inspect git status and preserve pre-existing user changes. Do not reset, stage, commit, push, or deploy unless requested.
- Implement the smallest complete user flow. Avoid unrelated refactors, speculative abstractions, broad dependency updates, and extra documentation.
- Validate changed behavior with the existing test tools. Add a regression test for a behavioral bug when practical.
- Run focused checks during implementation. Run applicable integration/build checks before declaring the increment complete. Repeat a successful check only after a relevant change or new evidence.
- Keep complete command output in a local log when large; return exit status, a short summary, and relevant errors. Do not hide failures or lose a failing exit code in a pipeline.
- After two unsuccessful repair attempts on the same failure, stop that repair loop, preserve the work, and report the evidence and next decision. Never claim the task is done while required checks fail or remain unverified.
- Do not automatically escalate models, resume capped agents, or add more agents. Report partial results instead.
- Keep the final report brief: behavior changed, checks/results, remaining limitations.

# Frontend design rules

- Any meaningful change in `apps/manager-web` (screens, navigation, dashboards, KPIs, charts, tables, filters, forms, schedule, role cabinets) must follow the project skill `.claude/skills/education-crm-design` (load its SKILL.md, then only the references you need). It sets the decision order: security/business logic → data truth → role task → completeness → IA → interaction cost → hierarchy → aesthetics.
- Specialised project skills (`dashboard-design`, `ui-ux-pro-max`, `navigation-ux`, `data-table-ux`, `filtering-ux`, `sorting-ux`, `dashboard-dataviz`, `search-and-content-ux`, `web-forms-ux`, `data-visualization`, `validate-data`) are loaded only for their concern; sources and commits are in `.claude/skills/SOURCES.md`.
- Never show a metric without an API source or documented derivation; missing analytics go to the backlog in `docs/design/implementation-plan.md`.
