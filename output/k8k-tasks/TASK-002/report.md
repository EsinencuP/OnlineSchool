# TASK: TASK-002

Статус: **DONE** — source inventory. Продуктовые модули не объявлены принятыми.
Выполнен только TASK-002; TASK-003 не начат.

## Основа и сохранённые изменения

- HEAD: `171db2142858e035594737e141d422fa5378e844`.
- Ветка: `feat/k8k-design`; HEAD/ветка/index сохранены.
- Dirty digest текущей инвентаризации:
  `7004c02408417244f0008373cd1be12d2835a70ab32f577bd1a9324019648bc2`.
- Source digest:
  `fa97181d4ba7502ed001cf335e88bf4594bde1802316b4e9bad64a2f9d5d2822`.
- Определения digests и394 path/size/SHA256 записаны в `inventory.json → basis`.
  Dirty digest связывает tracked binary diff и input manifest, включая untracked
  исходники/helper; mutable log/matrix/status и task outputs исключены. Это другой
  явно описанный метод, чем snapshot digest TASK-001.
- Prerequisite подтверждён существующим TASK-001 manifest, его SHA256/verification
  и содержимым backup Reports/StudentHome/locale. Весь restore повторно не запускался.
- [Source preservation](source-preservation.json):166 файлов принятого snapshot
  неизменны. Отличаются только package script и3 документа учёта. Package JSON
  относительно TASK-001 добавляет только `k8k:inventory`; зависимости и другие scripts
  сохранены; окончания строк package.json нормализованы CRLF→LF по существующему
  `.prettierrc.json`. Проверены hashes старого baseline и двух пользовательских RAR, оба
  принятых TASK-001 manifest;394 input hashes совпадают с текущими исходниками.

## Что уже существовало

Пять кабинетов, общий/account вход, shared AccountMenu, student Reports/bell/locale,
staff section query и черновые общие контролы были в дереве до этой задачи. Матрица
28 dashboard-модулей не перечисляла все операции. Авторство исходного dirty/untracked
кода не присваивается; продуктовый код не изменялся.

Существование generic backend commands, teacher read-only preview или кнопки
не означает готовность соответствующего функционального модуля.

## Что изменено

| Путь | Поведение / причина |
|---|---|
| `scripts/k8k-inventory.mjs` | Локальный TypeScript AST inventory/verifier с исходными references и негативными fixtures; бизнес-код не импортируется/не исполняется |
| `package.json` | Команда `k8k:inventory` и нормализация CRLF→LF; безопасный target — только локальные source/Git/output files |
| `output/k8k-tasks/TASK-002/inventory.json` | Единственный подробный инвентарь screens/routes/forms/operations/service/ACL/modules/gaps |
| `output/k8k-tasks/TASK-002/inventory.md` | Проверяемая читаемая проекция JSON: role/route/operation/source/rights/states/tests/missing/future TASK |
| `output/k8k-tasks/TASK-002/{design-note,README,report}.md` | Предварительный design note, контракт/инструкция и отчёт |
| `output/k8k-tasks/TASK-002/{verification,selfcheck,source-preservation}.json` | Свежие source checks, отрицательные сценарии и сохранность основы |
| `docs/k8k-redesign-tasks/EXECUTION_LOG.md` | TASK-002 DONE, commit/digest/ссылки |
| `docs/K8K_REQUIREMENTS_MATRIX.md` | Уточнены28 статусов,7 дополнительных поверхностей и адресные gaps; названия DIR сверены с VIS12 |
| `docs/K8K_IMPLEMENTATION_STATUS.md` | Новый source inventory отделён от исторических browser/unit результатов |

## Контракты / SDK / миграции

Новые DTO, endpoint, SDK consumers, component props, зависимости и миграции не создавались.
Generated SDK не менялся. Все140 SDK contracts сопоставлены с существующими controller
method/path и регистрацией через `AppModule`. Namespace DASH-MGR не смешан со старым
пакетом MGR. Новые API в notes описаны как отсутствующие возможности, без выдуманных
endpoint names под видом existing.

Локальный контракт: `pnpm k8k:inventory generate|verify|selfcheck`, JSON schema v1.
Описание полей: [README](README.md). `generate` перезаписывает только собственные
TASK-002 generated artifacts. TASK-001 snapshots остаются immutable.

## Карта и существенные выводы

- **48 точек входа/поверхностей**:15 student routes,11 manager routes (включая `*`),
  6 manager student-tab query входов,12 staff base/section адресов,2 общих входа
  `/` и `/account`, shared account menu и student route error boundary. Это46 URL/query
  входов и2 поверхности, а не48 новых страниц.
- **89 используемых SDK operations**, **59 runtime write references**, все со screen
  owner и фактическим controller/service/ACL. Ещё51 SDK contract не вызывается scoped UI.
  **32 form sites и19 dialog sites** — уникальные позиции исходников/вызовов общих
  компонентов; не число одновременно открытых форм.
- Прослежены local/lazy imports, callback SDK references, JSX handlers, формы/поля,
  dialog/menu, query keys, dirty/pending/abort/unknown-result source evidence,
  manager tabs, staff sections, route builders, UI navigation и roleHome.
- Controller trace содержит точные security decorators, раскрытие составных command
  decorators, object guard/service traces, SQL/helper/data-call references и core
  Session/RBAC/CSRF/idempotency источники. Разрешение не выводится из видимости кнопки.
- `getStudentLessonHistory`, `disputeStudentLessonDeduction`,
  `requestStudentEducationPdf`, `getStudentEducationPdfStatus` уже существуют, но
  student UI их не вызывает: TASK-029/032. Существующий lessons archive не заменяет
  историю подтверждённых списаний; PDF backend не заменяет PDF workflow.
- Student Homework содержит status-tabs; их замена — TASK-030. Сериализованная очередь
  autosave,2s debounce, dirty navigation guard, presign→cookie-free S3 PUT→confirm,
  явная отправка, versions/idempotency сохранены в карте без переписывания.
- Teacher `EducationModule` пуст. Workspace показывает назначенные/выданные списки,
  но assignment/review/skills/4/8-publish/appeals workflow отсутствует или частичен:
  TASK-036…046. Generic `startLesson`/outcome/payroll API отмечены как существующие,
  но не подключённые к teacher UI.
- `confirmManagerPayment` → `ManagerPaymentWorkflow.publishPayment` →
  `PolicyService.managerPaymentPublication`: запись `approval_requested_at` и
  `PAYMENT_SENT_FOR_APPROVAL`, а не подтверждение денег директором. TASK-056 должен
  сохранить это различие. Изменение контактов не заменяет структурированный журнал:
  TASK-051/052; доска заявок требует полной пагинации: TASK-053/054.
- Staff workspace ограничен lessons/assignments100 и homework/tasks50. Client `.length`
  и уникальные IDs описывают загруженную выборку, не школьные KPI. DIR-01…06 остаются
  conditional/disabled; DIR-07 — out-of-release. Обязательные director decision
  queue/detail/forms выделены отдельно: TASK-059…062.
- Shared Login имеет password/error/busy и проверку допустимого входа, но не полный
  MFA/recovery workflow. Manager Login уже имеет passkey ветви. Эти факты не дают
  права ослабить действующие исключения/guard: TASK-066/067/019.

Для каждого из28 VIS12 модулей и7 дополнительных строк указан
implemented/partial/missing/conditional/out-of-release в соответствующем scope.
`operations.status=implemented` означает существование зарегистрированного backend
контракта; `uiIntegration` отдельно указывает consumer. Все релизные модули с gaps
имеют конкретные TASK и missing fields. Ни один не закрыт по одной кнопке.

## Источники и приоритет

AGENTS и TASK-002 §§3/5/6/7/8/10/12; актуальные ограничения PHASE0_CHECKS;
K8K_REDESIGN_PLAN этап0; K8K_REQUIREMENTS_MATRIX/IMPLEMENTATION_STATUS;
K8K_DESIGN_INSTRUCTIONS §§2–7 (действующий §7 выше исторического §8);
канонические VIS12 строки и UX VIS-03…12/UX-AUD. CON-01…11 сохранены:
директорские подтверждения/каждый частичный допуск, points200/220/250 и snapshot
при старте,4-vs-8, отсутствие внешних организационных автонапоминаний не менялись.
Картинка не использовалась как источник бизнес-правил/цифр.

В каталоге обнаружены Context7/Repomix/Playwright tools; запись metadata не названа
подтверждением авторизации. Для этой задачи достаточны локальные Git/rg/AST.
Внешние MCP/providers/accounts не вызывались; новые библиотечные API/dependencies
не вводились, обновления stack и сетевые проверки не требовались.

## Свежие проверки — команды и exit codes

Рабочий каталог всех команд — `D:/OnlineSchool`.

| Команда / проверка | Exit | Сценарий / артефакт |
|---|---|---|
| `git status --short`; `git branch --show-current`; `git rev-parse HEAD` | 0 | Исходная dirty основа/ветка/commit; сохранность проверена отдельно |
| `rg --files ... -g '*.ts' -g '*.tsx'` и адресные `rg`/чтения | 0 для найденных sources | Routes/pages/controllers/guards/services/документы; не запуск приложения |
| `pnpm k8k:inventory generate`, первая версия | 1, исправлено | Verifier нашёл query URL conditional builders и неверные draft aliases в notes; extractor исправлен, notes заменены реальными SDK symbols. Backend/SDK не менялись |
| `pnpm exec eslint scripts/k8k-inventory.mjs --max-warnings 0`, первый проход | 1, исправлено | Убран unused callback parameter, правила ESLint не отключались |
| `pnpm exec prettier --write scripts/k8k-inventory.mjs output/k8k-tasks/TASK-002/design-note.md` | 0 | Только новый helper/design note; существующие product sources не форматировались |
| `pnpm exec eslint scripts/k8k-inventory.mjs --max-warnings 0`, итог | 0 | Адресный lint нового helper |
| `pnpm exec prettier --check scripts/k8k-inventory.mjs package.json output/k8k-tasks/TASK-002/design-note.md` | 1→0 | Выявлен прежний CRLF package.json при endOfLine=lf; `pnpm exec prettier --write package.json` (0) нормализовал только окончания строк; JSON semantics проверены отдельно |
| `pnpm k8k:inventory generate`, итог | 0 | JSON/Markdown и исходные hashes,140 реальных SDK/controller registrations |
| `pnpm k8k:inventory verify`, итог | 0 | [verification.json](verification.json):48 входов,59/59 mapped writes, file refs/HTTP/module registration/28 VIS12/JSON projection/digests |
| `pnpm k8k:inventory selfcheck`, итог | 0 | [selfcheck.json](selfcheck.json): valid accepted,7 invalid in-memory inventories rejected без изменения исходников |
| Адресное Python `-B` чтение hashes TASK-001/current394 inputs/package JSON | 0 | [source-preservation.json](source-preservation.json):166 unchanged snapshot files,4 намеренных bookkeeping/package отличия,5 защищённых original artifacts/archives и2 accepted manifest неизменны |

Полный domain/unit/browser/DB regression, сборки, SDK generation — **NOT_RUN**:
для source inventory не требуются и не подменяют финальные gates.

## Acceptance checklist — сценарии §8

| Критерий | Статус | Доказательство |
|---|---|---|
| Каждый route входит в inventory | PASS | Извлечены student router/manager JSX routes, все builders/nav href,6 manager tabs и9 staff sections; негативный missing-route отвергнут |
| Каждый write SDK call связан с экраном | PASS |59/59 runtime references, включая callback references; отрицательный write-without-screen отвергнут; raw S3 PUT записан отдельно |
| Нет выдуманного endpoint как existing | PASS |140 реальных SDK↔HTTP/controller registrations; invented-existing-api отвергнут |
| Нет done по наличию только кнопки | PASS | Module status требует completion evidence; source status и runtime acceptance разделены; button-only-complete-module отвергнут |
| Ограниченная выборка не названа школьным KPI | PASS | Реальные workspace take100/100/50/50 проверяются; capped-list-school-kpi отвергнут |
| Все file references существуют | PASS | Проверяются пути/строки/future TASK; nonexistent-file-reference отвергнут; stale digest также отвергнут |

## Acceptance checklist — готовность §10

| Критерий | Статус |
|---|---|
| Prerequisite TASK-001 подтверждён реальными артефактами; все шаги TASK-002 выполнены | PASS |
| Проверены требуемые source contracts/ограничения и отрицательные сценарии | PASS |
| Ошибки исправлены без отключения lint/auth/доменной защиты | PASS |
| Артефакты связаны с HEAD/dirty/source digests; runtime секреты/данные не читались | PASS |
| Обновлены журнал, предметная матрица и status; handoff имеет реальные пути | PASS |
| Данные/действия имеют источник; future capabilities не выдаются за API | PASS |
| Прежний код, изменения, свежие static checks и исторические app tests разделены | PASS |
| БД/applied migrations/production/внешние провайдеры не изменялись | PASS |

## Визуальные доказательства / не проверено

Визуальных изменений нет. Route/role/locale/viewport fixtures, RU/RO на4 ширинах,
keyboard/focus/axe/browser/network и production проверки — NOT_RUN в TASK-002.
Связанные test files — ссылки по SDK/service identifiers, не новый test run или
строгое coverage. Девять UI states — требуемая таксономия; найденные state facts
не означают, что каждый экран реализует все девять состояний.

Static graph консервативен для runtime props/ветвей (например shared LeadForm
create/edit), K8K/legacy и conditional dialogs. В JSON есть branch/source references;
это не лог фактического выполнения. Staff использует prefix-match `roleHome`, а не
строгий nested router; invalid section нормализуется в overview. FND-GATE/LEGAL/
FIN-LEGAL/MeetPOC/OAuth/G4/production GO не закрыты. Блокеров TASK-002 нет.

## Остатки и handoff

TASK-003 получает `inventory.json → screens`, routeSource/entrySources, forms/dialogs,
navigation/branch evidence, требуемые states и related test paths для воспроизводимой
baseline screenshot/state matrix. Адреса46 URL/query входов уже перечислены;48 записей
включают также shared account menu/error boundary. Не считать неизвлечённые runtime
состояния PASS и не подставлять mock-продуктовые API вместо отсутствующих возможностей.

TASK-004 получает count/pagination scope и исходные страницы для бюджетов/дефектов.
Дальнейшие конкретные gaps закреплены `modules[].futureTasks` и `screens[].futureTasks`;
student TASK-024…034, teacher036…046, CRM048…058, director059…063, operator064/065,
auth/account066/067 и session019 выполняются только при отдельной выдаче владельцем.

## Риски и обратимость

Изменены новый локальный helper, одна package script и3 текущих документа учёта;
продуктовый код, текущая ветка, пользовательский dirty/untracked код и архивы сохранены.
Откат ограничивается этими добавлениями/документированными строками, без reset/clean/stash,
коммита всего дерева или удаления чужих файлов. TASK-001 snapshot сохраняет исходные
байты документов, его история не перезаписана. Push/merge/deploy/DB mutations не выполнялись.
