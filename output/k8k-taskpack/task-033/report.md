TASK: TASK-033

Статус: **DONE в локальном объёме задания**. Реальные PostgreSQL/projector/провайдеры и полный gate — NOT_RUN.

Основа: HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, ветка `feat/k8k-design`.
До работы458 записей dirty/untracked, digest `db66e7bed8949d9f9504c34973ebe224b6270183086934a6bea30b649686d6f2`.
Сохранены32 byte snapshots; все458 исходных путей существуют, HEAD/ветка прежние,
набор и SHA31 миграций неизменны. [Исходное состояние](../../k8k-tasks/TASK-033/before.json),
[проверка сохранности](../../k8k-tasks/TASK-033/preservation.json). Это не commit поверх чужого dirty diff.
Коммит/push/deploy не выполнялись.
Точный инкремент относительно снимков: [changes.json](../../k8k-tasks/TASK-033/changes.json),27 изменённых
путей из37 проверенных; исходные незатронутые файлы также отражены в реестре.

Что уже существовало:

- GET list/count, PATCH read, POST read-all, empty response204/CSRF/UUID и critical-operation replay; immutable first read_at, scoped student access, per-student lock, sources/projector/retention90d/500.
- Прототип bell с пагинацией/read-all и legacy redirect,18 текущих типов DTO, публичные entity IDs; общий UI kit, RU/RO, TASK-026 financial anchors и TASK-032 адресный published report.
- Перед изменениями заново прошли65 notification mocks. Предыдущие TASK prerequisites проверены по реальным коду/артефактам, их старые screenshots/тесты не выданы за проверки TASK-033.

Что изменено:

| Путь | Поведение и причина |
| --- | --- |
| apps/student-cabinet/src/StudentNotificationMenu.tsx | Единственный shared Drawer из NotificationBell. Controlled events=1, закрытие сохраняет остальные query params, ESC/outside/focus return, внутренний scroll, footer и bottom nav. Open-only preview page/locale без polling и без предыдущих строк на новой странице. Global unread/total остаются видимыми на empty beyond-end. |
| apps/student-cabinet/src/Layout.tsx, api.ts, router.tsx | Count имеет собственный read/error/retry; unavailable не подменяется0. Header использует profile.timeZone. Notification-family403 очищает sibling cache и отменяет late requests; session lease уже существующего transport предотвращает смену actor. Legacy URL переносит params в bell и не создаёт redirect loop. |
| apps/student-cabinet/src/notification-copy.ts, student-presentation.ts, student.css | RU/RO UI/type/date/aria; type+UUID определяют lesson/homework/report/subscription target. Payload URL и посторонний ID не используются. Historical/manual текст сохраняет пробелы и язык. Кнопки≥44, read-all≥48; короткий Drawer прокручивается внутри. |
| apps/api/src/student/notifications/{notifications.dto.ts,notifications.controller.ts,notifications.service.ts,notification-locale.ts} | Единственное additive read изменение — optional locale=ru/ro. Только реальные собственные source/IN_APP dispatch catalog metadata проходят существующий renderer/validator; внутренние metadata удаляются до response. Неполные/отсутствующие metadata и MANUAL_MESSAGE возвращают stored text. |
| tests/unit/student-notifications*.test.mjs, apps/student-cabinet/tests/{bell.spec.mjs,bell-fixtures.mjs,fixture-server.mjs,k8k-presentation.test.mjs} | Адресные service/HTTP/SDK/React/browser fixtures:18 типов, strict locale, fallback/privacy, count/page, read races и target scope. Synthetic fixture поддерживает committed response loss и arrival после read-all. Старый legacy read-all test сохранён без изменений. |
| apps/student-cabinet/{package.json,playwright.bell.config.mjs}, scripts/k8k-refresh-budget.mjs | Явный безопасный локальный test script/harness и свежий TASK-033 budget на базе TASK-032. Новых зависимостей нет. |
| docs/K8K_IMPLEMENTATION_STATUS.md, docs/K8K_REQUIREMENTS_MATRIX.md, docs/k8k-redesign-tasks/EXECUTION_LOG.md, notifications/README.md | Текущий статус,18 типов, границы локали и свидетельства; исторические акты не переписаны. |

Прочтение: synchronous lock предотвращает двойную команду; mutation204 сначала
инвалидирует count/dashboard/все preview pages. Optimistic read/zero не используются.
При unknown fresh GET preview/count предшествует повтору **того же** UUID. Fixture
фиксирует read-all, добавляет новое событие и теряет ответ; replay не поглощает новое
событие, first read_at не меняется. Следующий явный read-all получает новый UUID.
Чтение события не вызывает report-read, учебную, финансовую или CRM команду.

Контракты/SDK/миграции:

- [contracts.json](../../k8k-tasks/TASK-033/contracts.json):149→149 operations, прежние request/response/security и schemas неизменны; только optional query locale у getStudentNotifications, default ru, enum ru/ro. Неизвестные keys/другие локали400, pageSize bounds сохранены. Count SQL остался одним COUNT без metadata/body join.
- API source → targeted typecheck → штатный export:openapi → generate:client (Orval/publish/generate) → consumer typecheck/build. Generated файлы вручную не правились. Для экспорта использован DB-blocking `NODE_OPTIONS=--import=file:///D:/OnlineSchool/output/k8k-tasks/TASK-018/no-db-export.mjs`, затем NODE_OPTIONS восстановлен. Доступ к DatabaseService.client запрещён preload.
- Producer `notification.service.ts`, `templates.ts`, publisher, worker, transport, root package.json и lockfile проверены SHA без изменений. Миграций/зависимостей не добавлено. Рабочая БД, .env, live DB/provider credentials и production не читались/не менялись; seed/migration/реальный worker не запускались.

Источники/решения: индивидуальный TASK-033 §§3/5–10, текущие K8K plan/requirements,
CON-08/B (без внешних автоматических сообщений семье), VIS12 STU-06 и
V12-AT-04/08/10/11. Полная [матрица18 источников](../../k8k-tasks/TASK-033/source-audit.md) отличает код
producer от исполнения реального бизнес-факта. Missing API increment разрешён
текущими owner instructions; исторический frontend-only запрет не восстановлен.
[Design note](../../k8k-tasks/TASK-033/design-note.md) создан до реализации. Для используемого Radix API
сверена официальная документация через Context7 `/radix-ui/website`.

Проверки (точные команды/границы также в [verification.json](../../k8k-tasks/TASK-033/verification.json)):

| Команда | Exit | Свежий результат |
| --- | --- | --- |
| pnpm test:stu10 --roots tests до изменений | 0 |65/65 baseline, [api-baseline.log](../../k8k-tasks/TASK-033/api-baseline.log) |
| pnpm --filter @online-school/api typecheck | 0 | Targeted tsc build, [api-check.log](../../k8k-tasks/TASK-033/api-check.log) |
| pnpm test:stu10 --roots tests | 0 |86/86 service/HTTP/SDK mocks, [api-tests.log](../../k8k-tasks/TASK-033/api-tests.log) |
| pnpm --filter @online-school/api export:openapi с no-DB preload | 0 |149 operations, [generate.log](../../k8k-tasks/TASK-033/generate.log) |
| pnpm --filter @online-school/api-contracts generate:client | 0 | Штатная генерация, [generate.log](../../k8k-tasks/TASK-033/generate.log) |
| pnpm --filter @online-school/student-cabinet typecheck | 0 | [student-check.log](../../k8k-tasks/TASK-033/student-check.log) |
| pnpm --filter @online-school/student-cabinet exec node --input-type=module -e "import {build} from 'vite'; await build({envDir:false,publicDir:false,logLevel:'error',build:{emptyOutDir:false}})" | 0 | Без .env/public copy, [build.log](../../k8k-tasks/TASK-033/build.log) |
| pnpm --filter @online-school/student-cabinet test:presentation | 0 |12/12, [presentation.log](../../k8k-tasks/TASK-033/presentation.log) |
| pnpm --filter @online-school/student-cabinet lint | 0 |0 warnings, [student-lint.log](../../k8k-tasks/TASK-033/student-lint.log) |
| pnpm exec eslint apps/api/src/student/notifications/notifications.dto.ts apps/api/src/student/notifications/notifications.controller.ts apps/api/src/student/notifications/notifications.service.ts apps/api/src/student/notifications/notification-locale.ts tests/unit/student-notifications.test.mjs tests/unit/student-notifications-http.test.mjs --max-warnings 0 | 0 | [api-lint.log](../../k8k-tasks/TASK-033/api-lint.log) |
| pnpm --filter @online-school/student-cabinet test:notification-bell | 0 |13/13 Chromium, [browser.log](../../k8k-tasks/TASK-033/browser.log), [playwright.json](../../k8k-tasks/TASK-033/playwright.json) |
| node scripts/k8k-refresh-budget.mjs --task-033 | 0 |50/50 routes, [budget.log](../../k8k-tasks/TASK-033/budget.log), [budgets.json](../../k8k-tasks/TASK-033/budgets.json) |
| node output/k8k-tasks/TASK-033/verify-contract.mjs | 0 | [contracts.log](../../k8k-tasks/TASK-033/contracts.log) |
| node output/k8k-tasks/TASK-033/verify-preservation.mjs | 0 |32 snapshots/31 migrations/458 paths, [preservation.log](../../k8k-tasks/TASK-033/preservation.log) |
| node output/k8k-tasks/TASK-033/verify-diff.mjs | 0 |37 scoped paths, без новых whitespace defects; [diff-check.log](../../k8k-tasks/TASK-033/diff-check.log) |
| node output/k8k-tasks/TASK-033/verify-artifacts.mjs | 0 | [artifacts-check.json](../../k8k-tasks/TASK-033/artifacts-check.json) |

21 новых API assertions/cases добавлены к65 baseline:17 RO system types,
strict locale, fallback/metadata/privacy и HTTP read-only projection. HTTP mock
теперь моделирует catalog column SQL; исходный PRIVATE_STORED_TITLE/body privacy
assertion сохранён, а не ослаблен. Реальное исполнение SQL этим не доказано.

13 браузерных сценариев проверяют RU/RO matrices, page2 (0 unread на странице при
global7), empty beyond-end с ненулевым total, loading/closed query/cancel,
unknown read-all + arrival/replay/new key/immutable timestamp, cached page refresh,
индивидуальный read и старый report25 без загрузки списка/автопрочтения отчёта,
lesson/homework/financial-anchor переходы, invalid IDs/payload.url, target403/404,
stale503/count unavailable/empty, count403+late body, legacy reload/back/close,
short-height keyboard/focus trap и logout/межвкладочную смену actor.
Сетевые запросы вне локального fixture origin блокируются.

Итерации проверки: исходный Popover дал262709 bytes student login и был заменён
разрешённым общим Drawer с уже подключённой зависимостью. Первая browser проверка
нашла44px read-all на768px; исправлен CSS до48. Проверка accessibleName фонового
bell заменена на aria-label внутри modal (Radix корректно скрывает фон). Test labels
сверены с текущим словарём, строгие продуктовые требования сохранены. После этого
финальные13 сценариев прошли на окончательной сборке. [Первый запуск](../../k8k-tasks/TASK-033/browser-first.log)
сохранён; PASS относится только к финальным логам. Никакой линтер/бюджет не ослаблен.

Визуальные доказательства:29 screenshots, из них24 матричных
`/student?events=1&view=list&ui.k8k=1`, role STUDENT, RU/RO ×360/768/1024/1280,
page1/page2/empty beyond-end. Дополнительно unknown, stale/unavailable, empty feed,
forbidden и360×560 keyboard. [Реестр с route/fixture/размерами/SHA](../../k8k-tasks/TASK-033/screenshots.json).
Примеры: [RU360](../../k8k-tasks/TASK-033/after/ru-360-page1.png), [RO1280 page2](../../k8k-tasks/TASK-033/after/ro-1280-page2.png),
[short keyboard](../../k8k-tasks/TASK-033/after/ro-360-short-keyboard.png), [unknown](../../k8k-tasks/TASK-033/after/ru-unknown-read-all.png).
Synthetic12 событий шести существующих типов + synthetic35 опубликованных отчётов;
human/manual/history не переведены. Не использованы новые события для заполнения UI.

Accessibility: axe WCAG2A/AA/2.1AA/2.2AA на открытом Drawer360px:0 violations
для [RU](../../k8k-tasks/TASK-033/axe-ru.json) и [RO](../../k8k-tasks/TASK-033/axe-ro.json). Ручной просмотр реального рендера
RU360, RO1280 page2, unknown и short keyboard; автоматизированы initial/return
focus, ESC/outside, Tab trap, scroll/viewport containment и touch sizes.
Это не сертификация WCAG и не пользовательская проверка screen reader.
Condensed React review: hooks unconditional, page/locale в key, стабильные row IDs,
session/mounted guard после await, synchronous mutation lock, shared overlay lifecycle,
plain-text rendering; TS/lint/browser подтверждают выбранный объём.

Бюджет по той же k8k-route-v2 методике: gzip closure + все3 локальных WOFF2 по одному.
Student251072/256000 (+1800 к TASK-032), max всего255923/256000;50/50 PASS,
storybook modules0. Измерение всех50 — контроль shared bundle, не полный regression.

Не проверено/блокеры:

- PostgreSQL SQL binding нового metadata join, реальные trigger/source scope, projector delivery, concurrent lock contention/read-all,500/TTL/expiry — NOT_RUN, нужна отдельная разрешённая integration-среда. Подготовленные10 PostgreSQL CTE checks не запускались.
- Реальные teacher publication/manager subscription/finance facts, outbound provider delivery — NOT_RUN; producer-код и mocks не доказательство доставки.
- Полный student acceptance TASK-035, recursive regression, FND-GATE, юридическое соответствие и production GO — NOT_RUN. Условия Phase0 не разрешают выдавать адресные проверки за финальный gate.

Acceptance checklist:

- PASS — один bell/Drawer и совместимый legacy URL, без нового notification center/card.
- PASS — server pagination/global unread/total, unavailable/empty/stale/403/session и204/read-all replay проверены локально.
- PASS — проверенные scoped lesson/homework/report/subscription routes; нет ссылки без допустимого type+UUID.
- PASS — read notification не выполняет учебные/финансовые/CRM/report-read команды.
- PASS — RU/RO catalog + public params, human/history/incomplete fallback без persisted rewrite;18 типов сохранены.
- PASS — все источники названы, synthetic факты явно отделены от реальной доставки.
- PASS — свежие tests/screenshot/budget/contract/preservation и обновлённые docs.
- NOT_RUN — реальные PostgreSQL/projector/producer E2E и полный gate; причины выше.

Машиночитаемая [приёмка](acceptance.json) различает PASS
и NOT_RUN, последний не превращён в true.

Остатки: только [handoff TASK-034](../../k8k-tasks/TASK-033/handoff.md); TASK-034 не начат. Интерфейсы,
ключи и ограничения переданы. Нового бизнес-решения для этого локального инкремента
не потребовалось.

Риски и обратимость: новый metadata join пока проверен mocks/static contract,
а не PostgreSQL. Риск вывода неполного перевода ограничен fail-closed fallback к
сохранённому тексту. Rollback — только изменения этого TASK по32 snapshots и явно
новым locale/copy/test/config файлам, затем штатная регенерация SDK; не откатывать
весь dirty tree/историю и не удалять чужие файлы. Исторические persisted события и
миграции не изменялись.
