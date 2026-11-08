# TASK-027 — назначенный менеджер и официальные контакты

**Статус — DONE в объёме TASK-027.**

## Основа

Ветка `feat/k8k-design`, HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`. SHA-256 исходного git status `55728feec25549909d78265aa11e371af622d5bc5066b96e63233969d4fdcc0a`. Сохранены 368 исходных записей, проверены 39 входных копий и хеши 30 существующих миграций. Lockfile совпадает с исходным. [Снимок](status-before.txt) · [Хеши](before.json) · [Сохранение](preservation.json)

Назначение, проверка роли и официальные WhatsApp/Telegram уже работали в `/me`. TASK-025 добавил помощь и карточку, TASK-026 связал с ней детали абонемента. В двух повторных проверках доступа к уроку и файлу сохранялись общие контакты из окружения. Имени и отдельного телефонного поля в проекции не было. Результаты предыдущих задач использованы как входные артефакты. [TASK-026](../TASK-026/report.md)

## Изменения

| Путь | Поведение |
|---|---|
| `apps/api/src/student/manager-contacts.ts` | Один параметризованный запрос выбирает актуальное назначение ученика и проверяет staff/login и период роли. Имя приходит из действующего staff-профиля. Отсутствующий или недопустимый контакт не подменяется общим. |
| `apps/api/src/student/me/me.service.ts`, `active-subscription.guard.ts` и проверки доступа перед защищёнными действиями | `/me` и 402 используют один снимок. До первоначальной смены пароля чтение контакта пропускается. Общие env-каналы удалены из двух повторных проверок. |
| `apps/api/src/core/errors/error-mapper.ts`, `manager-contacts.ts` и `packages/api-contracts/src/transport.ts` | Problem Details для 402 допускает только официальные каналы и имя. SDK переносит два новых опциональных поля, прежняя структура совместима. |
| `packages/db/prisma/schema.prisma` и новая миграция | Добавлено nullable `student_phone_e164` с проверкой E.164. Личный телефон остаётся PII. Для новой колонки нет backfill и новых прав записи. |
| `apps/student-cabinet/src/student-widgets.tsx`, `Layout.tsx`, `pages/Account.tsx`, `pages/Subjects.tsx`, `pages/StudentHome.tsx` | Одна карточка показывает инициалы, имя и доступные ссылки. Пустые и некорректные значения не образуют href. После ошибки обновления прежние контакты скрыты. Используется один `/me` на каждый отдельно открытый экран. |
| `apps/student-cabinet/src/api.ts`, `packages/ui/src/navigation.ts` | Контакты перевычитываются при возвращении вкладки и по существующему интервалу. Алиасы навигации ученика вынесены в отдельный helper, чтобы увеличение общего SDK не вывело маршрут менеджера за бюджет. Поведение меню сохранено. |

Применены TASK-027 ``3, 5–10, VIS-12 STU-07 и `6, `5.2 DASH-STU-07, уточнение MGR-03 от 31.10.2026 и решение о смене сессии от 01.11.2026. Разрешённые формы урока остаются в карточке урока. Контактный переход не создаёт внутреннего обращения. [Проектирование](design-note.md) · [Передача](handoff.md)

## Контракты и миграции

`ManagerContactsDto` сохраняет `whatsapp` и `telegram` и добавляет optional nullable `displayName` и `phoneE164`. Все 146 операций OpenAPI и их пути совпадают с входными. Prisma, OpenAPI и Orval прошли штатную генерацию. Новая миграция подготовлена отдельно. До выпуска необходимо штатное применение миграции владельцем рабочей среды. Кнопка звонка требует явно заведённого официального номера. [OpenAPI diff](contracts.json) · [Миграция](../../../packages/db/prisma/migrations/20261107120000_k8k_student_manager_phone/migration.sql)

## Свежие проверки

| Команда | Код | Результат |
|---|---:|---|
| `pnpm --filter @online-school/db db:validate` и `pnpm --filter @online-school/db generate` | 0 | Prisma 7.10.1, локальная валидация и генерация. DOTENV_CONFIG_PATH указывал на отсутствующий файл. DIRECT_URL указывал на loopback-порт 1. [Лог](prisma.log) |
| `pnpm --filter @online-school/api typecheck` | 0 | [Лог](api-build.log) |
| `pnpm --filter @online-school/api export:openapi` с no-DB preload TASK-018, затем `pnpm --filter @online-school/api-contracts generate:client` и `typecheck` | 0 | 146 операций, только два дополнительных поля. [Лог](generate.log) |
| `pnpm test:k8k-student-contacts` | 0 | 9 адресных unit/HTTP/transport тестов. [Лог](contacts-http.log) |
| `pnpm test:stu11 --roots tests` и `pnpm test:stu01 --roots tests` | 0 | 73 и 35 тестов, включая действующие guards и transport. [STU-11](stu11.log) · [STU-01](stu01.log) |
| `pnpm --filter @online-school/student-cabinet typecheck` и `lint` | 0 | [Типы](typecheck.log) · [Lint](lint.log) |
| `pnpm exec eslint` для изменённых модулей API, SDK и тестов с `--max-warnings 0`, `pnpm exec stylelint apps/student-cabinet/src/student.css --ignore-disables` | 0 | [ESLint](api-lint.log) · [Stylelint](stylelint.log) |
| Vite `build({envDir:false, publicDir:false, logLevel:'error', build:{emptyOutDir:false}})` через `pnpm --filter @online-school/student-cabinet exec node --input-type=module` | 0 | Локальная сборка кабинета. [Лог](build.log) |
| `pnpm --filter @online-school/student-cabinet test:manager-contacts` | 0 | 6 сценариев Chromium. 24 кадра и 6 axe-проверок на 360 px. [Лог](playwright.log) |
| `pnpm --filter @online-school/student-cabinet exec playwright test --config playwright.manager-contacts.config.mjs subject-hub.spec.mjs --grep "six menu destinations"` | 0 | 2 регрессии шести пунктов и active. [Лог](navigation-regression.log) |
| `pnpm --filter @online-school/student-cabinet exec playwright test --config playwright.manager-contacts.config.mjs student.spec.mjs --grep "402 suspends"` | 0 | 1 регрессия legacy 402 и первоначальной смены пароля. [Лог](legacy-suspension.log) |
| `node scripts/k8k-refresh-budget.mjs --task-027` | 0 | 50/50, бюджет включает шрифты. Студенческие маршруты 232 104 байта, максимум пакета 255 923 байта. [Замеры](budgets.json) |

## Визуальные доказательства

STUDENT, локальный HTTP fixture `127.0.0.1:4175`, RU/RO, ширины 360/768/1024/1280. На каждом маршруте имя менеджера из 100 символов. На 360 px проверены Tab и фокус, отсутствие горизонтального overflow и высота ссылок не меньше 44 px.

| Поверхность | Примеры |
|---|---|
| Главная | [RU 1280](after/ru-1280-dashboard.png) · [RO 360](after/ro-360-dashboard.png) |
| Помощь | [RU 360](after/ru-360-help.png) · [RO 768](after/ro-768-help.png) |
| Приостановка | [RU 1024](after/ru-1024-suspended.png) · [RO 360](after/ro-360-suspended.png) |
| Состояния | [Менеджер не назначен](states/ru-no-manager.png) · [Ошибка обновления](states/ro-refresh-error.png) |

## Приёмка

| Критерий | Статус | Доказательство |
|---|---|---|
| Две сессии видят только своё назначение | PASS | Два HTTP cookie и подставленный чужой `studentId` в query. |
| Окончание назначения, disabled login, деактивация и роль | PASS на mock | Предикаты SQL и адресные сценарии. Директорское назначение проверено на второй сессии. |
| Официальный телефон, отсутствие private phone | PASS | Сериализация двух DTO, отсутствие личного номера в JSON и UI, корректный `tel:+…`. |
| Разрешённые каналы, пустые и недопустимые значения | PASS | HTTPS wa.me/t.me, E.164, проверки чужого домена, HTTP и javascript. Нейтральная карточка без контактов. |
| Одна проекция на трёх экранах, RU/RO и клавиатура | PASS | Матрица, один bootstrap GET на отдельно открытый экран, видимый фокус и отсутствие фото. |
| Смена назначения, stale и смена пользователя | PASS | Refetch заменяет карточку, 503 скрывает прежние ссылки. Demo switch во второй вкладке отбрасывает задержанный ответ прежнего `/me`. |
| 401/402 и первоначальный пароль | PASS | Проверки HTTP и Chromium. Scope bootstrap сохранён. |
| Рабочая миграция, настройка канала, провайдеры и ролевой gate | NOT_RUN | Миграция подготовлена. Рабочий PostgreSQL, реальные каналы и deployment не использовались. |

[Машиночитаемая приёмка](../../k8k-taskpack/task-027/acceptance.json)

## Передача и обратимость

TASK-035 получает ролевую приёмку, TASK-067 получает сценарий синхронной смены сессии, TASK-075 получает порядок rollout. Разрешённое заполнение официальных номеров относится к отдельной staff/config работе. До настройки номер остаётся `null`. [Передача](handoff.md)

Для отката вернуть изменения по `before/`, снять добавленные файлы TASK-027 и воспроизвести прежние сгенерированные контракты штатно. Подготовленная миграция в этой задаче не применялась. Существующие миграции, рабочая БД и production сохранены.
