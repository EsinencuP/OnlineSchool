# TASK-019 — смена сессии и очистка приватных данных

**Статус — DONE в объёме TASK-019.** Проверено 7 ноября 2026 года.

**Основа.** `feat/k8k-design`, HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, dirty digest `2d7490b0afe2b2f3a03a5e251eb45589796d583bf1c8d7aeff8d270998a9c768`. Дайджест включает scoped binary diff и SHA-256 20 файлов исходников и тестов, включая новый файл. Отчёт, журналы и результаты измерений исключены из дайджеста. Независимые правки AGENTS, student dashboard, его unit-теста и старых артефактов `output/stu12` сохранены. [Основа и хэши](basis.json)

## Исходное поведение

Manager Web отменял часть запросов и очищал QueryClient. Student Cabinet обрабатывал ограничение подписки и принудительную смену пароля. Staff workspace хранил данные в локальном состоянии. AccountMenu сообщал о смене вкладкам, пока оставался смонтирован. TASK-018 уже дал серверный `actorContext.accountId` и роль. Базовый аудит K8K-DEF-074 зафиксировал пароль и OTP в переменных студенческих мутаций. [TASK-018](../TASK-018/report.md) · [K8K-DEF-074](../TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/defects.md)

## Изменения и контракты

- `account-ui` отзывает поколение через `sessionSignal()` и `clearPrivateSession()`. `SessionExitBoundary` удаляет приватное дерево, затем запускает `location.replace`. Перед навигацией подписчики отменяют чтения и очищают кэши. `school-account` передаёт событие `session-replaced`, а fallback использует одноразовый маркер. При восстановлении из BFCache документ загружается заново. [Граница сессии](../../../packages/account-ui/src/session.tsx)
- AccountMenu сохраняет существующие home URL, добавляет необязательный `logoutPath` и допускает одну команду за раз. При неопределённом switch/logout экран показывает RU/RO сообщение и ссылку на `/`, где общий вход заново запрашивает текущую сессию. Явное отклонение остаётся в текущем кабинете. [AccountMenu](../../../packages/account-ui/src/index.tsx) · [Design note](design-note.md)
- Manager Web и Student Cabinet проверяют поколение перед разбором успешного ответа, 401 и CSRF-ответа. 401 отозванной сессии закрывает документ. 403 удаляет данные конкретного запроса, а отказ на `/me` скрывает весь кабинет и очищает зависимые кэши. Переход 403 → 503 оставляет запрещённый объект скрытым. [Manager client](../../../apps/manager-web/src/api/client.ts) · [Student client](../../../apps/student-cabinet/src/api.ts)
- Platform сверяет `actorContext.accountId` и роль с текущей сессией. Operator проверяет текущий контекст перед health API. Незавершённая MFA закрывает staff bootstrap, при этом действует явное серверное `password_only`. [Platform](../../../apps/platform/src/App.tsx)
- Student Cabinet сохраняет сериализацию и idempotency черновика. Отложенные draft/upload/submit привязаны к исходному поколению. Вход, смена пароля и email OTP выполняются из формы через прежний `write()` вне MutationCache. После смены пароля, которая отзывает прежние сессии, другие вкладки повторно читают сессию. [Homework](../../../apps/student-cabinet/src/pages/Homework.tsx) · [Account](../../../apps/student-cabinet/src/pages/Account.tsx)

DTO, OpenAPI, SDK, wire codes, схема, зависимости и серверные guards остались прежними. Сохранены `no-store`, CSRF, idempotency и серверный fixed demo catalog. При уже принятой команде отмена клиентского запроса отзывает только её локальный результат. Приоритет определяют TASK-019 §§5–10, TECH-13/14 и утверждённая схема смены аккаунта от 01.11.2026. [Задание](../../../docs/k8k-redesign-tasks/TASK-019.md) · [Смена аккаунта](../../../docs/platform_account_switching_2026_11_01.md)

## Свежие проверки

| Команда | Exit | Результат |
| --- | ---: | --- |
| `pnpm --filter @online-school/account-ui build` | 0 | TypeScript и декларации общего пакета. [Лог](build.log) |
| `pnpm --filter @online-school/manager-web --filter @online-school/platform --filter @online-school/student-cabinet typecheck` | 0 | Все три потребителя. [Лог](typecheck-final.log) |
| `pnpm --filter @online-school/platform test:account-chrome` | 0 | 19 сценариев. Две вкладки с реальным staff UI, поздние ответы, focus/online, один switch и logout, MFA и password-only. [Лог](account-browser-verified.log) · [Данные](account-browser.json) |
| `pnpm --filter @online-school/platform test:staff-context` | 0 | 20 сценариев, в том числе cached 403 и staff scope. [Лог](staff-browser.log) · [Данные](staff-browser.json) |
| `pnpm --filter @online-school/manager-web exec vitest run src/test/session.test.tsx src/test/error-policy.test.tsx --pool=threads --maxWorkers=1 --no-file-parallelism` | 0 | 11 тестов. Оба кэша после 401, поздний ответ и поздний 401, cached 403 → 503, credential exceptions, idempotency. [Лог](manager-unit-final.log) |
| `node --experimental-vm-modules node_modules/jest/bin/jest.js --runTestsByPath tests/unit/manager-http.test.mjs tests/unit/manager-payments-http.test.mjs --roots tests --runInBand -t 'requires MFA even\|MFA, revoked'` | 0 | Два теста Nest HTTP с подменённой БД. `MFA_REQUIRED` на director confirm с валидными cookie и CSRF. После MFA подтверждение с тем же ключом проходит. [Лог](mfa-http.log) |
| `pnpm --filter @online-school/student-cabinet exec node --input-type=module` с `build({envDir:false,build:{emptyOutDir:false},logLevel:'error'})` | 0 | Целевая Vite-сборка для локальной фикстуры. [Лог](student-bundle.log) |
| `pnpm --filter @online-school/student-cabinet exec playwright test --config D:/OnlineSchool/output/k8k-tasks/TASK-019/student-playwright.config.mjs --grep 'logout discards\|serialized slow draft\|402 suspends\|login → forced\|email security'` | 0 | Пять сценариев. Очередь черновиков, CSRF/OTP, вход и пароль, 402, загрузка через перехват presigned URL. Снимки и трассировка форм отключены. [Лог](student-browser.log) · [Конфиг](student-playwright.config.mjs) |
| `pnpm exec eslint --max-warnings 0` и `pnpm exec prettier --check` для изменённых исходников, тестов и локальных runner-файлов | 0 | [ESLint](lint-final.log) · [Prettier](format-final.log) |
| `pnpm --filter @online-school/ui lint:css` | 0 | 17 файлов, 715 известных legacy-деклараций, расхождений нет. [Лог](css-lint.log) |
| `node output/k8k-tasks/TASK-019/budget.mjs` | 0 | 48/48 маршрутов, максимум 255 344 из 256 000 байт, включая 63 492 байта локальных шрифтов. Дополнительное замыкание passkey 196 817 байт. [Данные](budgets.json) · [Лог](budget.log) |

Двухвкладочный тест сначала принимает навигацию ответом 204, чтобы сохранить проверяемый документ. Затем он пропускает задержанные ответы, транспорт которых игнорирует abort, и проверяет приватный DOM и число запросов. Финальная загрузка использует уже запрошенные URL. Отдельный сценарий проверяет обычную навигацию с ответом 200. Предварительный harness с удержанием навигации не давал Chromium выполнить проверку старого документа. Финальный прогон использует 204. Первичный запуск Vitest упёрся в запуск worker, адресный прогон с одним worker завершился успешно.

## Визуальные доказательства

Неопределённый результат переключения из студенческой оболочки на `/fixture?ui.k8k=1&role=STUDENT&section=homework`. Локальная фикстура общего AppShell и AccountMenu. RU и RO, ширины 360, 768, 1024 и 1280 px. Снимки показывают фокус после клавиатурного запуска. Браузерная проверка подтверждает отсутствие горизонтального overflow, приватной формы и повторной команды. [8 PNG](screenshots/) · [RO 360](screenshots/session-verify-ro-360.png) · [RU 1280](screenshots/session-verify-ru-1280.png)

## Приёмка

| Сценарий | Статус | Свидетельство |
| --- | --- | --- |
| Late response после logout | PASS | Старый workspace-ответ доставлен в обе вкладки после завершения, приватный DOM не возвращается. Студенческий queued draft не отправлен. |
| Teacher A → B | PASS | После очистки и свежего bootstrap обе вкладки показывают класс B. Старый ответ A доставлен в прежний документ и отброшен. |
| Вторая вкладка теряет private | PASS | DOM обеих вкладок пуст до нового документа. События focus и online не запускают чтения прежнего поколения. |
| Cached 403 не видно | PASS | Staff sample/count исчезают. Manager cache не возвращает прежний объект и после следующего 503. |
| MFA-required не даёт Finance | PASS | Директор без MFA не монтирует workspace. Реальный Finance guard на локальном Nest fixture возвращает `MFA_REQUIRED`. |
| Navigation не дублирует write | PASS | Одна команда на switch и logout, подтверждённые CSRF. Неопределённый switch оставляет только сверку сессии. |

## Границы проверки и передача

Локальные Chromium и HTTP fixtures. BFCache и fallback транспорта без BroadcastChannel покрыты кодом, отдельный кроссбраузерный прогон этих веток не выполнялся. Рабочая БД, реальные провайдеры, production, полный ролевой и release/FND прогоны не использовались. Прямой Finance guard проверен на существующей серверной сборке и замоканном DatabaseService.

TASK-020 получает корневой `SessionExitBoundary`, `sessionSignal()` для staff reads, `actorContext.accountId` и `leaveSession(path)` для полного перехода при смене actor. TASK-034 и TASK-066 используют существующие student account операции и локальный секретный command path. Сквозная роль/локаль и реальные устройства относятся к TASK-067. [Журнал](../../../docs/k8k-redesign-tasks/EXECUTION_LOG.md) · [Матрица](../../../docs/K8K_REQUIREMENTS_MATRIX.md)

Откат ограничен файлами из [basis.json](basis.json) и строками учёта этого инкремента. Применённых миграций и внешних эффектов для отката нет.
