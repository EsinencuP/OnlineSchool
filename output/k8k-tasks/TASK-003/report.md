# TASK: TASK-003

Статус: **DONE** — воспроизводимая baseline-матрица текущего UI.
Выполнен только TASK-003. TASK-004 не начат; найденные дефекты не исправлялись в продукте.

## Основа

- HEAD: `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design`.
- Scoped dirty digest:
  `b6821f156103220df0bb2f8347db889ad00a399fb611191bba4578493c7dd36d`.
- Source digest:
  `7c981ad78dcbb4c9d5d5d6ad15cbd1489549ad5694488db73994ed036aade915`.
- Полное определение digest и399 input hashes: [fixture manifest](runs/2026-11-03T20-50-31-027Z-8bc616/fixture-manifest.json).
  Digest связывает tracked binary diff и path/SHA256 исходников/fixtures/tooling;
  generated output и изменяемые документы учёта исключены. Это отдельный метод,
  отличный от snapshot digest TASK-001 и inventory digest TASK-002.
- TASK-002 проверен командой `pnpm k8k:inventory verify` **до** изменения package.json:
  exit0,48 surfaces/89 used operations/59 mapped writes. Его inventory не перезаписан.
- Из394 input-файлов TASK-002 сохранены393; package.json только добавляет два локальных
  scripts. Старый baseline, пользовательские RAR и принятые TASK-001 manifests сохранены.
- Pasted TASK-003 SHA256:
  `324160b1d4426908f4c5bbc341c2c5d27f55ed734bc67cf6b40e01f858ee2f00`.

## Что уже существовало

Пять кабинетов, общий вход и AccountMenu, student Reports/bell/locale, staff sections,
student HTTP fixture, typed manager fixtures и StateBoundary существовали до задачи.
Исторические phase/browser screenshots и limited Reports smoke сохранены.
Новый baseline показывает **после уже существующего инкремента**, а не его выдуманный before.
Авторство прежнего dirty/untracked кода не присваивается.

## Что изменено

| Путь | Поведение / причина |
|---|---|
| `scripts/k8k-screen-baseline.mjs` | Строит текущие3 приложения+common fixture в новый run, поднимает loopback origins, снимает48 inventory surfaces и дополнительные сценарии; два изолированных прохода |
| `scripts/k8k-baseline-fixtures.mjs` | Адаптирует существующие synthetic DTO, фиксирует время/UUID/long data, сверяет реальные OpenAPI response schemas; неизвестные операции не подменяются success |
| `scripts/k8k-baseline-audit.mjs` | Проверяет целостность PNG, полноту inventory×locale×viewport×pass, common states и source hashes; создаёт audit и HTML gallery |
| `packages/ui/tests/baseline/{index.html,fixture.tsx}` | Test-only entry для существующих AppShell/StateBoundary;9 классов, pending/unknown раздельно; длинные RU/RO подписи |
| `package.json` | `k8k:baseline-ui` и `k8k:baseline-ui:audit`, только local/mock target |
| `output/k8k-tasks/TASK-003/` | Design note до реализации, инструкция, новые immutable-by-convention timestamp runs, INDEX/manifest/runtime/audit/pixel comparisons, наблюдения/NOT_RUN/visual review и отчёт |
| `docs/k8k-redesign-tasks/EXECUTION_LOG.md` | TASK-003 DONE с commit/digest/доказательством |
| `docs/K8K_REQUIREMENTS_MATRIX.md` / `docs/K8K_IMPLEMENTATION_STATUS.md` | Baseline completion отделена от UI/функциональной приёмки и будущих исправлений |

Продуктовые исходники, generated SDK, auth/ACL/financial guards не изменялись.

## Контракты / SDK / миграции

Новых product DTO/endpoint/props, зависимостей и миграций нет. Test fixture не входит
в cabinet entrypoints, не является production fallback и не принимает бизнес-решений.
Vite использует source aliases, `configFile:false`, `envDir:false`, `publicDir:false`,
без API proxy. Сборки сохраняются только в новом `run/build/`; app dist не использовался
как доказательство свежего кода и не перезаписывался этим harness.

Локальный контракт описан в [design note](design-note.md) и [README](README.md).
Фиксированы `2026-11-03T10:30:30Z`, `Europe/Chisinau`, DTO data и UUID policy.
Node fixture worker имеет фиксированный Date/UUID; browser `clock.setFixedTime`
сохраняет работающие timers, synthetic UUID генератор сбрасывается в каждом context.
Текущие typed ManagerMe capabilities сохранены. AccountMenu использует существующий
demo catalog/соответствующий demo actor ID; переключение сессии не выполнялось.
PENDING receipt и историческое директорское подтверждение — разные synthetic записи.

## Итоговая матрица и фактические assertions

Принятый run: [INDEX](runs/2026-11-03T20-50-31-027Z-8bc616/INDEX.md),
[JSON](runs/2026-11-03T20-50-31-027Z-8bc616/INDEX.json),
[галерея с фильтром](runs/2026-11-03T20-50-31-027Z-8bc616/gallery.html).

| Измерение | Результат |
|---|---|
| Inventory surfaces |48/48: student/manager routes, manager tab query, staff section query, общий/account вход, AccountMenu и route error |
| Дополнительная матрица |134 case definitions: открытые диалоги/long lists/forms, editor dirty/save-error/pending, conflict, пустая OTP форма, MFA prompt, role read states/common states |
| Языки / ширины |RU/RO ×360/768/1024/1280, height900, deviceScaleFactor1, reduced-motion |
| Проходы |2; каждый case/locale получает новый context и synthetic state |
| INDEX строки / PNG |2144 /2128;16 явно неприменимых health-empty NOT_RUN |
| Покрытие common states |10/10 variants:9 классов плюс отдельный unknown outcome |
| DTO / renderer assertions |39 вызванных operations,0 schema findings,0 assertion failures,0 неожиданных NOT_RUN |
| External network sentinel |532/532 запросов прерваны; serviceWorkers:block |
| Source preservation в capture/audit |399/399 input hashes неизменны |
| Воспроизводимость |1064/1064 semantic hashes и размеры совпали;1010/1064 PNG совпали побайтно |
| Малые PNG-различия |54 пары сохранены; точный RGBA diff без tolerance/masks, максимум0,1094439% пикселей |
| Overflow |124 screenshots,62 уникальных first-pass case/locale/width наблюдения; сохранены scrollWidth/offenders/существующие hidden containers |

В каждом INDEX row указаны route, actualPath, role, requested locale, actual htmlLang,
viewport, fixture-id, HEAD/dirty digest, screenshot/SHA256 и реальные assertions.
Записываются operation/method/status без request bodies/headers/cookies. Loading не
считается ready; ожидаемые состояния проверяются по DOM/тексту/redirect/pending request.
Common forbidden/expired не показывают synthetic private marker. Подлинность backend ACL
таким mock-ответом не доказывается.

`pixel-comparison.json` хранит обе версии каждой различающейся пары и bounding box.
Размеры и текст одинаковы; визуально проверенные различия относятся к отрисовке
native controls/краям элементов. Это **не** заявление о1010+54 exact matches и не
автоматическое принятие любых будущих отличий по порогу0,11%. При сравнении будущих
изменений обе версии и небольшую вариативность нужно учитывать явно.

## Наблюдения и передача дефектов

[baseline-findings.json](baseline-findings.json) содержит62 first-pass overflow
наблюдения и284 адресных RO-наблюдения по известным статическим UI headings/htmlLang.
Это строки case/locale/viewport, не284 уникальных дефекта продукта. Кириллические имена,
тексты заданий и сообщения людей не считаются ошибками перевода.

Overflow не маскировался `hidden`, snapshots не обрезались. Видны переполнение header/
AccountMenu ученика на mobile и другие long-form/list случаи; текущая частичная
локализация сохранена. Наблюдения передаются TASK-004 для адресной классификации и
конкретным role localization TASK, без выполнения следующей задачи сейчас.

## Источники / решения

TASK-003 §§3/5/6/7/8/10/12; AGENTS preservation/source priority; актуальный PHASE0_CHECKS;
K8K_REDESIGN_PLAN этап0; действующие K8K status/matrix; design instructions §§2–7;
UX VIS-03…12/UX-AUD и canonical inventory TASK-002. Приоритет владельца/текущего §7
выше исторического frontend-only §8. CON-01…11 не менялись.

Применён skill `vercel:verification`: цепочка browser→локальный HTTP fixture→DTO→render,
сначала реальный источник, затем evidence. Явные ограничения TASK-003 имеют приоритет
над общими советами skill о реальной среде: `.env`/DB/provider проверки не выполнялись.
Context7 подтвердил API установленного Playwright1.64.1 по первичным docs
`github.com/microsoft/playwright/blob/v1.64.1/docs/src/api/class-clock.md`;
новые версии/пакеты не устанавливались. MCP listing не назывался авторизацией.

## Проверки: команда → exit code → артефакт

Все команды запускались из `D:/OnlineSchool`, только safe local/mock boundaries.

| Команда / проверка | Exit | Результат |
|---|---|---|
| `git status --short`; `git branch --show-current`; `git rev-parse HEAD` |0| Сохранена исходная dirty основа/ветка/HEAD |
| `pnpm k8k:inventory verify` до package edit |0| TASK-002 prerequisite подтверждён; его исторический inventory не регенерировался |
| Первый scoped ESLint новых helper |1→0| Browser globals заменены/ограничены через globalThis, правила не отключались |
| Ранний `pnpm k8k:baseline-ui --smoke` |1| Исправлен только test source-alias для account-ui/style.css; product imports не менялись |
| Предварительные smoke/discovery |1→0| Исправлены test selector/короткий loading текст/query route specificity/long-label assertion; данные и product UI не ослаблялись |
| Ранний CLI cases-filter с0 cases |0, НЕ доказательство| Сохранён как диагностическая история; пустая выборка теперь явно отклоняется |
| `pnpm exec eslint scripts/k8k-screen-baseline.mjs scripts/k8k-baseline-fixtures.mjs scripts/k8k-baseline-audit.mjs packages/ui/tests/baseline/fixture.tsx --max-warnings 0` |0| Адресный lint нового tooling/fixture |
| `pnpm exec prettier --check` новых3 scripts, fixture TSX/HTML и package.json |0| Только изменённый scope |
| `pnpm k8k:baseline-ui` |0|134 cases×2 passes×2 locales×4 widths; [INDEX](runs/2026-11-03T20-50-31-027Z-8bc616/INDEX.json) |
| `pnpm k8k:baseline-ui:audit output/k8k-tasks/TASK-003/runs/2026-11-03T20-50-31-027Z-8bc616` |0| [audit.json](runs/2026-11-03T20-50-31-027Z-8bc616/audit.json):DONE, screenshot hashes,48/48 coverage/common states/source hashes |
| `node --input-type=module -` локальное RGBA-сравнение через уже установленный Playwright PNG decoder |0| [pixel-comparison](runs/2026-11-03T20-50-31-027Z-8bc616/pixel-comparison.json); Python PIL отсутствует, новые зависимости не ставились |
| Python `-B` адресная сверка source/package/архивов |0| [source-preservation-before](source-preservation-before.json), [итоговая](source-preservation.json) |
| `git diff --check -- package.json` |0| Whitespace diff чистый; исторические source diffs не переписывались |

Старый `k8k-implementation-smoke` не запускался: он пишет в исторический output.
Его Reports/bell сценарии перенесены в новый timestamped harness. Рекурсивный test/build,
общая API/DB регрессия и итоговые gates — NOT_RUN; адресные4 Vite bundles являются
частью именно требуемой screenshot-задачи.

## Визуальные доказательства

Все routes/roles/locales/viewports/fixtures перечислены в INDEX. Выборочный ручной
просмотр: [visual-review.json](visual-review.json) — conflict dialog768, common forbidden1024,
пустая code form360 и предварительные mobile RU/RO. Полная автоматическая матрица
не выдаётся за ручную проверку всех2128 изображений. Tab probe сохраняет фактический
focus/outline; полного keyboard/gamepad/screen-reader/zoom/axe gate здесь нет.

## Acceptance checklist — обязательные сценарии §8

| Критерий | Статус | Доказательство |
|---|---|---|
| Два запуска с фиксированным временем сопоставимы |PASS|2 независимых capture passes,1064 same semantic/dimensions pairs,1010 exact PNG и54 явно сохранённых малых diff |
| External network abort |PASS|532/532 sentinel abort; exact loopback origins only; no API proxy/service worker |
| Blank/loading не засчитан ready |PASS|Nonblank иready-is-not-loading assertions; точный common state/private marker иrole state assertions;0 failures |
| Overflow измерен, не скрыт |PASS|124 screenshots сoverflow, offenders/hidden containers вINDEX; harness не добавляет hidden/crop/mask |
| Длинные RU/RO подписи |PASS|Fixed LONG fixture + common localized label assertions; actual htmlLang/text observations; полнота перевода продукта не заявлена |
| Недоступный сценарий NOT_RUN |PASS|16 health-empty rows + [39 адресных gap/unavailable записей](unavailable-scenarios.json); отсутствующие flows не заменены product mocks |

## Acceptance checklist — критерии готовности §10

| Критерий | Статус |
|---|---|
| Проверен prerequisite, выполнены шаги именно TASK-003 |PASS|
| Сценарии подтверждены реальным renderer/evidence, не только compilation |PASS|
| Исправления tooling не отключают lint/auth/guards/доменные ограничения |PASS|
| Артефакты связаны сHEAD/digest/fixture manifest; реальные детские данные/секреты не читались |PASS|
| Обновлены log/matrix/status, переданы конкретные paths |PASS|
| Реальные DTO/существующие capabilities; нет выдуманных production successes |PASS|
| Разделены исходный код, новое tooling, исторические и свежие доказательства |PASS|
| Рабочая БД/applied migrations/production/чужой код/архивы сохранены |PASS|

DONE относится к baseline-задаче. Обнаруженные UI-дефекты остаются OPEN.

## Не проверено / блокеры

[unavailable-scenarios.json](unavailable-scenarios.json):39 явно описанных gaps/исключений.
Teacher education/review/4/8 publishing/appeals, director decision UI/read queues,
student history/dispute/PDF consumers и прочие отсутствующие требования не рисовались
как существующий продукт. Conditional DIR-01…06 disabled, DIR-07 out-of-release.

Health-empty неприменим к существующему DTO; common empty captured. One-time-password
output намеренно NOT_RUN: snapshot с секретом запрещён. Пустой OTP prompt captured,
но реальный код не выдавался/не вводился/не сохранялся. Live Neon/S3/Meet/message
delivery/production auth не вызывались. Legacy feature-flag exhaustive matrix относится
к финальной регрессии; текущая baseline ui.k8k=1 сохраняет её наличие без переписывания.
FND-GATE/LEGAL/FIN-LEGAL/MeetPOC/OAuth/G4/production GO не закрыты. Блокеров TASK-003 нет.

## Остатки / следующему кодеру

TASK-004 получает этот run/INDEX/audit/pixel-comparison, baseline-findings,48 inventory
owners иsource digests для budgets/адресного реестра дефектов. Future before/after
нужно сравнивать с этой версией после уже существующего инкремента, сохраняя locale,
viewport,fixture clock,case ID и ограничения native pixel variability.
Текущие missing contracts/fields остаются закреплены inventory.modules[].futureTasks;
не создавать заглушку API/роль/финансовые права ради совпадения screenshots.

## Риски и обратимость

Снимки и build output находятся локально на том же диске; это точка сравнения, не внешний
disaster-recovery backup. Helper создаёт новый каталог; принятый run и ранние outputs
не удалялись/не заменялись. Rollback ограничен3 новыми scripts/test fixture/двумя
package scripts и3 документами учёта; продуктовый код и исторические артефакты сохранены.
Reset/clean/stash, смена ветки, commit/merge/push/deploy иDB mutations не выполнялись.
