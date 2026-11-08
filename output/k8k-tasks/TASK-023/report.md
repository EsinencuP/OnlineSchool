# TASK-023 — приёмка общей оболочки и API-совместимости

**Статус — PARTIAL.** Локальная приёмка оболочки и SDK пройдена. Полный gate блока 2 зависит от рабочего источника критических событий и проверки серверной эскалации из TASK-022/050.

## Основа и предшествующие результаты

Ветка `feat/k8k-design`, HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, dirty digest `1c96ae6a402ece966b04dfc378e088f033df41497e3d90945737cda416ffb7d8`. Основа включает 179 исходников и файлов проверки. Сверены входные хеши TASK-022 и рабочие входы TASK-018–021. Изменения в более ранних манифестах сопоставлены с последующими задачами. Сохранены исходные статусы дерева, 11 входных копий и 9 исторических защищённых файлов. [Основа](basis.json) · [Сохранение](preservation.json)

| Вход | Фактическая проверка в TASK-023 |
|---|---|
| TASK-018 | Действующие actor context и четыре добавленные GET-операции eligibility/context. 17 свежих HTTP/SDK и доменных проверок; команды повторно проверяют доступ независимо от metadata. |
| TASK-019 | Двухвкладочная смена аккаунта и отсечение позднего ответа в свежем account smoke. Отдельные Manager-тесты кэша, студентский late draft и HTTP MFA guard. |
| TASK-020 | Staff URL с `section`, `filter`, `id`, открытие чужой карточки, Back/Forward, фокус. Старый `/student/notifications` открывает колокольчик, старый CRM URL сохраняет overdue-фильтр. |
| TASK-021 | Один действующий `useContextRefresh` на оперативную группу. Фоновый переход fresh → stale проверен во всех пяти кабинетах. Серверное время и время получения разведены. Подробные проверки интервалов и T−10 остаются в артефактах TASK-021. |
| TASK-022 | Реальный Dashboard принимает совместимый `priority`. Отсутствие поля, `null`, синтетические пять, подтверждённый ноль и 503 с кэшем проверены свежим прогоном. Положительный рабочий producer остаётся открытым. |

Приоритет источников — TASK-023 §§3/5–10, VIS-03…12, TECH-13/14, решение владельца о смене демоаккаунта от 01.11.2026 и действующие правила директора. Metadata сообщает результат проверки, а право на команду определяется действующим guard. [Контракты](contracts.json) · [Аудит TASK-022](../TASK-022/source-audit.md)

## Изменения

- `packages/ui/src/style.css` разрешает блоку аккаунта сжиматься на узком экране. В исходном прогоне шапка ученика давала горизонтальное переполнение 323 > 320 px в обоих языках. После исправления проверены меню, колокольчик и перенос имени на 320 px, в том числе с открытым меню. [Диагностика](reflow-probe.log) · [RO 320](screenshots/student-ro-320-reflow.png)
- `scripts/k8k-shell-gate.mjs` и команда `k8k:shell:gate` собирают три production-клиента в памяти с выключенными `envDir` и `publicDir`. Стенд перехватывает каждый API-вызов на loopback и принимает только синтетические GET. Те же сборки используются для измерения маршрутов. [Доказательства](browser.json)

Добавлений в DTO, SDK, зависимости и миграции нет. OpenAPI, клиент Orval, OpenAPI TypeScript и каталог ошибок воспроизвелись побайтно. Сохранены все 140 исходных комбинаций method/path/operationId. Текущий OpenAPI содержит 145 операций. Повторную генерацию проверил штатный экспорт с preload, запрещающим доступ к `DatabaseService.client`. [Хеши](contracts.json)

## Свежие проверки

Node 24.21.0, pnpm 10.34.9, React 18.3.1, TanStack Query 5.105.0, Vite 7.3.7, TypeScript 6.0.3, NestJS 12.2.0, Orval 8.45.0, Playwright 1.64.1, Chromium 156.0.8078.4. [Версии](versions.json)

| Команда | Exit code | Результат |
|---|---:|---|
| `pnpm --filter @online-school/api build`, `pnpm --filter @online-school/api export:openapi` с `NODE_OPTIONS=--import=file:///D:/OnlineSchool/output/k8k-tasks/TASK-018/no-db-export.mjs` | 0 | Свежая серверная сборка, 145 операций. [Лог](sdk.log) |
| `pnpm --filter @online-school/api-contracts generate:client` и `pnpm --filter @online-school/api-contracts build` | 0 | Побайтное воспроизведение. [Лог](sdk.log) |
| `pnpm --filter @online-school/ui build`, `pnpm --filter @online-school/ui test` и `pnpm --filter @online-school/ui lint` | 0 | 137 тестов, ESLint и Stylelint. [Тесты](ui.log) · [Lint](lint.log) |
| `pnpm --filter @online-school/account-ui build`, затем `pnpm --filter @online-school/platform --filter @online-school/manager-web --filter @online-school/student-cabinet typecheck` | 0 | Сборка общего account-ui и проверка типов трёх потребителей. [Лог](types.log) |
| `pnpm exec eslint scripts/k8k-shell-gate.mjs --max-warnings 0` | 0 | Адресный lint стенда. [Лог](gate-lint.log) |
| `pnpm test:k8k-staff-context` и `pnpm test:mgr09 --roots tests` | 0 | 17 staff и 51 dashboard тест, в том числе eligibility, no-store, ACL, portfolio, отзыв роли, 503 и SDK. [Staff](staffapi.log) · [CRM](managerapi.log) |
| `node --experimental-vm-modules node_modules/jest/bin/jest.js --runTestsByPath tests/unit/manager-http.test.mjs tests/unit/manager-payments-http.test.mjs --roots tests --runInBand -t 'requires MFA even\|MFA, revoked'` | 0 | 2 адресных HTTP-теста MFA и отзыва доступа. [Лог](mfa.log) |
| `pnpm --filter @online-school/manager-web exec vitest run src/test/session.test.tsx src/test/error-policy.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism` | 0 | 11 тестов сессии, кэша, 401/403 и idempotency. [Лог](session.log) |
| `pnpm --filter @online-school/platform test:account-chrome` и `pnpm --filter @online-school/platform test:staff-context` | 0 | 19 account и 25 staff случаев, две вкладки, race, MFA и старые адресуемые карточки. [Account](account-browser.json) · [Staff](staff-browser.json) |
| `pnpm --filter @online-school/student-cabinet exec node --input-type=module` с `build({envDir:false,publicDir:false,logLevel:'error',build:{emptyOutDir:false}})` | 0 | Целевая сборка для локального student fixture. [Лог](student-build.log) |
| `pnpm --filter @online-school/student-cabinet exec playwright test --config D:/OnlineSchool/output/k8k-tasks/TASK-023/student-playwright.config.mjs --grep 'logout discards\|402 suspends\|legacy student notifications'` | 0 | 3 случая. Late draft, 402/403 и старый URL колокольчика. [Лог](student.log) · [Конфиг](student-playwright.config.mjs) |
| `pnpm k8k:shell:gate` | 0 | 40 ролевых и 8 login комбинаций, 50 PNG, 48 бюджетов. Ноль неожиданных запросов и ошибок страницы. [Лог](gate.log) · [Сценарии и хеши](browser.json) |

Первая матрица завершилась кодом 1 с двумя сбоями reflow, устранёнными в CSS. Финальный прогон прошёл оба случая и всю матрицу.

## Визуальная матрица и бюджеты

`/student`, `/teacher`, `/manager`, `/director`, `/operator`, `/` и `/account` на синтетических ответах. RU/RO на 360, 768, 1024 и 1280 px. Проверены локализованный chrome, Tab, Enter, Escape, skip link, возврат фокуса, безопасная зона 24 px через CDP и reflow в 320/384/512/640 CSS px. Для общего входа в каждой ширине применена геометрия клавиатуры 320 px и высота области 480 px. Это эмуляция геометрии и reflow. Браузерный zoom через UI браузера, физическая клавиатура устройства и AT требуют отдельной проверки. [Ученик RO 320](screenshots/student-ro-320-reflow.png) · [CRM RU 1024](screenshots/manager-ru-1024.png) · [Вход RO 360](screenshots/login-ro-360.png)

Все 48 маршрутов и дополнительное замыкание passkey укладываются в 256 000 байт. Максимум 255 848 байт у `/manager/students/:id?tab=payments`, запас 152 байта. Относительно TASK-004 на тех же seeds у этого маршрута +15 252 байта JS/CSS gzip и +3 544 байта румынского WOFF2, итого +18 796 байт. Для вкладки overview в данных отдельно выделены 13 223 байта добавленного lazy seed `BalanceSummary`. Бюджет v2 учитывает 63 492 байта всех трёх шрифтов в каждом маршруте. [Расчёт по маршрутам](budgets.json)

## Приёмка и открытые условия

| Критерий | Статус | Доказательство |
|---|---|---|
| Все пять ролей, RU/RO общего chrome, четыре ширины | PASS | 40/40 ролевых комбинаций и 8/8 входа на текущих сборках. |
| Keyboard, reflow, safe area и область экранной клавиатуры | PASS на эмуляции | Фокус и видимость, CSS reflow, CDP inset и geometry. |
| Поздний ответ отсечён | PASS | Реальный staff transport с удержанным ответом в двух вкладках, unit CRM и student late draft. |
| Сбой источника без искусственного нуля | PASS на fixtures | Отключённый слот, `null`, подтверждённый ноль и 503 с кэшем дают разные состояния. |
| Старые URL, SDK и серверные границы | PASS | Навигация, 140 сохранённых операций, побайтная генерация и адресные ACL/MFA тесты. |
| Рабочий critical producer и OPS-01/B | NOT_RUN | Требуется подтверждённый каталог, порядок primary и серверный сценарий эскалации в TASK-022/050. |
| Реальные устройства, полная WCAG-приёмка, рабочая БД, провайдеры и release/FND | NOT_RUN | Условия внешней приёмки остаются отдельными по Phase 0. |

Для TASK-024 переданы только проверенные пути, операции и границы. Точечный откат использует копию CSS и `package.json` в `before/`, удаляет новый runner и меняет только строки учёта TASK-023. [Передача TASK-024](handoff.md)
