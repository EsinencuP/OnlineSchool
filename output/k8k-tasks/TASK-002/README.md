# TASK-002 — как читать инвентарь

[inventory.md](inventory.md) — читаемые таблицы экранов, операций и модулей.
[inventory.json](inventory.json) — единственный подробный инвентарь; Markdown является
его автоматически проверяемой проекцией. [report.md](report.md) — результат задачи.

Из `D:/OnlineSchool`:

```powershell
pnpm k8k:inventory verify
pnpm k8k:inventory selfcheck
```

`verify` заново извлекает source metadata и проверяет соответствие JSON/таблицы,
все runtime SDK write references, реальность HTTP/controller registration/service/ACL
и file references. `selfcheck` портит только in-memory копии инвентаря: потерянный
route, write без screen owner, несуществующий API, button-only completion, ложный
школьный KPI, несуществующий файл и устаревший source digest должны отклоняться.
Ни одна команда не запускает приложение, DB, provider или import бизнес-кода.

`pnpm k8k:inventory generate` обновляет JSON/Markdown после изменений исходников.
Это явная запись текущих task artifacts; TASK-001 snapshots он не меняет.

Поля JSON:

- `basis`: HEAD/branch, dirty/source digests с точным определением и394 input hashes.
  Digest относится к анализируемым исходникам, связанным тестам, helper и package
  manifest; mutable matrix/status/log и generated outputs исключены. Метод отличается
  от snapshot digest TASK-001, сравнивать значения как один формат нельзя.
- `screens`:48 входов/поверхностей (46 маршрутов/query-входов и2 общие/error поверхности).
  Здесь формы, диалоги, fields, handlers, query keys, lifecycle/rights, states, missing
  fields, будущие TASK и связанные test paths. Совпадающие base/overview URL — разные
  адреса одного экрана, а не новые продуктовые страницы.
- `frontendFacts`: все обнаруженные JSX form/dialog/menu/state/field/handler/navigation
  sites и их screen owners, включая общие компоненты.32 form sites и19 dialog sites —
  уникальные позиции исходников/вызовов компонентов, не число одновременно открытых окон.
- `operations`:140 действительных SDK contracts, из них89 имеют frontend runtime
  references,51 не вызываются scoped UI. `status` относится к backend/source presence,
  `uiIntegration` — к наличию consumer; ни одно поле не является runtime-приёмкой.
  `purpose`/`allowedAction` объясняют назначение, `controller` содержит method/path,
  регистрацию AppModule, security decorators/их раскрытие, guardTrace/serviceTrace,
  SQL/helper/data/ACL references. Callback reference считается вызовом через wrapper.
- `modules`:28 DASH-модулей +7 дополнительных строк, `existingOperationSymbols`
  содержат только реально обнаруженные API. `partial/missing` имеют конкретный TASK.
  DIR-01…06 conditional/disabled, DIR-07 out-of-release. Обязательные директорские
  решения выделены отдельно и не становятся условными вместе с Dashboard.
- `routeBuilders`, `navigationCatalog`, `moduleRegistration`: сверка builder/navigation
  с реальными routes/sections и графом Nest modules. Routerless staff prefix-match
  описан отдельно; неизвестные section нормализуются к overview.
- `rawTransportCalls`: один non-SDK presigned S3 PUT в редакторе ДЗ; credentials omit,
  источник URL — существующий requestStudentHomeworkUpload, затем confirm upload.

Ограничения: static reachability консервативен для props/runtime branches; JSX helper
может содержать create/edit ветви одновременно. Точный branch source сохранён там,
где он является условным AST-узлом. K8K/legacy ветви сохранены, а не признаны одинаковыми.
Связь теста по имени SDK/service — указатель на исходник, не test coverage и не новый прогон.
Девять UI states перечислены как требуемая таксономия; найденные state facts не доказывают
реализацию всех девяти состояний. Внешний provider/runtime/production gate не проверялся.
