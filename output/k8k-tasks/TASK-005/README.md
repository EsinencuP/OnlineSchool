# TASK-005

Статус: DONE scoped token/contrast/Stylelint work. Палитра provisional.

- [Отчёт](report.md)
- [Проверки](final-checks.json), [negative exits](negative-probes.json)
- [Галерея](runs/2026-11-03T21-34-16.851Z/gallery.html), [visual metadata](runs/2026-11-03T21-34-16.851Z/visual.json)
- [Route budgets](runs/2026-11-03T21-34-16.851Z/bundle.md), [JSON](runs/2026-11-03T21-34-16.851Z/bundle.json)
- [Сохранность](source-preservation.json), [зависимости](dependencies.json)

```powershell
pnpm --filter @online-school/ui build
pnpm --filter @online-school/ui test
pnpm --filter @online-school/ui lint
pnpm --filter @online-school/ui test:design
pnpm k8k:design:evidence
```

Последняя команда создаёт новый timestamp run, только local source builds + loopback
synthetic browser; env/DB/API/providers не используются. Единственный принятый run:
`2026-11-03T21-34-16.851Z`. Промежуточные runs сохранены, не заменяют итоговый evidence.
TASK-006 не начат.
