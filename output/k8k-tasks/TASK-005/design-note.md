# TASK-005 — design note до реализации

Сохраняется единственный `packages/ui/src/tokens.css`, палитра provisional.
API/DTO/SDK/миграции не меняются. Вход TASK-004: 48 route budgets PASS,
74 OPEN дефекта; исходные 419 файлов скопированы в `before/`, hashes в `before.json`.

Планируемые локальные контракты:

- `scripts/stylelint-k8k.mjs`: Stylelint plugin `k8k/token-values`, запрет raw colors,
  font-size/font shorthand literals вне canonical tokens, запрет accent в UI semantics.
- `stylelint.config.mjs`: общий конфиг с `reportDisables`, без широких ignore paths.
- `scripts/k8k-stylelint.mjs`: scoped CSS discovery, точная legacy allowlist по
  path + ancestor selectors/media + property + value + occurrence, TASK удаления.
  Новая/изменённая/лишняя запись => fail; UI package не имеет исключений.
- `packages/ui/tests/contrast-contract.mjs`: пары/ожидания и alias resolver из CSS,
  без второй рабочей палитры. Ручная WCAG формула независимо сверяется с culori.
- Scoped UI design/test/lint scripts и CI step; отрицательные пробы обязательны.

Stylelint 16.26.1 (MIT, 2025-11-28), culori 4.0.2 (MIT, 2025-06-27),
postcss-value-parser 4.2.0 (MIT, 2021-11-29) — pinned dev-only; Node24 совместим,
React peer dependencies отсутствуют. Metadata проверены `pnpm view`; установка
только `--ignore-scripts`, без generate/postinstall/DB. Parser нужен для различения
URL/string/var/fallback/alpha/shadow без blanket исключений.

Проверяются существующие 25 чисел/17 порогов, ссылки на surfaces/sand,
hover/focus/disabled/error, alpha compositing и запрет accent. Focus/sidebar
обсуждаются как контраст двухслойного ring, без изменения бизнес-сценариев.
Размеры controls оформляются токенами 48/44/36; без реализации следующих TASK.
Рендер: synthetic local-only fixture RU/RO × 4 ширины, keyboard/long text/states.
Сборки для budget delta используют тот же TASK-004 метод и runtime; старые output
не перезаписываются. Несопоставимая delta остаётся unavailable.
