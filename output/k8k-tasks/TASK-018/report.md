# TASK-018 — Staff actor context и action eligibility

Статус: **DONE в объёме TASK-018**, 04.11.2026.

Основа: HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design`,
dirty digest `3ff74dab64bfca9fc63a877c571c8df4a02ed30b51ff66eadceb74ba04ba8a0f`.
[539 исходных хешей и определение digest](basis.json), [сохранение основы](preservation.json),
[исходный status](status-before.txt). Из 224 входов TASK-017 сохранены 216; остальные
восемь — намеренные изменения manifests, generated contracts и consumers. UI-kit не изменён.
Пользовательский dirty student dashboard побайтно совпадает с сохранённой до foundation
копией. Ветка, архивы и прочие изменения сохранены; commit/push/deploy не выполнялись.

## Что уже существовало

- Core AccountContext содержит auth account identity, серверную роль/MFA/session context.
  TeacherAccount.id и StaffAccount.id — отдельные profile identities.
- Workspace уже фильтровал TEACHER по собственному teacher profile; DIRECTOR читал school scope.
  Списки были ограничены 100/50 строками без coverage, total и признака усечения.
- ManagerScope проверяет активный собственный staff profile и временный portfolio assignment.
  ManagerPaymentWorkflow передаёт поступление директору; Finance подтверждает его отдельно.
- Start/outcome, FinanceAccess, idempotency/CSRF/transaction guards и server-only admission
  уже существовали. Их бизнес-правила и денежные формулы сохранены.
- Prerequisite TASK-017 имеет реальный [отчёт](../TASK-017/report.md) и verification artifact.
  Исторические UI test counts не обозначены свежими проверками TASK-018.

## Что изменено

`apps/api/src/core/actor/` добавляет StaffActorContextService, DTO и projection helper.
Контекст получается по session accountId, активному account и собственному profile.
Teacher имеет teacherProfileId и staffProfileId=null; director/manager/operator получают
staffProfileId и teacherProfileId=null. Чужой profile нельзя выбрать query-параметром.

Actor context содержит timezone, явный timezoneSource, asOf по DB clock и nullable
accountUpdatedAt/profileUpdatedAt. В текущей схеме staff timezone берётся из существующей
SCHOOL_TIMEZONE либо установленного школьного default Europe/Chisinau; эти источники
различаются. Нового per-user timezone поля БД не выдумано. AsOf не является ledger fact,
receivedAt остаётся клиентским временем получения.

Eligibility содержит action, objectId, revision, allowed, reason, asOf, sourceUpdatedAt.
Revision=null: три существующие команды не принимают optimistic revision precondition.
Updated_at остаётся source timestamp. Недоступный/чужой объект не получает ID, revision
или source timestamp в neutral projection. Ошибки инфраструктуры остаются ошибками.

| Новый GET operation | Действующая команда / источник решения |
|---|---|
| getStaffActorContext — `/api/v1/platform/actor-context` | Own teacher/director/operator; manager получает context в getManagerMe с сохранением scoped password-only exception |
| getTeacherLessonStartEligibility — `/api/v1/platform/lessons/{id}/start-eligibility` | `startLesson`, общий OutcomesService.startPolicy: own teacher, окно старта, состояние enrollment, server admission |
| getManagerPaymentApprovalEligibility — `/api/v1/manager/payments/{paymentId}/approval-eligibility` | `confirmManagerPayment`, action `payment.request-approval`; ManagerScope → manager-finance.facade → ManagerPaymentWorkflow → прежняя publication policy |
| getDirectorPaymentConfirmationEligibility — `/api/v1/platform/payments/{id}/confirm-eligibility` | `confirmPayment`, action `payment.confirm`; FinanceAccess, receipt state и открытый financial period |

Eligibility — предварительное чтение. Команды повторяют те же проверки внутри своих
транзакций; существующие row locks и idempotency сохраняются. Read path использует
REPEATABLE READ, READ ONLY; проверка financial period при чтении не берёт FOR UPDATE.
В command path блокировка периода сохраняется. Проверка уже подтверждённого поступления
сохранила прежний error code.

ManagerMeResponseDto получил actorContext и отдельную PAYMENTS_REQUEST_APPROVAL capability,
выведенную из того же actor predicate, что использует managerPaymentPublication.
PAYMENTS_CONFIRM остаётся enum member для совместимости, менеджеру она не выдаётся.
APPROVAL_REQUIRED означает возможность передать вопрос директору, а не право подтверждения.
Отказы нового actor read не превращаются в успешный/устаревший контекст.

PlatformWorkspaceService сохраняет прежние arrays/поля и добавляет actorContext/coverage.
Используются стабильный порядок и limit+1 probe. PageInfo содержит limit, returned,
hasMore, total=null. Coverage обозначает OWN_TEACHER/SCHOOL/NOT_APPLICABLE, окно и
nullable timestamp корневых возвращённых записей; это не глобальный watermark/KPI.
Полноценная пагинация и предметные views остаются в ролевых TASK.

Platform App использует сгенерированный PlatformWorkspaceDto вместо локальной копии.
StaffCoverageNote обозначает загруженную выборку, неизвестный total и усечение на RU/RO.
Общая подпись связана с группой чисел через aria-describedby; отдельные списки также
поясняют coverage. Новый текст имеет 14px и семантический цвет из tokens. Время,
timezone и snapshot count используют серверный контекст. Freshness отдельно показывает
server asOf и client receivedAt. При отсутствующем контексте время/счётчик не выдумываются.

## Контракты, SDK, источники

[Design note до реализации](design-note.md), [сравнение OpenAPI](contracts-diff.json).
Пять DTO добавлены; actorContext/coverage и capability расширяют существующие ответы.
140 прежних operation IDs/paths/methods, request body и parameter metadata сохранены.
Всего стало 144 operations. Старые response properties не удалены.

Выполнены штатные api export:openapi → contracts generate:client → contracts build.
Generated файлы вручную не правились. Экспорт запущен с preload
[no-db-export.mjs](no-db-export.mjs), который запрещает доступ к DatabaseService.client;
app.init/listen для экспорта не вызываются. Схема Prisma и миграции не менялись и не применялись.
Generator добавил CONFIGURATION_INVALID в каталог ошибок: 243→244. Существующий display
adapter использует безопасный локализованный fallback для неизвестного кода/503.

Применены TASK-018 §§3/5–10, TECH-13/B, TECH-14/B, TECH-16/B, VIS-03…12,
актуальные AGENTS/PHASE0_CHECKS, CON addendum и payment decisions 31.10.
Manager approval-request и director confirmation различаются согласно последним решениям.
Использованы webdev-api-data, frontend-craft и React review. API metadata сверены с
установленным Swagger12 и [официальной документацией](https://github.com/nestjs/swagger/blob/master/_autodocs/api-reference/api-response-decorator.md).

## Свежие проверки

| Команда | Exit | Результат / артефакт |
|---|---:|---|
| `pnpm --filter @online-school/api build` | 0 | [API build](api-build-final.log) |
| `pnpm test:k8k-staff-context` | 0 | **16 tests**: 12 service/HTTP +4 SDK/schema. [Лог](staff-tests-final.log) |
| Scoped Jest: manager-scope, manager-http, manager-payments, manager-payments-http, `--roots tests --runInBand` | 0 | **92 tests**, реальный SessionStore в существующих HTTP suites, mocked persistence; guards/CSRF/idempotency/finance compatibility. [Лог](existing-targeted-final.log), точная команда в commands.json |
| `pnpm --filter @online-school/api export:openapi` | 0 | [144 operations, DB access denied preload](openapi-export-final.log) |
| `pnpm --filter @online-school/api-contracts generate:client` | 0 | [Штатный Orval/publish/generate](sdk-generate-final.log) |
| `pnpm --filter @online-school/api-contracts build` | 0 | [Generated types/SDK compilation](contracts-build-final.log) |
| `node output/k8k-tasks/TASK-018/contracts-evidence.mjs` | 0 | [Совместимость](contracts-evidence.log), старые inputs сохранены |
| `pnpm --filter @online-school/student-cabinet --filter @online-school/manager-web --filter @online-school/platform typecheck` | 0 | [Все три consumers после generation](consumers-typecheck-final.log) |
| `pnpm --filter @online-school/platform typecheck` | 0 | [Дополнительная проверка изменённого consumer](platform-typecheck-final.log) |
| Scoped ESLint API/consumer/tests, Stylelint нового CSS, Prettier | 0 после исправлений | [API](lint-final.log), [frontend](frontend-lint-final.log), [SDK test](sdk-test-lint.log), [CSS](css-lint.log), [формат](format-check-final.log) |
| `pnpm --filter @online-school/platform test:staff-context` | 0 | **20 cases /16 PNG**, RU/RO×4, loading/ready/cached403, длинная подпись, focus, неверные часы клиента и timezone Asia/Tokyo. [Лог](browser-final.log), [JSON/budget](browser/browser.json) |
| `pnpm --filter @online-school/platform test:account-chrome` | 0 | **15 regression cases**, menu/switch/logout/drafts и две вкладки; старый mock workspace без новых полей безопасно обрабатывается. [Лог](account-regression.log) |
| `git diff --check -- …` | 0 | [Адресный tracked diff](diff-check.log) |

Все тесты используют in-memory Prisma/principal stubs либо полностью перехваченные
HTTP/SDK/browser запросы. Новые principal HTTP tests не заменяют проверку реальной
session persistence; прежние manager HTTP suites с SessionStore выполнены отдельно.
Browser unexpected requests и JS errors отсутствуют. Новый script заранее внесён в manifest.
Полные команды/targets: [commands.json](commands.json).

Первый lint указал на прямой manager controller → finance workflow import и недопустимый
throw в helper. Исправлены facade boundary и существующий Promise.reject pattern,
правила не отключались. Typecheck выявил exactOptionalPropertyTypes для optional props;
nullable/undefined контракты уточнены. Ранний browser assertion ожидал другое существующее
написание RU строки; оно сверено со словарём. Prettier warnings исправлены адресно.

## Визуальные доказательства и бюджет

Реальный App на `/teacher?ui.k8k=1` и `/director?ui.k8k=1`, synthetic session/workspace,
RU/RO, 360/768/1024/1280. Клиентский Date.now установлен в 2027, server asOf — 04.11.2026;
snapshot count остаётся100, урок12:30Z показан как21:30 Asia/Tokyo. Все четыре локальных
состояния cached403 скрывают прежние строки и количества. Просмотрены RO360 и RU1280;
пояснения переносятся, горизонтальной прокрутки нет, фокус видим.
[Teacher RO360](browser/screenshots/teacher-ro-360.png),
[Director RU1280](browser/screenshots/director-ru-1280.png).

Platform production closure по K8K v2: **145928 bytes ≤256000**, включая **63492** байта
трёх локальных WOFF2. [Файлы/хеши/manifest seeds](browser/browser.json).
Новых dependencies нет, lockfile побайтно прежний. Audit и 48-route matrix TASK-017 —
исторические доказательства; в TASK-018 полный dependency audit/48-route gate не повторялись.
Старые ролевые тексты на этих экранах ещё частично RU; полный перевод и role acceptance
относятся к TASK-037/047/063/069. Здесь проверены новые подписи и даты RU/RO.

## Acceptance checklist

| Критерий | Статус |
|---|---|
| Prerequisite и сохранение dirty/untracked основы | PASS — Task017 evidence, basis/preservation |
| Teacher context только собственный profile; accountId отделён | PASS — HTTP override attempt и own/foreign tests |
| Director не подставляет teacher identity | PASS — teacherProfileId=null, own staff profile |
| Deactivation отменяет allowed | PASS — domain metadata allowed=false/objectId=null; HTTP403 выше прежнего allowed |
| Чужой/отсутствующий объект neutral denial | PASS — одинаковая teacher projection, manager404 без чужих student IDs |
| Unknown total не0, hasMore/coverage честные | PASS — limit+1/100 returned, total=null, UI sample labels |
| Manager approval-request доступен по собственному праву | PASS — capability, per-object policy, workflow AWAITING_APPROVAL без director confirmation |
| Команда перепроверяет policy после metadata | PASS — changed lesson state / removed portfolio; побочных финансовых эффектов нет |
| No-store/auth/MFA exceptions/validation/readonly | PASS в адресных mock service/HTTP tests |
| Штатная OpenAPI/SDK generation и consumers | PASS — 140 прежних +4 новых, входы прежних команд сохранены |
| Новый UI: RU/RO×4, loading/ready/403, focus/long text/clock/timezone | PASS —20 browser cases,16 PNG |
| Артефакты привязаны к HEAD/dirty digest, журнал/матрица обновлены | PASS |
| Working DB/provider/deploy/migrations | NOT_RUN, реальная среда не затронута |
| Полная регрессия, WCAG/AT, FND/LEGAL/FIN-LEGAL/Meet/G4/production GO | NOT_RUN, отдельные gates |

## Передача и обратимость

TASK-019 получает actorContext.accountId/role/profile IDs, asOf/source timestamps и
новые generated reads. Session epoch, очистка private cache, late-response и revoke
lifecycle остаются его предметом. Metadata нельзя использовать как право на выполнение.

TASK-020/021 получают готовый server context/freshness; operator UI может запрашивать
getStaffActorContext, manager — getManagerMe. TASK-036/037/038 получают lesson.start
eligibility и source timezone. TASK-048/056/059 получают request-approval/confirm adapters;
eligibility остальных команд добавляется в соответствующих role TASK поверх их policies.
DIR conditional aggregates не включены. Бounded workspace не становится полным реестром;
пагинация/детализация и полнота ролевых списков остаются в назначенных заданиях.

Rollback ограничен указанными source files/новыми metadata reads и consumer notes;
копии в before/ сохраняют старые изменённые файлы, generated original проверен по
Task017 hashes. Откат не требует миграций, reset/clean или удаления чужих изменений.
TASK-019 не начат.
