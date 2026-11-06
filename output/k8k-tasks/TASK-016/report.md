# TASK-016

Статус **DONE** в объёме локализованного отображения ошибок и валидации. Дата 04.11.2026.

Основа — HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design`, dirty digest `b24c31ad2d0ba8affbc5574aed5ad1702bdd702de42a4d6a8f7a2590cc27dd8f`. Сохранены существующие изменения, ветка и архивы. Хеши 220 входных файлов, определение digest и изменения относительно TASK-015 находятся в [basis.json](basis.json).

## Что существовало и что изменено

До TASK-016 работали student `inspect/write/useCommand`, manager session guards и idempotency hook, StateBoundary с приоритетом 401/403, общий RU/RO store и точное форматирование денег. Student errorMessage и manager ERROR_MESSAGES содержали раздельные русские сообщения. Transport сохранял status/code/message, но терял `details.fields`.

- `packages/ui/src/error-messages.ts` содержит RU/RO системную копию. `error-keys.ts` выводит 138 явных display mappings из этих ключей, без повторного перечня кодов. Общие fallback и правила по статусу покрывают оставшиеся ошибки. Старый `ERROR_MESSAGES` менеджера остаётся совместимым RU-экспортом, получаемым из прежнего generated перечня 243 кодов и общего адаптера. [Display inventory](display-inventory.json), [прежние сообщения](previous-manager-messages.ts), [исходные кандидаты кодов](code-inventory.json)
- `describeError` возвращает typed key, severity, nextAction, outcome и имена полей. `errorText` выбирает язык при отображении. Сырой message/detail, SQL, stack, requestId и произвольные поля details в DOM не попадают. Ошибки действий и чтений различаются. Network/5xx/INVALID_RESPONSE/COMMAND_IN_PROGRESS после записи показывают неизвестный исход и сверку результата.
- `ErrorFeedback` выводит текст и иконку, допускает только явный retry чтения. Неизвестная команда не получает generic retry. Пояснение суммы принимает собственную введённую decimal string и форматирует её существующим BigInt formatter. Значение не берётся из произвольного серверного сообщения.
- `ErrorForm` и `useFieldError` связывают native validation и server field names с локальными контролами. Ошибка доступна через aria-describedby и aria-invalid. После ответа фокус переходит к первому соответствующему полю после снятия busy. Изменение поля снимает его старое пояснение. Locale switch не сбрасывает ввод и не запускает submit. Общие Field/Select и manager Input/TextArea/Select/Check используют этот контекст.
- `packages/api-contracts/src/transport.ts` добавляет optional `ClientError.details` для уже существующего ответа. `status`, `code`, message, manager contacts и existingId сохраняются. `ApiErrorView` сохраняет details и получает локальный operation/read|write. DTO, wire codes и HTTP statuses не менялись. Generated sources побайтно совпадают с TASK-015, серверная схема и миграции не менялись. Выполнена адресная компиляция transport.
- Student ErrorNotice/QueryState и manager ErrorBox/State используют общий display adapter. Формы student login/password/profile/email и общие CRM формы используют контекст ошибок. Известный CURRENT_PASSWORD_INVALID связывается с currentPassword и при 401 не отзывает сессию команды. Обычный 401 продолжает очищать контекст. Object 403 удаляет cached private body без безусловного logout.
- Hooks блокируют слепой повтор команды с неизвестным исходом, включая смену payload или языка. Обычная подтверждённая ошибка сохраняет существующую idempotency policy. Очередь homework autosave и её версии не переписывались. Уведомление с 202/QUEUED получает локализованный текст очереди.

Контракт и planned names зафиксированы в [design-note.md](design-note.md). Применены TASK-016 §§3, 5–10, VIS-06/B, VIS-11/B, общий typed locale contract TASK-014 и текущие правила AGENTS. Ролевые права, денежные основания, wire codes и правила входа остаются авторитетными серверными фактами.

## Бюджет и совместимость денег

Первый адресный замер обнаружил превышение бюджета календарных маршрутов. Удалён повторный список кодов ошибок. Дополнительно eager-импорт Decimal ради input validation вынесен из бизнес-форм. `money-validation.ts` сохраняет прежний MONEY_REGEX и точную проверку положительного decimal input. Decimal и четырёхзначное форматирование CRM сохранены в `money.ts`.

`BalanceSummary` с прежним содержимым обзора загружается в существующем Suspense только на вкладке overview. Данные передаются из той же карточки, новых reads нет. В `scripts/k8k-route-budget.mjs` добавлен явный seed BalanceSummary для overview, чтобы его вес учитывался. Формат и ссылка баланса проверены отдельным regression test.

| Маршрут CRM | Байты K8K v2 с fonts | Результат |
|---|---:|---|
| Карточка ученика, schedule | 244440 | PASS |
| Schedule | 242435 | PASS |
| Карточка ученика, overview с BalanceSummary | 206307 | PASS |
| Карточка ученика, payments | 254495 | PASS |
| Карточка ученика, subscriptions | 254015 | PASS |

Лимит 256000 байт, три подмножества локального Golos учтены один раз. [Проверяемые файлы, хеши, manifest seeds и расчёты](budgets.json)

## Свежие проверки

| Команда | Exit | Результат |
|---|---:|---|
| `pnpm --filter @online-school/ui build` | 0 | Компиляция UI, parity ключей и placeholders. |
| `pnpm --filter @online-school/api-contracts exec tsc -b --pretty false` | 0 | Адресная компиляция handwritten transport. |
| `pnpm --filter @online-school/student-cabinet --filter @online-school/manager-web typecheck` | 0 | Проверены consumers обоих кабинетов. |
| `pnpm --filter @online-school/ui test` | 0 | 136 тестов, включая RU/RO error mappings, безопасный unknown code, credential policy и точную сумму в пояснении. [Лог](unit.log) |
| `pnpm --filter @online-school/ui test:locale:types` | 0 | Проверка контракта типизированных параметров. |
| `pnpm --filter @online-school/manager-web exec vitest run src/test/forms.test.tsx src/test/session.test.tsx src/test/error-policy.test.tsx src/test/money-validation.test.tsx` | 0 | 18 тестов. 401 current password, late revoked response, unknown repeat guard, прежняя точность и валидация денег, баланс и управляемые поля. [Лог](manager-unit.log) |
| `pnpm --filter @online-school/ui lint` и адресный ESLint изменённых TS/TSX/mjs | 0 | CSS guard не получил новых или stale записей, прежних legacy declarations 715. Финальный browser script и изменённый regression test также проверены отдельно. |
| `pnpm --filter @online-school/manager-web test:errors` | 0 | Семь браузерных сценариев и пять бюджетов. [Лог](browser.log), [сценарии](browser.json) |
| `node --experimental-vm-modules node_modules/jest/bin/jest.js --runTestsByPath tests/unit/student-transport.test.mjs --roots tests --runInBand` | 0 | Два существующих transport compatibility tests. [Лог](transport-targeted.log) |
| `pnpm --filter @online-school/ui build:storybook`, `check:storybook`, `test:storybook` | 0 | 45 историй и 41 публичный component export с alias. Новые ErrorFeedback/ErrorForm имеют истории, сохранены девять VIS-11 и keyboard/a11y smoke. [Build](storybook-build.log), [coverage](storybook-coverage.json), [smoke](storybook-smoke.json) |

Первоначальный Jest-вызов без ограничения roots завершился кодом 1 из-за naming collisions в архивных снимках output. Сами transport tests успешно выполнены адресной командой выше. [Первоначальный лог](transport.log)

Browser harness собирает реальные компоненты и transport в памяти с envDir false. API-запросы перехвачены. Проверены body/field error, фокус и неизменный ввод, число записей при смене языка, raw diagnostic suppression, cached 403 обоих кабинетов, неизвестный write, реальная форма ChangePassword с CURRENT_PASSWORD_INVALID и generated SDK notification 202. CSRF и idempotency проверены по наличию без записи значений в артефакты. Sentinel внешнего обращения заблокирован. Browser errors отсутствуют.

## Визуальные доказательства

Локальный `/manager-fixture?case=manager&ui.k8k=1`, синтетическая форма на реальных manager FormShell/Input и общем ErrorFeedback. Введённая большая сумма принадлежит fixture, сервер отвечает INVALID_MONEY. Восемь PNG покрывают RU/RO и 360/768/1024/1280, видимые field error и фокус. Парольный сценарий проверен без снимков или сохранения введённых значений.

[RO 360](screenshots/validation-ro-360.png) · [RU 360](screenshots/validation-ru-360.png) · [RO 1280](screenshots/validation-ro-1280.png)

## Acceptance checklist

| Критерий | Результат |
|---|---|
| CURRENT_PASSWORD_INVALID не вызывает неверный redirect | PASS для manager command и реальной student password form |
| Cached403 скрывает private | PASS в обоих read boundaries |
| Unknown code не раскрывает raw diagnostic | PASS |
| Locale switch не повторяет command | PASS, включая unknown outcome |
| Field error связан aria, ввод и фокус сохраняются | PASS |
| Точная большая decimal сумма в пояснении | PASS |
| RU/RO, четыре ширины, keyboard и relevant VIS-11 | PASS |
| Status/code/details и существующие transport guards | PASS |
| Источники и доказательства привязаны к HEAD/dirty digest, журнал и матрица | PASS |
| DB/provider/MFA, полный gate WCAG/AT и полная матрица 48 маршрутов | NOT_RUN в рамках этого задания |

TASK-017 получает describeError/errorText, ErrorFeedback, ErrorForm/useFieldError, новые CSF `UI/Error feedback` и обновлённый overview manifest seed. Для student RFC Problem Details неизвестные field details не выдумываются — при отсутствии метаданных выводится общее сообщение, известные credential codes дают конкретное поле. Общая приёмка, ролевые тексты и реальные провайдерные проверки остаются в назначенных заданиях. Внешние зависимости и lockfile совпадают с TASK-015. Обратимость ограничена display adapter, контекстом форм, локальными guards и адресным разделением кода загрузки баланса.
