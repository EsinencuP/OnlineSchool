# TASK-006

DONE scoped work; TASK-007 не начат. Шрифт/размеры provisional.

- [Отчёт](report.md), [checks](checks.json), [сохранность](source-preservation.json)
- [Specimens](runs/2026-11-03T21-57-30.880Z/gallery.html), [browser/AX](runs/2026-11-03T21-57-30.880Z/visual.json)
- [Route budgets](runs/2026-11-03T21-57-30.880Z/bundle.md), [font network](font-network.json)
- [Font source/provenance](../../../packages/ui/src/fonts/SOURCE.md)

```powershell
pnpm --filter @online-school/ui build
pnpm --filter @online-school/ui test
pnpm --filter @online-school/ui lint
pnpm k8k:fonts:check
pnpm k8k:typography:evidence
```

Font check требует isolated tools из requirements. Evidence создаёт новый timestamp run,
только safe frontend source builds/loopback fixture, без env/DB/providers.
Принятый run: `2026-11-03T21-57-30.880Z`.
