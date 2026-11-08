TASK: TASK-034

Статус: **DONE в локальном объёме задания**. Реальные PostgreSQL/S3/email/OTP/cookies и общий gate — NOT_RUN.

Основа: HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, ветка `feat/k8k-design`.
Исходный `git status --porcelain=v1 --untracked-files=all`:15210 records,
digest `0523d72884192015f1c72655c282c0f72ecb191bfa3eddf215ecb47c98bffc4a`.
Сохранены79 snapshots, все исходные пути существуют, HEAD/ветка и31 migration
paths/SHA неизменны. [Before](../../k8k-tasks/TASK-034/before.json), [preservation](../../k8k-tasks/TASK-034/preservation.json),
[адресный инкремент](../../k8k-tasks/TASK-034/changes.json). UI barrel получил только экспорт student messages;
отдельного исходного snapshot этого barrel не было, это отмечено в diff verifier.
Reset/clean/commit/push/deploy не выполнялись. Повторно присланные TASK-034 файлы
побайтно совпали: SHA256 `3a52270569d3acb2a4b3c00eb91b6babed0a4d06b4386035a49116b4bc663fb7`.

Что уже существовало:

- Единый RU/RO store с storage fallback/cross-tab, AppShell/account-ui и локальные Golos, доменные lesson/homework/skill/report/bell copy modules, safe errors и exact-money helpers.
- Private FilePermission workflow: metadata list, scoped signed GET, expiry/revocation, FOR SHARE/audit/no-store; enrollment не выдаёт grant.
- Backend profile whitelist, initial-password/student password-only exception, secret-command policy без generic replay, email/provider acceptance, session revoke409/404/204 и rotation. Они не реализованы заново и не ослаблены.
- TASK-024/027/033 prerequisites проверены по текущим sources и реальным acceptance artifacts. До изменений заново прошли46 material и73 security mocks; исторические PostgreSQL/teacher/provider результаты не выданы за новый прогон.

Что изменено:

| Путь | Поведение и причина |
| --- | --- |
| packages/ui/src/student-messages.ts, messages.ts, index.ts; student-cabinet/src/student-locale.ts | Typed RU/RO student namespace в существующих MessageKey/MessageCall, parity/placeholders. Stateless wrapper читает прежний useLocale. Student copy tree-shakeable, staff bundles не растут. Ни второго store, ни i18n framework. |
| student-cabinet/src/pages/Learning.tsx | Materials labels/filter/units/date/context/inline/download/neutral/expiry/empty-page и manual refresh. URL — только explicit direct read, проверка HTTPS/expiry, немедленный browser handoff. Ни query/mutation cache, ни React state/ref/storage для capability. |
| api/src/student/materials/materials.dto.ts, materials.service.ts | Три optional read-only поля из существующих p.educational_subject_id/p.can_download/o.file_name IS NULL. Можно переводить системный fallback, сохраняя одноимённые human labels. Permission predicates/signer/audit остаются прежними. |
| student-cabinet/src/pages/Account.tsx, profile-help.tsx | Shared Field/Button, controlled alias без remount, dirty/pristine synchronization, success после PATCH. Полный RU/RO password/email/sessions/suspended. Прямые secret closures, clear password/OTP, unknown без sent/retry. Auth-rotating unknown закрывает session boundary; confirm заново читает /me. Suspended — contacts/locale/logout, initial gate раньше suspended. |
| packages/account-ui/src/index.tsx | Публично re-exported уже существующий verifySessionOutcome; session.tsx byte-identical. Новой auth-политики/канала/role exception нет. |
| student-cabinet/src/{components.tsx,student-presentation.ts,router.tsx,pages/Reports.tsx,api.ts,student.css} | Общие подписи/errors/title/date/Intl plural, date-only без UTC сдвига, invalid date как unknown. QueryState optional timeZone для suspended /me. Materials403 очищает sibling cache. Длинные RO/filenames, touch sizes и responsive формы. |
| tests, local fixture/config и package test script | Реальные boundary assertions с mocks и Chromium: filters/count/metadata, alias, secret status/clearing, locale/reload/storage/cross-tab, negative scope/session/late URL. Fixture редактирует только synthetic state и редактирует secret command body в recorder до пустого объекта. |
| docs/current matrix/status/execution log и material/security README | Текущий local scope и ограничения, без переписывания замороженных актов. |

Точные interfaces и изменения решения записаны до реализации в [design-note](../../k8k-tasks/TASK-034/design-note.md).
Полный адресный [coverage](../../k8k-tasks/TASK-034/coverage.md) отделяет UI/system text от human content и
текущий K8K release от flag-off legacy compatibility. Последний сохраняется, но не
выдан за заново локализованный notification center. Смены языка не являются reload,
permission, изменением timezone или бизнес-командой.

Контракты/SDK/миграции:

- [contracts.json](../../k8k-tasks/TASK-034/contracts.json):149→149 operation definitions, parameters, request/response/security contracts неизменны. Единственная additive schema — optional `subjectId:string|null`, `canDownload:boolean`, `fileNameIsFallback:boolean` у MaterialItemDto; старые properties/required и остальные schemas сохранены. OpenAPI3.1 nullable — type `[string,null]`.
- API source DTO/projection → targeted API typecheck → штатный export:openapi → Orval generate:client/publish/generate → consumer typecheck/build. Generated не правились вручную. Экспорт запущен с DB-blocking preload: [no-db-export.mjs](../../k8k-tasks/TASK-034/no-db-export.mjs), использующим TASK-018 запрет DatabaseService.client. Diagnostic wrapper имел20s timeout и только имена pending providers, не менял providers/документ; NODE_OPTIONS восстановлен.
- Первый export был остановлен как зависший локальный процесс, затем штатный export с ограниченной диагностикой завершился0; SDK заново сгенерирован последовательно после успешного экспорта. Первые ошибки stale SDK/отсутствующего public export устранены. PASS относится к финальным source/build/logs, не к прерванному запуску.
-17 protected source/manifests/transport/locale/editor files byte-identical. Все security backend DTO/services, material permission predicates/signed workflow, account session boundary, root manifests/lockfile сохранены. Миграций/зависимостей не добавлено. .env не читались; live DB/provider/worker/seed/migration не запускались.

Источники/приоритет: TASK-034 §§3/5–10, актуальные K8K plan/status/requirements,
owner password decision01.11.2026 и account-switching map; STU-06/11 READ/secret
contracts; текущие CON decisions и PHASE0 policy. Исторические frontend-only и
старые MFA/QA указания не восстановлены. Актуальная React18 input/defaultValue/key
документация сверена через Context7 (`/reactjs/react.dev/__branch__v18`).

Проверки: точные команды, exit codes и границы в [verification.json](../../k8k-tasks/TASK-034/verification.json).

| Команда | Exit | Свежий результат |
| --- | --- | --- |
| pnpm test:stu06 --roots tests до изменений |0|46/46 baseline, [materials-baseline.log](../../k8k-tasks/TASK-034/materials-baseline.log) |
| pnpm test:stu11 --roots tests до изменений |0|73/73 baseline, [security-baseline.log](../../k8k-tasks/TASK-034/security-baseline.log) |
| pnpm --filter @online-school/api typecheck |0|[api-check.log](../../k8k-tasks/TASK-034/api-check.log) |
| pnpm --filter @online-school/api export:openapi с no-DB preload |0|[generate-diagnostic.log](../../k8k-tasks/TASK-034/generate-diagnostic.log) |
| pnpm --filter @online-school/api-contracts generate:client |0|149 ops, [generate.log](../../k8k-tasks/TASK-034/generate.log) |
| pnpm test:stu06 --roots tests |0|48/48 unit/HTTP, [materials-tests.log](../../k8k-tasks/TASK-034/materials-tests.log) |
| pnpm test:stu11 --roots tests |0|73/73 unit/HTTP/SDK, [security-tests.log](../../k8k-tasks/TASK-034/security-tests.log) |
| pnpm --filter @online-school/student-cabinet typecheck |0|Targeted consumer/UI/account refs, [student-check.log](../../k8k-tasks/TASK-034/student-check.log) |
| pnpm --filter @online-school/ui typecheck |0|[ui-check.log](../../k8k-tasks/TASK-034/ui-check.log) |
| Safe programmatic Vite build (envDir:false/publicDir:false/emptyOutDir:false) |0|Точная команда в verification; [build.log](../../k8k-tasks/TASK-034/build.log) |
| pnpm --filter @online-school/student-cabinet test:presentation |0|12/12, [presentation.log](../../k8k-tasks/TASK-034/presentation.log) |
| pnpm --filter @online-school/student-cabinet test:k8k-student-locales |0|2 locale cases +19 Chromium, [browser.log](../../k8k-tasks/TASK-034/browser.log), [playwright.json](../../k8k-tasks/TASK-034/playwright.json) |
| pnpm --filter @online-school/student-cabinet lint |0|0 warnings, [student-lint.log](../../k8k-tasks/TASK-034/student-lint.log) |
| pnpm --filter @online-school/ui lint |0|ESLint+Stylelint18 files, [ui-lint.log](../../k8k-tasks/TASK-034/ui-lint.log) |
| pnpm --filter @online-school/account-ui lint |0|[account-lint.log](../../k8k-tasks/TASK-034/account-lint.log) |
| Scoped eslint materials DTO/service/HTTP test --max-warnings0 |0|Точные пути в verification; [api-lint.log](../../k8k-tasks/TASK-034/api-lint.log) |
| node scripts/k8k-refresh-budget.mjs --task-034 |0|50/50, [budget.log](../../k8k-tasks/TASK-034/budget.log), [budgets.json](../../k8k-tasks/TASK-034/budgets.json) |
| node output/k8k-tasks/TASK-034/verify-contract.mjs |0|149 definitions/3 optional fields/17 protected files, [contracts.log](../../k8k-tasks/TASK-034/contracts.log) |
| node output/k8k-tasks/TASK-034/verify-preservation.mjs |0|79 snapshots/31 migration hashes/15210 original paths, [preservation.log](../../k8k-tasks/TASK-034/preservation.log) |
| node output/k8k-tasks/TASK-034/verify-diff.mjs |0|86 scoped paths/32 changed, no new whitespace defects, [diff-check.log](../../k8k-tasks/TASK-034/diff-check.log) |
| node output/k8k-tasks/TASK-034/verify-artifacts.mjs |0|[artifacts-check.json](../../k8k-tasks/TASK-034/artifacts-check.json) |

Новые2 HTTP cases проверяют genuine fallback/null context против human labels,
inline/attachment metadata, privacy/no-store и отсутствие signing при list.
HTTP mock моделирует новые projection columns, не доказывает выполнение SQL.
Исходные security73 и material46 проверки не ослаблены. Locale cases проверяют
parity/placeholders, fallback, Intl plural, New_York date-only и exact600.1234 MDL.

19 Chromium: RU/RO шести изменённых экранов ×4 ширины;15 route variants переключаются
без reload с translated title/aria и без видимых key strings; storage failure,
reload/cross-tab, dirty alias +background /me, alias100/PATCH whitelist, server
filter/page, contextless/authored labels, explicit URL/expiry/403, provider unknown
без «код отправлен», wrong password/OTP/temporary expiry, current409/foreign404/
other204, successful email/password bootstrap, full suspended/initial gate, native
validation/secret clearing, pending/stale/forbidden/empty, intercepted download,
late URL after logout/switch и unknown logout boundary. Network вне fixture origin
блокируется, кроме явно перехваченного synthetic download. Secret test values в
сохранённом первом failure log отредактированы; фактические provider/credentials
не использовались. Исправлены fixture default20→30, forced initial locale на reload,
селекторы локальных подписей/двух alert и проверка disabled input вместо fieldset;
production policy/линтер/бюджет не ослаблены. [Первый запуск](../../k8k-tasks/TASK-034/browser-first.log).

Визуальные доказательства:65 screenshots,48 matrix RU/RO×360/768/1024/1280×
materials/profile/security/login/change-password/suspended. Остальные показывают
relevant error/pending/unknown/stale/403/empty, alias100 и reflow.
[Реестр route/role/locale/CSS viewport/DPR/fixture/SHA](../../k8k-tasks/TASK-034/screenshots.json).
Примеры: [RO360 materials](../../k8k-tasks/TASK-034/after/ro-360-materials.png),
[RO360 security](../../k8k-tasks/TASK-034/after/ro-360-security.png), [suspended/New_York](../../k8k-tasks/TASK-034/after/ro-360-suspended.png),
[200% profile](../../k8k-tasks/TASK-034/after/ro-zoom200-profile.png), [unknown logout](../../k8k-tasks/TASK-034/after/ro-logout-unknown-verification.png).
Это synthetic35 grants/2 sessions и существующие учебные fixtures. Имена, filenames,
teacher-authored titles не переведены; реальные capability/OTP/cookie не попали в evidence.

Accessibility:10 axe WCAG2A/AA/2.1AA/2.2AA scans на360px (5 pages×RU/RO),0 violations:
[RU](../../k8k-tasks/TASK-034/axe-ru.json), [RO](../../k8k-tasks/TASK-034/axe-ro.json). Ручной просмотр реального materials/security/
suspended и200% profile; keyboard/focus/long text/reduced-motion автоматизированы.
200% — эквивалент1280×1000 device output при640×500 CSS/DPR2, с реальным responsive
reflow и доступным account menu. Это эмуляция, не сертификат physical/browser zoom
или screen-reader. Первоначальная CSS zoom проверка заменена после визуального
ревью, чтобы измерять reflow и не пропускать недоступное меню. Финальный полный19
прогон уже использует исправленный метод.

React review: controlled alias/stable DOM, unconditional hooks, synchronous locks,
no secret mutation data/ref fingerprints, session/mounted checks после await,
authoritative timezone, plain-text rendering и shared session retirement. Typecheck,
lint, mock и browser evidence подтверждают этот ограниченный объём.

Бюджеты k8k-route-v2: gzip closure + все3 локальных WOFF2, прежняя методика.
Student255001/256000, max255923/256000;50/50 PASS, storybook modules0. Staff totals
сохранены благодаря tree shaking student namespace. Это shared-bundle check, не
полная регрессия всех кабинетов.

Не проверено/блокеры:

- Реальные PostgreSQL metadata projection/permissions, locked revoke/expiry races — NOT_RUN; нужна отдельно разрешённая integration-приёмка, без новой test DB/DDL/seed в этом TASK.
- Настоящие S3/private object/15-minute expiry/revocation, email/OTP/provider acceptance, реальные cookie rotations и физические устройства — NOT_RUN. Mocks/crypto signer и fixture не заменяют этот workflow.
- Полный TASK-035, recursive regression, FND-GATE, юридическое соответствие и production GO — NOT_RUN. Внешние ограничения не выданы за PASS.

Acceptance checklist:

- PASS — RU/RO текущих K8K routes/labels/aria/title/errors/date и новый typed namespace, единый store, reload/cross-tab/storage fallback, ввод сохранён.
- PASS — explicit FilePermission metadata/filter/count, HTTPS/expiry/late response; URL не сохраняется приложением; inline не DRM.
- PASS — alias/PATCH whitelist/dirty input; secret CSRF/unknown/clearing/session handling, server policies/DTO/empty responses сохранены.
- PASS — full suspended, initial-password gate, safe manager contacts/locale/logout; subject/file access остаётся серверным фактом.
- PASS — current local tests/screenshots/budgets/contracts/preservation и актуальные docs.
- NOT_RUN — real DB/S3/mail/cookies/device acceptance и полный gate, причины выше.

[Машиночитаемая приёмка](acceptance.json) сохраняет
NOT_RUN как null, а не true. Остатки и interfaces: [handoff](../../k8k-tasks/TASK-034/handoff.md).
TASK-035 не начат.

Риски/обратимость: optional metadata SQL ещё не выполнен на PostgreSQL. Старый API
без новых полей работает с raw/neutral fallback; полная локализация системного
fallback требует текущего API increment. Rollback — только перечисленный diff,
79 snapshots и явно новые файлы/экспорты, затем штатная регенерация SDK. Не откатывать
весь dirty tree и не удалять чужую историю/данные. Persisted grants, identity,
secrets, source facts и миграции не переписывались.
