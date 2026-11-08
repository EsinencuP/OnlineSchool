# TASK-030 — домашние задания и надёжность редактора

TASK: TASK-030  
Статус: DONE в локальном объёме задания  
Дата: 08.11.2026

## Основа и сохранение работы

HEAD: `60e2a0c47cbcc744dc658a85f386833146e836b3`, ветка `feat/k8k-design`.
До работы было 423 dirty/untracked status records; digest
`e5c068927cc2802b231e6dc797f0ecda59f5d7823d8f4c301bdb4b7156acadf2`.
Зафиксированы [before.json](../../k8k-tasks/TASK-030/before.json), [status-before.txt](../../k8k-tasks/TASK-030/status-before.txt)
и 21 побайтовая копия исходных файлов в `before/`.
[Проверка сохранности](../../k8k-tasks/TASK-030/preservation.json) подтвердила копии, наличие всех исходных
путей, исходные HEAD/ветку и неизменность 31 migration checksum.
Это не утверждение, что исходные dirty-файлы не редактировались: необходимые изменения
наложены поверх них адресно. Reset/clean/commit/push/deploy не выполнялись.

## Что уже существовало

Рабочие HomeworkEditor, controlled textarea, debounce 2000 ms, serial
`queue.current` / `persistRef`, uploadIntent с отдельными request/confirm UUID,
`submitKey`, route/unload blockers, server versions и CSRF/session границы.
Backend уже проверял own Delivery.id, статусы, soft deadline, VERIFIED attachments
и idempotency. Это сохранённая основа, а не новая реализация TASK-030.

До изменения JSX записана [design note с таблицей состояний](../../k8k-tasks/TASK-030/design-note.md).
Пять исходных сценариев прошли на сохранённом исходнике редактора:
[baseline.log](../../k8k-tasks/TASK-030/baseline.log). Воспроизводимый builder подставляет сохранённый
Homework.tsx и исходные тесты, не заменяя рабочие файлы. Это baseline редактора
в существующей общей оболочке, не замороженная копия всего приложения.

Единственная адаптация исходных пяти тестов в текущем student.spec.mjs:
`dialog` → `alertdialog` для общего ConfirmDialog. Ожидания ввода, тайминга,
serial saves, intent replay и logout не ослаблены. Все пять входят в итоговые 16.

## Что изменено

| Путь | Поведение и причина |
| --- | --- |
| apps/student-cabinet/src/pages/Homework.tsx | ListRow/StatusChip/Select, серверная пагинация и URL status/page/lessonId/backTo. Нет status-tabs, completion checkbox, client sort или общего счётчика из текущей страницы. |
| тот же HomeworkEditor | Задание преподавателя, controlled ответ, файлы, save feedback, явная сдача и plain text история визуально разделены. Textarea сохраняет identity по delivery ID и selection при refetch. |
| тот же HomeworkEditor | Saved только после реального draft/save response. Истечение ранее прочитанного draft снимает saved claim, сохраняет текущий ввод и допускает штатный autosave. expiresAt остаётся TTL черновика. |
| тот же HomeworkEditor | Submit ждёт прежнюю очередь; synchronous lock защищает double click. Unknown фиксирует body/key/baseVersion и приостанавливает autosave. Существующий GET detail проверяет новые версии перед явным повтором. |
| тот же HomeworkEditor | Совпавшая новая версия content + file IDs подтверждает отправку без POST. Если серверная версия не выросла и всё ещё editable, повтор использует прежние key/body. Другая новая версия требует просмотра истории. Новый ключ автоматически не создаётся. |
| тот же HomeworkEditor | Upload request/PUT/confirm различаются. VERIFIED добавляется после совпавшего fileId/status. Successful PUT не повторяется при confirm retry; expired URL получает новый intent с сохранённым File. Выбранный файл можно отменить локально. |
| тот же HomeworkEditor | Общий ConfirmDialog защищает dirty/files/unknown, cancel возвращает focus. 403 выше cache; auth lease и mounted guard отбрасывают поздний результат. Auth redirects обходят blocker. |
| apps/student-cabinet/src/homework-copy.tsx | RU/RO copy и HomeworkStatus, включая save/upload/unknown/read-only/reviewed, ошибки и доступные подписи. Учебный текст, имена и комментарии не переводятся. |
| apps/student-cabinet/src/homework-navigation.ts | Возврат только в разрешённый homework list URL с whitelist query; чужой origin/path/hash не принимается. |
| apps/student-cabinet/src/api.ts, src/router.tsx | Detail revalidate-on-mount по существующей read policy; стабильный ScrollRestoration key списка ДЗ. |
| apps/student-cabinet/src/student.css | Существующие токены/Golos, wrapping длинных имён, явный focus; основной CTA ≥48 px, file button ≥44 px. CTA находится в потоке и не образует фиксированную панель над вводом. |
| apps/student-cabinet/tests/fixture-server.mjs | Только synthetic local fixtures: truthful latestVersion, версии и replay, committed/lost response, expired draft, статусы/403, 23-row pagination, upload records. |
| apps/student-cabinet/tests/homework-redesign.spec.mjs и playwright.homework*.config.mjs | Изолированные локальные browser/baseline команды, запрет внешней сети в новых browser cases, сценарии и screenshots. |
| apps/student-cabinet/tests/build-homework-baseline.mjs, package.json | Воспроизводимая baseline-команда и отдельная итоговая browser-команда. Новых зависимостей нет. |
| scripts/k8k-refresh-budget.mjs | Адресный TASK-030 budget output на основе TASK-029, 50 маршрутов. |
| docs/K8K_IMPLEMENTATION_STATUS.md, docs/K8K_REQUIREMENTS_MATRIX.md, docs/k8k-redesign-tasks/EXECUTION_LOG.md, apps/api/src/student/homework/README.md | Текущий статус, evidence и handoff; историческая provider-проверка в README не объявлена новым прогоном. |

Разрешённые edit статусы остаются NOT_SUBMITTED/NEEDS_REVISION. SUBMITTED/REVIEWED
read-only; после авторитетной новой доработки разрешена следующая версия.
Предыдущая история/comments/files не переписываются. Description/content/comments
рендерятся как текст, без raw HTML и numeric grade.

## Контракты / SDK / миграции

[contracts.json](../../k8k-tasks/TASK-030/contracts.json): homework DTO/service, OpenAPI, generated SDK,
root package/lockfile и соседние shared components/StudentHome совпадают с baseline
побайтово. Все 147 operations сохранены. Штатная генерация не нужна без изменения
контракта; generated файлы вручную не редактировались. Новых API, dependency,
миграций и storage policy нет; миграции не применялись.

Используются существующие `getStudentHomework`, `getStudentHomeworkDetail`,
`saveStudentHomeworkDraft`, `requestStudentHomeworkUpload`,
`confirmStudentHomeworkUpload`, `submitStudentHomework`.
`hwId` — Delivery.id. Порядок выдачи задаёт сервер `issued_at DESC,id DESC`.
Нет нового client entitlement/finance/skill расчёта; dashboard recent3 и counts
не менялись. Время отображается по авторитетной /me timezone и выбранному RU/RO.

## Источники и решения

Приоритет: текущая воля владельца и AGENTS → актуальные специальные решения →
архитектура/действующие K8K документы → visual template.
Применены TASK-030 §§3/5–10; VIS12 STU-02 и V12-AT-04/10/11;
student decision log №10.8/A, №10.9–10.11; homework README
Routes and identity / Lifecycle and persistence / Private direct uploads;
K8K design §2 п.3, §3.3, §5.2 DASH-STU-02.
Учитывались текущие plan/status/matrix, owner CON-01…11 и PHASE0_CHECKS.
Предыдущий TASK-029 проверен по реальному report/acceptance и текущим исходникам.

Использованы webdev-frontend-craft и ранее прочитанный webdev-api-data;
проверка React/hooks/accessibility выполнена по react-best-practices с сохранением
утверждённого UI stack. Новых библиотечных API/версий нет, установки зависимостей нет.
Context7 в доступном наборе инструментов не найден; это не имитировалось ссылкой
на неподходящий инструмент. Визуальная опора — локальный template/newtemp.png;
его демонстрационные данные не становились правилами.

## Свежие проверки

Все команды выполнялись из D:/OnlineSchool после чтения их scripts/config.
[verification.json](../../k8k-tasks/TASK-030/verification.json) содержит точные команды и exit codes.

| Команда | Exit | Результат / доказательство |
| --- | --- | --- |
| pnpm --filter @online-school/student-cabinet test:homework-baseline | 0 | 5/5 исходных сценариев, [baseline.log](../../k8k-tasks/TASK-030/baseline.log) |
| pnpm --filter @online-school/api typecheck | 0 | Адресная tsc сборка перед dist-based HTTP mocks, [api-build.log](../../k8k-tasks/TASK-030/api-build.log) |
| pnpm test:stu05 --roots tests | 0 | 55/55 unit + реальные Nest HTTP routes с mock Prisma/storage, [homework-api.log](../../k8k-tasks/TASK-030/homework-api.log) |
| pnpm --filter @online-school/student-cabinet typecheck | 0 | [student-check.log](../../k8k-tasks/TASK-030/student-check.log) |
| Programmatic Vite build, ниже | 0 | Safe frontend dist перед Chromium; silent build, без .env/public копирования |
| pnpm --filter @online-school/student-cabinet lint | 0 | eslint --max-warnings 0, [student-lint.log](../../k8k-tasks/TASK-030/student-lint.log) |
| pnpm --filter @online-school/student-cabinet test:homework-redesign | 0 | 16/16, включая исходные 5, [browser.log](../../k8k-tasks/TASK-030/browser.log), [playwright.json](../../k8k-tasks/TASK-030/playwright.json) |
| node scripts/k8k-refresh-budget.mjs --task-030 | 0 | 50/50, ДЗ 243405 bytes, максимум 255923 из 256000, fonts включены, [budget.log](../../k8k-tasks/TASK-030/budget.log), [budgets.json](../../k8k-tasks/TASK-030/budgets.json) |
| node output/k8k-tasks/TASK-030/verify-preservation.mjs | 0 | 21 snapshots / 31 migration hashes / 147 operations, [preservation.log](../../k8k-tasks/TASK-030/preservation.log) |
| Scoped git diff --check | 0 | Пути before.json, [diff-check.log](../../k8k-tasks/TASK-030/diff-check.log) |
| node output/k8k-tasks/TASK-030/verify-artifacts.mjs | 0 | Реестр 26 screenshots, browser stats, 50 budgets и ссылки, [artifacts-check.json](../../k8k-tasks/TASK-030/artifacts-check.json) |

Точный безопасный build (PowerShell):

```powershell
'import { build } from "vite"; await build({envDir:false,publicDir:false,logLevel:"error",build:{emptyOutDir:false}});' | pnpm --filter @online-school/student-cabinet exec node --input-type=module
```

Scoped diff:

```powershell
$task030Paths = (Get-Content output/k8k-tasks/TASK-030/before.json -Raw | ConvertFrom-Json).paths.path
git -c core.safecrlf=false diff --check -- $task030Paths
```

Исходные compile/lint замечания (лишнее narrowed pending comparison и
DataTransfer без globalThis в browser test) исправлены, не подавлены.
При просмотре screenshot нативная английская подпись file control заменена
видимой RU/RO кнопкой UI-kit; затем повторены browser/lint/budget.
Итоговый browser включает 401 login redirect, 402 suspension, 403 cached denial.
Большая рекурсивная регрессия не запускалась по PHASE0 policy.

## Визуальные доказательства

Роль STUDENT, только synthetic fixture; routes `/student/homework` и
`/student/homework/20000000-0000-4000-8000-000000000001`, `?ui.k8k=1`.
26 screenshots: 24 = RU/RO × 360/768/1024/1280 × list/editor/history;
ещё 2 — unknown submit и failed save. Полный реестр — [screenshots.json](../../k8k-tasks/TASK-030/screenshots.json).

- [RU 360 list](../../k8k-tasks/TASK-030/after/ru-360-list.png)
- [RO 360 editor](../../k8k-tasks/TASK-030/after/ro-360-editor.png)
- [RU 1280 history](../../k8k-tasks/TASK-030/after/ru-1280-history.png)
- [RO submit unknown](../../k8k-tasks/TASK-030/after/ro-submit-unknown.png)
- [RU save failed](../../k8k-tasks/TASK-030/after/ru-save-failed.png)

Проверены 100-символьное имя, переносы, отсутствие горизонтального overflow,
focus редактора/кнопки файла, cancel focus return, CTA ≥48px и file button ≥44px.
Снимки viewport: editor/history намеренно прокручены к соответствующей секции.
Вручную просмотрены mobile RO editor, desktop RU history и RU list.
Нативное окно выбора файла и физическая виртуальная клавиатура не эмулируются.

## Не проверено и необходимые внешние условия

- NOT_RUN: реальные S3/CORS/signing/HEAD/COPY и provider failures. Browser перехватывает
  synthetic PUT; проверены bytes/headers/omit и intent lifecycle, а не реальный storage.
  Исторический S3 probe в backend README не считается TASK-030 PASS.
- NOT_RUN: рабочие PostgreSQL write/replay/concurrency/locks/index races, migration
  rehearsal и применение. Нужны отдельно разрешённая процедура и рабочий target;
  альтернативная QA БД не создавалась. Unit/HTTP mocks не доказывают реальные гонки.
- NOT_RUN: физический mobile keyboard/file picker и полный WCAG аудит.
  Здесь локальные Chromium layout/focus checks.
- NOT_RUN: общий ролевой TASK-035/FND-GATE, юридические/финансовые и expanded Meet
  provider/OAuth/G4 gates, deployment и production GO. Индивидуальный TASK их не закрывает.

## Acceptance checklist

Машиночитаемый полный список: [acceptance.json](acceptance.json).

- **PASS** — baseline_and_serial_autosave: Пять исходных сценариев до JSX; те же пять в итоговых 16. Debounce 2s, serial queue и медленный старый save не затирают новый.
- **PASS** — chronological_server_list: 23 задания, серверные страницы по issued_at DESC/id DESC; nullable dueAt не переупорядочивает список; нет tabs/checkboxes и выдуманного global count.
- **PASS** — editor_input_selection_refetch_expiry: Неизменный textarea DOM/selection и whitespace при failed save/refetch; expired draft не подменяет ввод и снимает saved claim.
- **PASS** — route_unload_focus: Dirty/selected files/unknown защищены blocker; cancel возвращает focus к ответу; сохранён beforeunload.
- **PASS** — confirmed_feedback_only: Saved после server draft/save response, attached file после VERIFIED с совпавшим ID, submitted после response или найденной версии.
- **PASS** — unknown_result_safe_retry: Нет автоматического повтора; GET existing detail/version перед явным повтором. Потерянный committed ответ подтверждён без второго POST; replay использует исходные key/body.
- **PASS** — queue_submit_double_click: Submit ждёт queue.current, синхронный lock блокирует double click; серверный replay покрыт API mocks.
- **PASS** — revision_readonly_history: NEEDS_REVISION допускает новую версию; SUBMITTED/REVIEWED read-only после refresh; прежние версии и plain text comments сохранены.
- **PASS** — file_bounds_and_verified_protocol: 0 и 50MiB+1 не запрашивают upload; максимум 20 VERIFIED. PUT точных bytes, credentials omit, только MIME header; confirm retry без повторного PUT.
- **PASS** — expired_upload_and_foreign_file: Browser expired PUT создаёт новый upload intent с сохранённым File; server mocks отвергают pending/foreign file IDs.
- **PASS** — soft_deadlines_and_server_status: 55 API mocks включают null/equal/late deadline; серверные status/isLate и Delivery.id сохранены; денежных и skill writes нет.
- **PASS** — auth_revocation_private_dom: 403 скрывает cached private answer, 402/401 обходят dirty blocker и удаляют редактор; logout отбрасывает поздний save/следующую очередь.
- **PASS** — ru_ro_keyboard_touch_long_text: RU/RO × 360/768/1024/1280, 24 matrix + 2 state screenshots. Long teacher name, focus, no horizontal overflow; CTA≥48px, file button≥44px, локализованная видимая кнопка файла.
- **PASS** — authoritative_existing_contracts: Homework DTO/service, OpenAPI и SDK byte-identical baseline; 147 operations; /me timezone, server pagination/status, UI-kit и штатные auth/CSRF границы.
- **PASS** — route_budgets_fonts: 50/50 ≤256000 bytes по v2 с локальными Golos subsets; Storybook отсутствует в bundle.
- **PASS** — preserve_dirty_migrations_production: 21 before snapshot valid, 31 migration hashes неизменны, все исходные 423 status paths существуют; ветка/HEAD сохранены, production/DB не использовались.
- **PASS** — current_sources_and_scoped_report: Применены актуальные owner decisions и STU-02/V12-AT-04/10/11; исходный lifecycle, новые изменения и свежие mock/browser доказательства разделены.
- **NOT_RUN** — real_s3_cors: Только local intercepted upload. Реальные signing/PUT/HEAD/COPY/CORS/private provider и retention не проверялись.
- **NOT_RUN** — postgresql_write_and_concurrency: Тесты mock Prisma/storage/Nest HTTP; реальные SERIALIZABLE/locks/index races и migration rehearsal не запускались.
- **NOT_RUN** — physical_mobile_and_full_accessibility: Chromium viewport/focus измерения; физическая виртуальная клавиатура, нативный системный file picker и полный WCAG аудит требуют отдельной ручной приёмки.
- **NOT_RUN** — full_role_gate_and_production: TASK-035 и общий FND-GATE, юридические/Meet provider gates и production GO вне локальной приёмки TASK-030.

## Остатки и передача

[handoff.md](../../k8k-tasks/TASK-030/handoff.md). TASK-031 может продолжить материалы по своему документу;
связи файлов используют существующий permission/metadata contract.
TASK-035 принимает полный кабинет и реальные ролевые переходы.
Ни следующий TASK, ни provider/DB работы автоматически не начаты.
Unknown submit живёт в памяти текущего editor/session; durable offline command
queue, PWA и новая server receipt operation в этот scope не вводятся.

## Риски и обратимость

Внешних эффектов и миграций нет. Для rollback восстанавливать только адресные
TASK-030 изменения из before snapshots с учётом более поздней работы, а новые
homework-copy/navigation/tests/config удалять лишь после проверки их владельца.
Не применять reset/clean ко всему дереву: исходные 423 записи принадлежат общей
рабочей основе. Версии сдачи и server history не удалять. Private URLs/credentials
не помещались в storage/logs/screenshots/report; provider URL в fixture synthetic.

