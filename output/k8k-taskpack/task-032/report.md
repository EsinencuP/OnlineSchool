# TASK-032 — адресный опубликованный отчёт и PDF workflow

TASK: TASK-032  
Статус: DONE в локальном объёме задания  
Дата: 08.11.2026

## Основа и сохранение работы

HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, ветка `feat/k8k-design`.
До работы: 445 dirty/untracked status records, SHA256
`d84e168474569deb1941daeb31b5a56248c356747c513a2cb35d186e8efa235c`.
[before.json](../../k8k-tasks/TASK-032/before.json), [status-before.txt](../../k8k-tasks/TASK-032/status-before.txt) и 31 исходный
snapshot в `before/`. [preservation.json](../../k8k-tasks/TASK-032/preservation.json) проверяет эти копии,
исходные пути, HEAD/ветку и неизменность всех 31 migration checksum.

Существующая dirty работа сохранена; изменения наложены адресно, без reset/clean,
commit/merge/push/deploy. API/worker/storage integration на рабочей среде не запускалась.
Prerequisites TASK-024 и TASK-031 подтверждены их реальными acceptance/report
артефактами и текущими исходниками. Старые числа тестов не считаются новым прогоном.

## Что уже существовало

Reports.tsx с paginated list/read и RU/RO, но reportId раскрывал лишь запись текущей
страницы. Существовали publishedReportsCte/reportJson/normalizeReport, bodyless
mark-read204/200, enqueue/status PDF, idempotency/CSRF/active-access guards, private
worker/renderer, fixed ready_at+1h, limit2 и source projection. Worker/storage
механизмы не переписывались. Исходники и старые тесты сохранены в before snapshots;
новый pre-change browser baseline по отчётам не заявляется.

[Design note до реализации](../../k8k-tasks/TASK-032/design-note.md) фиксирует DTO/operation names, состояния,
scope и причину read-only receipt endpoint для потерянного202.

## Что изменено

| Путь | Поведение / причина |
| --- | --- |
| apps/api/src/student/reports/reports.sql.ts | studentReportSql использует тот же publishedReportsCte и reportJson; адресный WHERE id без pagination. |
| reports.service.ts / reports.controller.ts | GET /api/v1/student/reports/:reportId → getStudentReport, существующий EducationalReportDto. UUID и общий forbidden ответ для отсутствующей разрешённой публикации. Explicit export routes стоят раньше detail. |
| reports.dto.ts / service / controller | PdfExportRequestResultDto и GET /reports/export-pdf/requests/:requestId → getStudentEducationPdfRequestResult. Ищет только свой существующий job по student_id/requested_by и job_ref type/source_operation_id/deduplication_key. |
| packages/api-contracts/openapi/openapi.json, src/generated/client.ts, src/generated/openapi.ts | Штатная export/generate цепочка. Два additive GET, без новых mutations. |
| apps/student-cabinet/src/pages/Reports.tsx | Одна серверная выдача с page в URL и отдельный detail query по reportId. Никакого поиска через все страницы/подмены первым элементом. Заголовок получает focus, возврат сохраняет page. |
| тот же ReportContent | Четыре public fields — plain text с исходными пробелами/переводами строк. Явное mark-read использует прежний schoolEmptyFetch; isNew обновляется только после ответа. Unknown receipt сначала сверяет detail, затем при необходимости same-key retry. |
| apps/student-cabinet/src/report-export.tsx | EducationPdfExport: subject/date form, immutable intent key/body, double-click lock, GET-сверка unknown, четыре job states через StatusChip, bounded sequential polling, resume и expiry. |
| тот же EducationPdfExport | Только validated READY+HTTPS+future expiresAt позволяет download. Каждый переход сначала fresh GET; исчезновение доступа/expiry/malformed READY скрывает кнопку. На sleep/focus прежняя ссылка скрывается до нового чтения. |
| тот же EducationPdfExport | Intent/selection/job ID в session-owned query cache; в URL только IDs/page. Signed URL только в памяти mounted UI, не в href/cache/storage. Unmount/session abort удаляет reads/timers и отбрасывает late replies. |
| apps/student-cabinet/src/report-copy.ts | RU/RO list/detail/export/error/job messages. Estimate не обещает готовность; пауза не утверждает, что неизвестное серверное задание всё ещё выполняется. Учительский текст не переводится. |
| apps/student-cabinet/src/api.ts / router.tsx / student.css | Reports/detail revalidate на mount; стабильный scroll key списка; wrapping, видимый focus и primary48px. |
| tests/unit/student-reports.test.mjs, student-reports-http.test.mjs | New detail/no-store/public projection/UUID/owner scope и receipt identity/read-only tests. |
| apps/student-cabinet/tests/fixture-server.mjs, report-journey-fixtures.mjs, report-export.spec.mjs, playwright.reports.config.mjs, package.json | Только synthetic HTTP/browser fixtures: report25 со страницы3, replay/lost responses, job states, private HTTP interception, locale/viewport. |
| scripts/k8k-refresh-budget.mjs | TASK-032 budget evidence на основе TASK-031, прежние50 маршрутов. |
| docs/K8K_IMPLEMENTATION_STATUS.md, docs/K8K_REQUIREMENTS_MATRIX.md, docs/k8k-redesign-tasks/EXECUTION_LOG.md, API reports/README.md | Текущий статус, traceability, ограничения и handoff. Исторические акты не переписаны. |

## Контракты / SDK / миграции

[contracts.json](../../k8k-tasks/TASK-032/contracts.json): 147 прежних операций, requests/responses/security/
parameters и components schemas сохранены. Всего149 операций: добавлены только
getStudentReport и getStudentEducationPdfRequestResult. Единственный новый response
schema — PdfExportRequestResultDto. Обработка пустых204/200 в transport не менялась.

Receipt — минимальное дополнение внутри PDF scope: прежний status GET требует
jobId, который может потеряться вместе с202. Receipt возвращает ACCEPTED/jobId
либо UNKNOWN/null, не создаёт job и не подписывает URL. ACCEPTED означает факт
enqueue, не READY. UNKNOWN не доказывает отсутствия команды: явный повтор в текущей
сессии сначала читает receipt и сохраняет тот же UUID/body. После reload без body
разрешено восстанавливать committed job через receipt; слепого POST с выдуманной
selection или новым ключом нет.

Подпись, polling, 1h TTL и queue limit остаются серверными. Worker/renderer,
export-data source, transport, lockfile, root package и notification menu
побайтово совпадают с before — проверено contracts.json. Новых зависимостей,
миграций, storage policy или применения схемы нет.

Генерация: API source → targeted typecheck → штатный export:openapi с DB-blocking
preload → generate:client → consumer typecheck/build. Generated вручную не правились.
GET detail использует ту же публикационную политику: own LESSON_8/PUBLISHED,
не future, последняя опубликованная версия; draft correction не скрывает прежнюю.
SQL predicates сохранены и проверены структурно; фактическое исполнение PostgreSQL
не заявлено. Read receipt относится к конкретному reportId/версии.

## Источники / решения

Приоритет: актуальная воля владельца/AGENTS → специальные решения → действующая
архитектура/K8K → visual template. Применены TASK-032 §§3/5–10; reports README/API/
public projection/worker TTL; reports DTO; VIS12 STU-04, V12-AT-04/10/11;
K8K design §5.1/§5.2 и действующий §7; student decision log №9.25/B, №9.26/B,
§3.7. Учебный PDF не подменяет регулируемый запрос персональных данных. CON-07/B
4/8 и CON-08/B отсутствие новых внешних автоуведомлений сохранены.

Использованы webdev-frontend-craft, webdev-api-data и condensed React review.
Context7 /reactjs/react.dev/__branch__v18 подтверждает cleanup/abort и игнорирование
поздних ответов: [React18 effects](https://github.com/reactjs/react.dev/blob/v18/src/content/learn/synchronizing-with-effects.md).
Пакеты/версии не обновлялись; template/newtemp.png — визуальная опора, не источник
бизнес-данных или правил публикации.

## Свежие проверки

Точные команды, exit codes и scope — [verification.json](../../k8k-tasks/TASK-032/verification.json).

| Команда | Exit | Результат / artifact |
| --- | --- | --- |
| pnpm --filter @online-school/api typecheck | 0 | [api-check.log](../../k8k-tasks/TASK-032/api-check.log) |
| pnpm --filter @online-school/worker typecheck | 0 | Адресная компиляция dist, без start; [worker-check.log](../../k8k-tasks/TASK-032/worker-check.log) |
| pnpm test:stu09 --roots tests | 0 | 86/86 unit/actual Nest HTTP/worker/SDK mocks; [api-tests.log](../../k8k-tasks/TASK-032/api-tests.log) |
| pnpm --filter @online-school/api export:openapi с no-db preload | 0 | [generate.log](../../k8k-tasks/TASK-032/generate.log) |
| pnpm --filter @online-school/api-contracts generate:client | 0 | Штатный Orval/publish/generate,149 ops; [generate.log](../../k8k-tasks/TASK-032/generate.log) |
| pnpm --filter @online-school/student-cabinet typecheck | 0 | [student-check.log](../../k8k-tasks/TASK-032/student-check.log) |
| Safe programmatic Vite build ниже | 0 | Dist перед browser tests; silent build, student-check содержит tsc |
| pnpm --filter @online-school/student-cabinet lint | 0 | [student-lint.log](../../k8k-tasks/TASK-032/student-lint.log) |
| Scoped eslint изменённых API/tests | 0 | [api-lint.log](../../k8k-tasks/TASK-032/api-lint.log) |
| pnpm --filter @online-school/student-cabinet test:report-export --grep "polling stops" | 0 | Адресный timing smoke, [poll-timing.log](../../k8k-tasks/TASK-032/poll-timing.log) |
| pnpm --filter @online-school/student-cabinet test:report-export | 0 | 14/14 Chromium; [browser.log](../../k8k-tasks/TASK-032/browser.log), [playwright.json](../../k8k-tasks/TASK-032/playwright.json) |
| node scripts/k8k-refresh-budget.mjs --task-032 | 0 | 50/50; reports249272 bytes, max255923 из256000 с fonts; [budget.log](../../k8k-tasks/TASK-032/budget.log), [budgets.json](../../k8k-tasks/TASK-032/budgets.json) |
| node output/k8k-tasks/TASK-032/verify-contract.mjs | 0 | [contracts.log](../../k8k-tasks/TASK-032/contracts.log) |
| node output/k8k-tasks/TASK-032/verify-preservation.mjs | 0 | 31 snapshots/31 migrations; [preservation.log](../../k8k-tasks/TASK-032/preservation.log) |
| Scoped git diff --check | 0 | [diff-check.log](../../k8k-tasks/TASK-032/diff-check.log) |
| node output/k8k-tasks/TASK-032/verify-artifacts.mjs | 0 | [artifacts-check.json](../../k8k-tasks/TASK-032/artifacts-check.json) |

Safe build из D:/OnlineSchool, PowerShell:

```powershell
'import { build } from "vite"; await build({envDir:false,publicDir:false,logLevel:"error",build:{emptyOutDir:false}});' | pnpm --filter @online-school/student-cabinet exec node --input-type=module
```

Export выполнялся со штатным script и
`NODE_OPTIONS=--import=file:///D:/OnlineSchool/output/k8k-tasks/TASK-018/no-db-export.mjs`.
Любой DatabaseService.client access тогда выбрасывает ошибку; NODE_OPTIONS
восстановлен. .env и рабочие DB/provider credentials не читались.

```powershell
$task032Paths = (Get-Content output/k8k-tasks/TASK-032/before.json -Raw | ConvertFrom-Json).paths.path
git -c core.safecrlf=false diff --check -- $task032Paths
```

Исправления новых тестов: helper выбирает текущий jobId из URL вместо первого
старого fixture job; link ограничен main, чтобы не совпадать с navigation;
clock замораживается после initial/queued UI, не до bootstrap React Query.
Проверка polling сохраняет отсутствие раннего чтения, следующий GET после2s и
остановку ≤60s/30 automatic attempts. Старые tests/transport ожидания не ослаблены.
Ни full recursive regression, ни реальный worker, ни SQL rehearsal не запускались.

## Визуальные доказательства

Роль STUDENT, только synthetic fixtures. Routes /student/reports?page=3 и
/student/reports?reportId=80000000-0000-4000-8000-000000000025&page=3&ui.k8k=1;
job/request UUID динамические, без signed URL в DOM/screenshots.

43 viewport screenshots: RU/RO × 360/768/1024/1280 × list/detail/form/queued/ready
=40; ещё unknown enqueue RO, processing RU и limit429 RU.
[Полный реестр](../../k8k-tasks/TASK-032/screenshots.json).

- [RO 360 list](../../k8k-tasks/TASK-032/after/ro-360-list.png)
- [RO 1280 detail](../../k8k-tasks/TASK-032/after/ro-1280-detail.png)
- [RO 360 form](../../k8k-tasks/TASK-032/after/ro-360-form.png)
- [RU 360 READY](../../k8k-tasks/TASK-032/after/ru-360-ready.png)
- [RO unknown enqueue](../../k8k-tasks/TASK-032/after/ro-enqueue-unknown.png)

Form/job снимки прокручены к соответствующему блоку, не объявлены full-page.
Просмотрены реальные desktop/mobile рендеры, длинные имена/тексты/UUID переносятся,
горизонтального overflow нет. Heading focus, focus формы/list link и primary≥48px
проверены. Даты и подписи RU/RO, учебный текст не переводится.

Mock download перехватывает HTTPS navigation и отдаёт синтетический body с PDF
MIME/attachment filename. Это проверяет browser download workflow, **не содержимое
настоящего PDF**, качество renderer или S3 delivery.

## Не проверено / необходимые внешние условия

- NOT_RUN: фактический PostgreSQL binding/row isolation/publication cases,
  trigger/transaction/concurrency/migration rehearsal. Готовый
  tests/integration/student-reports-readonly.test.mjs не запускался; нужен отдельно
  разрешённый рабочий procedure/target. QA/disposable DB не создавалась.
- NOT_RUN: реальная очередь worker → renderer/fonts/layout → private S3/CORS/
  download/TTL. Worker tests используют mocks; offline SDK signing с synthetic keys
  не является storage probe. Нужна отдельная разрешённая provider приёмка.
- NOT_RUN: физические mobile/screen-reader, полный WCAG, TASK-035/FND-GATE,
  legal/financial/Meet provider gates и production GO.
- После reload неизвестного запроса без сохранённого body UI делает только receipt
  GET. Если job ещё не подтверждён, не создаёт новый intent эвристикой; body текущей
  сессии сохраняется для безопасного явного same-key retry.

## Acceptance checklist

[acceptance.json](acceptance.json).

- **PASS** — deep_link_independent_page: Report25 со страницы3 читается одним detail GET без перебора списка; фокус заголовка и возврат page3. Нет подмены первым отчётом.
- **PASS** — published_scope_public_projection: Detail использует publishedReportsCte/reportJson/normalizeReport; UUID, own/foreign/unknown/no-store проверены HTTP mocks. Draft/future/superseded predicates сохранены структурно; фактический PostgreSQL отдельно NOT_RUN.
- **PASS** — four_fields_plain_text_dates: Четыре публичных поля, точные пробелы/переводы строк, script отображается текстом; private notes исключены. RU/RO даты с годом, date-only без timezone shift.
- **PASS** — explicit_read_empty_transport: 204 first/200 repeat без body, прежний schoolEmptyFetch; чтение не публикует и не выполняет другую задачу.
- **PASS** — read_confirmation_and_unknown: isNew меняется после ответа, новая версия снова unread; unknown read проверяет detail и не повторяет подтверждённый POST.
- **PASS** — export_selection_and_scope: Omitted body/all history и filtered subject/date-only; reverse400, foreign403, inclusive student-zone/DST. UI передаёт ту же selection и CSRF/UUID.
- **PASS** — stable_intent_double_click: Два synchronous clicks дают один POST. Same key/body retry после receipt UNKNOWN; server replay/conflict/limit покрыты API mocks.
- **PASS** — lost_202_reconciliation: Read-only receipt находит собственный committed job по исходному UUID. Lost response/reload восстанавливаются GET без второго POST. UNKNOWN не объявляется QUEUED.
- **PASS** — four_job_states_no_false_ready: QUEUED/PROCESSING/READY/FAILED; без valid HTTPS URL и будущего expiresAt нет download или ready success. 429 объясняется отдельно.
- **PASS** — poll_2s_bound_and_resume: Нет дополнительного GET до раннего интервала, следующий появляется после2s; максимум30 automatic attempts/60s, затем пауза. Resume/route return читает тот же job без нового POST.
- **PASS** — fixed_expiry_and_download_recheck: Server mock clock: expiry=ready_at+1h, repeat polling не продлевает, точная boundary FAILED без URL. Browser expiry hides download; каждый download делает fresh GET.
- **PASS** — synthetic_download_path: Fresh READY запускает перехваченный private fixture download; это синтетический HTTP body, не доказательство настоящего PDF/worker/S3.
- **PASS** — session_revocation_and_switch: 403/401 убирают download/DOM; logout прекращает polling; поздний READY после logout или смены actor во второй вкладке не возвращает приватные данные.
- **PASS** — url_and_cache_privacy: Signed URL только в памяти mounted UI, не в query cache/localStorage/sessionStorage/evidence. В URL страницы только UUID/page; invalid PDF IDs не подменяются предыдущим job.
- **PASS** — ru_ro_keyboard_matrix: RU/RO × 360/768/1024/1280 × list/detail/form/queued/ready =40 matrix, ещё3 state screenshots. Long names/text, heading focus, keyboard controls, primary≥48px и no horizontal overflow.
- **PASS** — backward_compatible_sdk: 147 прежних операций/requests/responses/security/params и schemas сохранены; только2 GET и PdfExportRequestResultDto добавлены, standard export/generate.
- **PASS** — budget_fonts: 50/50 ≤256000 bytes v2 с raw local Golos; reports route249272 bytes, max255923.
- **PASS** — preservation_and_scope: 31 source snapshots,31 migration hashes, исходные445 status paths и HEAD/branch сохранены. Transport, worker/renderer/export-data/lockfile без изменений; no DB/deploy.
- **PASS** — sources_handoff: TASK024/031 prerequisites и актуальные №9.25/B/9.26/B, VIS12 STU04/V12-AT04/10/11 применены. Новые student publications/рассылки не вводились.
- **NOT_RUN** — live_postgresql_and_races: Нет разрешённого PostgreSQL execution/migration/transaction-race rehearsal; mocks и SQL structure не подтверждают реальные row binding/triggers.
- **NOT_RUN** — real_worker_pdf_s3_delivery: Реальные queue worker, PDF renderer/fonts/layout, S3/CORS/private download/TTL и доставка не запускались; HTTP download mock не является provider evidence.
- **NOT_RUN** — full_accessibility_role_and_gate: Физический mobile/screen reader, полный WCAG, TASK035/FND-GATE/LEGAL/Meet provider/production GO вне локального TASK032.

## Остатки и передача

[handoff.md](../../k8k-tasks/TASK-032/handoff.md). TASK-033 продолжает bell sources по отдельному документу;
уведомление с reportId ведёт в адресный endpoint, не в page1-поиск.
TASK-035 — полный кабинетный gate; TASK-042/043/044 — teacher publication/workflow4/8.
Ни один следующий TASK автоматически не начат, новые публикации/внешние сообщения
семье не выполнялись.

## Риски и обратимость

API и UI выпускать совместимо: прежние147 callers работают, новые detail/receipt
reads требуют обновлённого API. Старые prepared STU-09/schema prerequisites не
считаются применёнными и не отменяются этим UI.

Rollback только TASK-032 hunks с опорой на before, с учётом более поздних изменений;
новые report-copy/report-export/tests/config убирать лишь после проверки использования.
Не reset/clean общего дерева и не удалять отчёты/read receipts/jobs/чужие архивы.
URL может оставаться в browser history как UUID job/request, но не как подписанная
ссылка; сервер перепроверяет owner/session на каждом чтении.

