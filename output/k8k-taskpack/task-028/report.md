# TASK-028

Статус DONE в локальном объёме задания от 07.11.2026.

Основа HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, ветка
`feat/k8k-design`. Исходное дерево содержит 390 status-записей, dirty digest
`0b76ee06d0e6d9e60b61599e12caadd94ae8f6eeba47de9c19a9c6a384a84d1f`.
32 исходных файла сохранены в before с SHA-256. Проверены наличие исходных путей
и неизменность 31 migration checksum. [Сохранность](../../k8k-tasks/TASK-028/preservation.json)

## Исходное поведение

DashboardService уже сохранял текущий SCHEDULED урок в 60-минутном окне.
В StudentHome существовали hero, CTA и server-clock countdown. List/detail
проверяли права собственного предмета. Обнаружены разные моменты проверки
назначения в этих проекциях, отсутствие status у hero и обнуление урока
интерцептором кэша на T0. Клиент сопоставлял status с отдельным upcoming-списком.
Исходники сохранены для адресного сравнения. [Проектирование до правок](../../k8k-tasks/TASK-028/design-note.md) ·
[Матрица проекций](../../k8k-tasks/TASK-028/predicate-matrix.md)

## Изменения

- `apps/api/src/student/lessons/meet-access.ts` задаёт общие SQL и проекцию.
  Требуются SCHEDULED, собственный enrollment, действующие на слот и снимок
  назначение и enrollment, активные teacher/subject, оплаченные доступные права
  либо собственный действующий лимит директора и отсутствие заморозки.
  Частичная оплата самостоятельно доступ не открывает.
- `dashboard.service.ts` выбирает текущий разрешённый урок в окне,
  иначе ближайший будущий по scheduled_at/id. List/calendar/detail используют
  ту же проверку. Canonical URL возвращается только с положительным canJoin
  от T−600000 до T+3600000 мс включительно.
- `dashboard-cache.interceptor.ts` хранит только сводку без nextLesson.
  Cache hit и concurrent waiter заново читают урок и проверяют revision.
  TTL сводки 30 секунд, HTTP no-store. T0 сохраняет текущий урок.
- DTO/SDK добавляют optional status и meetAsOf для NextLessonDto,
  optional meetAsOf для LessonCardDto. generatedAt отражает сводку,
  meetAsOf отражает отдельное чтение урока.
- `api.ts`, `meet-scope.tsx`, `student-presentation.ts` и `components.tsx`
  привязывают решение к снимку и монотонному времени запроса. Закрытие учитывает
  время начала запроса консервативно. На T−10 выполняется GET через существующий
  refresh owner. Отрицательный canJoin по таймеру положительным не становится.
  Hidden/offline, stale, refetch и 403 скрывают переход. Click повторно проверяет
  окно, свежесть и видимость. Старые DTO без метаданных ожидают актуального чтения.
- `StudentHome.tsx` использует status своего dashboard, показывает «Урок начался»
  и RO-эквивалент, сохраняет один главный CTA. Calendar/detail получили
  локализованные подписи, даты в таймзоне пользователя и доступные размеры CTA.
  `Dashboard.tsx` сохраняет legacy-путь с общей проверкой.

## Контракты и источники

Штатная генерация OpenAPI → Orval → SDK выполнилась с отключённым DB lifecycle
экспорта через уже существующий локальный no-db preload TASK-018. Семантическая
проверка обнаружила ровно три additive properties, 146 операций до и после.
Новые зависимости и миграции отсутствуют. [Контракт](../../k8k-tasks/TASK-028/contracts.json) ·
[Генерация](../../k8k-tasks/TASK-028/generate.log)

Применены TASK-028 §§3/5/6, VIS-12 STU-01/STU-03 и V12-AT-03/10/11,
K8K design §5.2 DASH-STU-01, CON-02/B и REL-01/A. Последние owner decisions
и PHASE0_CHECKS определяют scope и безопасные mock targets. Предметные правила
опираются на существующий ledger и admission. Бизнес-решений сверх задания
для реализации не потребовалось.

## Свежие проверки

Точные команды, stdin безопасной Vite-сборки и параметры no-db экспорта
сохранены в [verification.json](../../k8k-tasks/TASK-028/verification.json).

| Команда | Exit | Доказательство |
| --- | --- | --- |
| `pnpm --filter @online-school/api typecheck` | 0 | [API build](../../k8k-tasks/TASK-028/api-build.log) |
| `pnpm --filter @online-school/api export:openapi` с no-db preload, затем `pnpm --filter @online-school/api-contracts generate:client` и `typecheck` | 0 | [Генерация](../../k8k-tasks/TASK-028/generate.log) |
| `pnpm test:stu02 --roots tests` | 0 | 38 tests, [dashboard](../../k8k-tasks/TASK-028/dashboard.log) |
| `pnpm test:stu03 --roots tests` | 0 | 76 tests, [lessons](../../k8k-tasks/TASK-028/lessons.log) |
| `pnpm --filter @online-school/student-cabinet test:presentation` | 0 | 11 tests, [presentation](../../k8k-tasks/TASK-028/presentation.log) |
| `pnpm --filter @online-school/student-cabinet typecheck` и Vite API build с envDir=false/publicDir=false | 0 | [Student build](../../k8k-tasks/TASK-028/student-check.log) |
| `pnpm --filter @online-school/student-cabinet lint` | 0 | [Student lint](../../k8k-tasks/TASK-028/student-lint.log) |
| Адресный `pnpm exec eslint` для шести изменённых API sources и трёх test files | 0 | [API lint](../../k8k-tasks/TASK-028/api-lint.log) |
| `pnpm --filter @online-school/student-cabinet test:meet-eligibility` | 0 | 6 Chromium-сценариев, [лог](../../k8k-tasks/TASK-028/browser-final.log), [JSON](../../k8k-tasks/TASK-028/playwright.json) |
| `node scripts/k8k-refresh-budget.mjs --task-028` | 0 | 50/50 маршрутов, [бюджеты](../../k8k-tasks/TASK-028/budgets.json) |

Vite build использовал сохранённый проектный конфиг, envDir=false,
publicDir=false и emptyOutDir=false. Бюджетный source build использовал
envDir=false/configFile=false/publicDir=false/write=false. Student route
232764 байта по методу v2 с тремя subsets локального Golos. Максимум среди
50 маршрутов 255923 при лимите 256000 байт. Общую регрессию фазы эти проверки
не заменяют.

Точные boundary cases проверяются fake time с T−10−1ms, T−10, T0,
T+60 и T+60+1ms. HTTP использует настоящий Nest routing и mock Prisma,
две cookie-сессии, own/foreign, no-store, тёплый кэш без revision bump,
отозванные права, cancelled и auth denial. SQL predicates проверены по
сформированным параметризованным запросам. Выполнение этих запросов
в PostgreSQL имеет отдельный статус NOT_RUN.

Первые локальные прогоны выявили неправильную Playwright fixture-сигнатуру
нового теста и неявные browser globals для ESLint. Они исправлены, финальные
прогоны завершились успешно. После проверки часов добавлена монотонная
проверка возраста снимка и обязательное чтение после скрытой вкладки.

## Визуальные доказательства

Роль student, локальный сервер 127.0.0.1, собственный синтетический lesson fixture,
100-символьные имена ученика и преподавателя. RU/RO × 360/768/1024/1280
для `/student`, `/student/lessons?view=calendar&month=2026-11` и
`/student/lessons/{lessonId}`. 24 матричных снимка и четыре состояния
no-link/invalid-link/stale/forbidden находятся в after. Проверены Tab/Shift+Tab,
focus, высота главного действия от 48px и отсутствие горизонтального overflow.

[RU hero 360](../../k8k-tasks/TASK-028/after/ru-360-hero.png) ·
[RO detail 360](../../k8k-tasks/TASK-028/after/ro-360-detail.png) ·
[RU calendar 1280](../../k8k-tasks/TASK-028/after/ru-1280-calendar.png) ·
[RO invalid](../../k8k-tasks/TASK-028/after/ro-1280-invalid-link.png) ·
[Stale](../../k8k-tasks/TASK-028/after/ru-1280-stale.png) ·
[Forbidden](../../k8k-tasks/TASK-028/after/ru-1280-forbidden.png)

## Acceptance checklist

| Критерий | Результат и основание |
| --- | --- |
| Hero независим от upcoming и сохраняется на T0 | PASS, HTTP/unit, browser с противоречащим upcoming status |
| Dashboard/list/detail используют общее окно и права | PASS для mock-проекций и SQL predicates |
| Кэш и часы не выдают capability за границей | PASS, cache, exact ms и fake-clock Chromium |
| Stale/terminal/denied/no-link скрывают переход с пояснением | PASS, presentation и Chromium |
| Исходный current-lesson fix и session/CSRF сохранены | PASS, исходные snapshots, scoped auth/command regression |
| Собственные права двух предметов и отдельный director limit | PASS для SQL predicates и mock-ответов |
| GET и keyboard click не подтверждают урок и не меняют деньги | PASS, read-only SQL и browser network audit |
| RU/RO, четыре ширины, keyboard, long text | PASS, 24 матричных screenshots |
| SDK совместим, source/status актуализированы | PASS, три optional поля и 146 операций |
| Исходные пути и migration checksums сохранены | PASS, preservation.json |
| Рабочая БД и реальный Google Meet | NOT_RUN, вне разрешённого локального target |
| Expanded Meet POC/OAuth/security/G4 и FND-GATE | NOT_RUN, требуются отдельные разрешённые условия приёмки |

Полный машинный перечень со ссылками хранится в
[acceptance.json](acceptance.json).

## Остатки и обратимость

TASK-029 получает расписание, историю/спор и локализацию существующей формы
переноса. TASK-035 получает сквозной ролевой gate. Готовность Google Meet
требует отдельных OAuth/POC/provider/security/G4 доказательств. Существующая
постоянная тестовая ссылка использовалась только в изолированном fixture,
её открытие перехвачено локальным Playwright response.

Откат ограничивается изменениями TASK-028 относительно before, с сохранением
исходного dirty дерева. Optional SDK поля допускают поэтапный rollout,
клиент старого снимка безопасно запрашивает актуальные данные.
[Передача](../../k8k-tasks/TASK-028/handoff.md)
