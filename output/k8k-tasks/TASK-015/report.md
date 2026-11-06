# TASK-015

Статус **DONE** в объёме общей оболочки, контролов и меню аккаунта. Дата 04.11.2026.

Основа — HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design`, dirty digest `6a13424e964b29e781d80bcab790fa6a38c0d33671edccd5c5252bb6883c09c8`. Сохранены существующая ветка, предыдущие изменения и архивы. Определение digest и хеши 205 входных файлов находятся в [basis.json](basis.json). Перечень изменений относительно TASK-014 приведён там же.

До TASK-015 существовали typed RU/RO store, форматтеры, локализованные системные значения UI, общий вход платформы и Storybook. Девять состояний, aria labels контролов, закрытие Radix-окон и подписи свежести уже использовали словарь. Меню аккаунта и часть передаваемых приложениями подписей содержали русский текст. AppShell определял подписи по общему id и терял смысл отдельных пунктов разных ролей. [Инвентарь](literal-inventory.md)

## Изменения

- `packages/ui/src/messages.ts` дополняет оба словаря пространствами `account.*`, `nav.*`, `chrome.*` и общими подписями входа. `PlainMessageKey` доступен для типизированных адаптеров. Ключи и параметры проверяются существующим контрактом TASK-014.
- `packages/ui/src/navigation.ts` добавляет к существующим элементам `labelKey` и `compactLabelKey`. Сохраняются id, href и совместимые русские label/shortLabel. Менеджер получает «Обзор», преподаватель — «Мои ученики», директор — «Ученики школы» и «Задачи менеджеров», оператор — «Состояние платформы». AppShell использует эти ключи для desktop/mobile navigation.
- `packages/account-ui/src/index.tsx` использует один `useLocale`, показывает один LanguageSelector внутри открытого меню и локализует роли, каталог, ошибки и действия. Экспорт `accountRoleLabel(locale, role)` используется также общим входом платформы. Совместимый `roleLabels` выводится из того же словаря. Имена пользователей остаются исходными строками.
- AccountMenu остаётся единственной точкой переключения demo и выхода. Существующие адаптеры выхода student и manager передаются через optional `onLogout(): Promise<AccountLogoutOutcome>`. Значения `AccountLogoutOutcome` — `ended | rejected | unknown`. Адаптер ученика сохраняет write, очистку кэша и переход на student login, менеджер сохраняет clearSession и переход с sessionError. Остальные кабинеты используют существующий транспорт account-ui.
- При pending команды язык можно переключить без повторной записи. Unknown outcome показывает сверку текущей сессии и блокирует повтор переключения и выхода. Успешная смена сохраняет полную навигацию и обновление соседних вкладок. Браузерный сценарий обнаружил гонку двух BroadcastChannel одной вкладки. Отправка через канал самого AccountMenu исключила получение собственного события перед переходом в целевой кабинет.
- `apps/*` передают переведённые header/footer/shortcut/search labels. Отдельные кнопки выхода удалены из оболочек и меню навигации. Student и manager login получили по одному селектору и общие подписи полей. Пагинация и закрытие legacy student Modal, общие подписи preview колокольчика используют typed keys.
- CSS ограничивает ширину кнопок bottomnav своей ячейкой, переносит румынские подписи и сохраняет видимую подпись языка в меню. Селектор и действия меню имеют цели нажатия 44 px. Восьми PNG достаточно для парного сравнения текущего меню на двух языках и четырёх ширинах.

Контракты перечислены в [design-note.md](design-note.md). SDK, DTO, operation names, серверные role/status/action codes и миграции сохранены. Добавлена одна локальная зависимость `account-ui → ui` для словаря и селектора. Проверка lockfile подтверждает ровно одно изменение workspace importer и ноль изменений внешних версий. В ui отсутствуют зависимости account-ui и SDK. Type-only связь navigation с MessageKey стирается при компиляции. [Проверка зависимостей](dependencies.json)

## Источники и проверки

Применены TASK-015 §§3, 5–10, решения VIS-08/B, VIS-10/B, VIS-11/B и текущие правила `AGENTS.md`. Граница demo switch соответствует `docs/platform_account_switching_2026_11_01.md`. Общий locale contract переиспользован из TASK-014. Состав общих подписей и передача ролевых остатков указаны в инвентаре.

| Команда | Exit | Результат и артефакт |
|---|---:|---|
| `pnpm --filter @online-school/ui build` | 0 | Компиляция UI, parity обоих словарей и placeholder checks. |
| `pnpm --filter @online-school/account-ui build` | 0 | Компиляция меню, callback и dependency graph. |
| `pnpm --filter @online-school/ui test` | 0 | 133 unit-теста. [Лог](unit.log) |
| `pnpm --filter @online-school/ui test:locale:types` | 0 | Typed keys и обязательные параметры. |
| `pnpm --filter @online-school/ui lint` | 0 | ESLint и Stylelint, 715 прежних legacy declarations, новых и stale записей нет. |
| `pnpm --filter @online-school/account-ui lint` | 0 | ESLint меню и транспорта. |
| `pnpm exec eslint apps/manager-web/src/components/layout.tsx apps/manager-web/src/pages/Login.tsx apps/manager-web/test/manager.spec.mjs apps/platform/src/App.tsx apps/platform/test/account-chrome apps/student-cabinet/src/Layout.tsx apps/student-cabinet/src/components.tsx apps/student-cabinet/src/pages/Account.tsx apps/student-cabinet/src/StudentNotificationMenu.tsx --max-warnings 0` | 0 | Адресная проверка изменённых consumers. Финальный browser script также отдельно проверен ESLint. |
| `pnpm --filter @online-school/platform --filter @online-school/student-cabinet --filter @online-school/manager-web typecheck` | 0 | Три существующих приложения. |
| `pnpm --filter @online-school/platform test:account-chrome` | 0 | 15 браузерных сценариев, включая 8 парных кадров. [Лог](browser.log), [сценарии и бюджет](browser.json) |
| `pnpm --filter @online-school/ui test:locale:browser` | 0 | 11 сценариев общего входа, reload, cross-tab и denied storage. [Результат](login-smoke.json) |
| `pnpm --filter @online-school/manager-web exec playwright test test/manager.spec.mjs -g 'logout clears every cache' --reporter=line --output D:/OnlineSchool/output/k8k-tasks/TASK-015/manager-browser` | 0 | Один адресный сценарий с подавлением позднего пароля и очисткой всех кэшей при выходе. Использован существующий mock server. [Лог](manager-smoke.log) |
| `pnpm --filter @online-school/ui build:storybook` и `check:storybook` | 0 | Свежая сборка, 42 истории, 39 экспортов компонентов с alias. [Лог сборки](storybook-build.log) |
| `pnpm --filter @online-school/ui test:storybook` | 0 | Все 42 истории, девять VIS-11 на двух языках и четырёх ширинах, keyboard и a11y smoke. [Результат](storybook-smoke.json), [лог](storybook-smoke.log), [покрытие](storybook-coverage.json) |

Browser harness строит platform и fixture в памяти с `envDir: false`. Все запросы перехвачены. Каталог и session/read ответы синтетические. Для switch и logout проверяется наличие CSRF header, без записи значения в артефакты. Неожиданных внешних обращений и browser errors нет. Sentinel запрос заблокирован. Проверены pending, unknown, запрет demo и forbidden body. Смена языка сохраняет route, section, значение выбранного объекта, черновик и число команд. Успешный demo switch и logout проверены с двумя вкладками и сохранённым RO.

Общий bundle platform составил 137 454 из 256 000 байт по методу K8K v2 с тремя локальными шрифтовыми подмножествами. Это адресное измерение, полная матрица 48 маршрутов в этой задаче не повторялась.

## Визуальные доказательства и приёмка

Рендерились настоящий AppShell и AccountMenu с синтетическими именами и каталогом на `/fixture?ui.k8k=1&role=STUDENT&section=homework`. Для пяти ролей отдельно проверены соответствующие пункты navigation на обоих языках. На реальном маршруте `/teacher?ui.k8k=1&section=homework` проверено сохранение активного раздела. Снимки меню и bottomnav сняты на 360/768/1024/1280.

[RO 360](screenshots/student-ro-360.png) · [RU 360](screenshots/student-ru-360.png) · [RO 1280](screenshots/student-ro-1280.png)

| Критерий | Статус |
|---|---|
| Обе локали системных подписей оболочки, контролов и account menu | PASS |
| Bottomnav и меню без горизонтального переполнения на четырёх ширинах | PASS |
| Language switch сохраняет сессию, route, section, черновик и выбранный объект | PASS |
| Escape возвращает фокус из account и mobile navigation menus | PASS |
| Blocked storage работает в памяти | PASS |
| Один LanguageSelector и один набор account actions | PASS |
| Pending/unknown без повторной команды, demo disabled скрывает выбор | PASS |
| Очистка CRM-кэша и broadcast соседней вкладке | PASS |
| Dependency graph и lockfile | PASS |
| HEAD/dirty digest, журнал и предметная матрица | PASS |
| Реальные DB/provider/MFA, полная WCAG/AT, общий финальный gate | NOT_RUN |

Ролевое содержимое, MFA-ветки и доменные ошибки продолжаются в соответствующих задачах. TASK-016 получает прежние `ClientError.status/code`, typed keys и unknown-result отображение AccountMenu. TASK-033 получает оставшиеся подписи ссылок источников уведомлений и его доменные ошибки. Остатки ролевых экранов перечислены в `literal-inventory.md`. Изменение обратимо адресным diff к словарю, chrome, account-ui и workspace importer.
