# TASK-007

DONE scoped native controls; TASK-008 не начат.

- [Отчёт](report.md), [checks](checks.json), [сохранность](source-preservation.json)
- [Галерея](runs/2026-11-03T22-17-03.782Z/gallery.html), [browser cases](runs/2026-11-03T22-17-03.782Z/visual.json)
- [48 route budgets](runs/2026-11-03T22-17-03.782Z/bundle.md), [API hook preservation](consumer-source-proof.json)
- [Props и handoff](handoff.md), [React review](react-review.json)

```powershell
pnpm --filter @online-school/ui build
pnpm --filter @online-school/ui test
pnpm --filter @online-school/ui lint
pnpm --filter @online-school/student-cabinet typecheck:ui-controls
pnpm k8k:controls:evidence
```

Evidence создаёт timestamp run: source frontend builds + exact loopback fixture,
локальные CSRF/Profile mocks, external requests blocked. Без .env/DB/providers.
Принятый run `2026-11-03T22-17-03.782Z`. CSF stories готовы; actual Storybook runtime остаётся TASK-013.
