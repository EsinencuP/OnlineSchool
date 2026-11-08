# TASK: TASK-014

Статус: **DONE** в объёме контракта локализации и форматирования. Дата 04.11.2026.

Основа: HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design`, dirty digest `d3fa9d6b4d0c94260def5a87abc476c69eef4ba8b4ba7de49605ec3a50566393`. Текущая ветка, предыдущие изменения и архивы сохранены. Lockfile побайтно совпадает с TASK-013. [Basis](basis.json)

## Что уже существовало

Один store `k8k.locale` на localStorage, селектор общего входа, частичный RU/RO-словарь, Storybook TASK-013 и унаследованный timezone для FreshnessLabel. Форматирование денег в CRM уже использовало Decimal и BigInt. В TASK-014 эти механизмы расширены и проверены заново.

## Что изменено

- `packages/ui/src/messages.ts` сохраняет прежние ключи и добавляет пространства `auth.*` и `validation.*`. `MessageKey`, `MessageArgs<K>` и `translate(locale, key, ...args)` типизируют ключи и параметры. TypeScript сравнивает полный набор ключей и имена плейсхолдеров обеих локалей. Нетипизированный неизвестный ключ возвращается как безопасный текстовый маркер. Значение подстановки вставляется буквально.
- `packages/ui/src/locale.tsx` сохраняет один store и ключ `k8k.locale`. `initializeLocale()` вызывается до React в platform, student-cabinet и manager-web. Store обновляет `html.lang`, подписывается на localStorage при первом потребителе, снимает слушатель при уходе последнего и перечитывает значение при новой подписке. При недоступности storage выбор живёт в памяти документа. Неизвестное значение и удаление ключа возвращают RU.
- `packages/ui/src/format.ts` добавляет `formatDate`, `formatDateTime`, `formatTime`, `formatDateOnly` и `formatRelativeTime`. Instant принимает timestamp или ISO со смещением и явный timezone. Civil date проверяется и форматируется в UTC независимо от зоны браузера и пользователя. `intlLocaleFor` сопоставляет RU/RO с `ru-MD` и `ro-MD`. DatePicker и FreshnessLabel переиспользуют форматтеры, сохраняя календарную навигацию и источники времени.
- `packages/ui/src/money-format.ts` форматирует целую часть через BigInt и сохраняет все значащие цифры дробной части. Общие RU/RO-вызовы показывают код валюты. `apps/manager-web/src/lib/money.ts` переиспользует этот форматтер, сохраняя существующие Decimal до четырёх знаков, `ru-RU` и обозначение валюты в CRM.
- `apps/platform/src/App.tsx` подключает typed labels общего входа, состояния загрузки, ошибки и подсказки валидации, accessible descriptions и заголовок документа. Встроенные HTML-ограничения по-прежнему блокируют отправку. Переключение языка сохраняет введённые поля и имена из синтетического каталога. Account menu, session и MFA остаются в существующих границах.
- В Storybook добавлены причины исключения новых функций из component coverage. Истории и публичные props компонентов сохранены.

## Контракты и источники

DTO, SDK, маршруты, миграции и доменные правила не изменены. Использованы TASK-014 §§5–10, K8K Design §3.2, VIS-06/B и VIS-11/B. Выбор языка отделён от зоны пользователя. Денежный форматтер работает с исходной строкой без преобразования суммы в бинарное число. [Design note](design-note.md) · [ECMA-402](https://tc39.es/ecma402/)

## Проверки

| Команда | Exit | Сценарии |
|---|---:|---|
| `pnpm --filter @online-school/ui build` | 0 | Компиляция UI и проверка parity словарей и плейсхолдеров. |
| `pnpm --filter @online-school/ui test:locale:types` | 0 | TypeScript отклоняет неизвестный ключ, язык, отсутствующий или неверный параметр. |
| `pnpm --filter @online-school/ui test` | 0 | 133 теста. В новых тестах проверены диакритика, RO plural 1/2/20, date-only, обе стороны DST overlap, отсутствующая зона, большая сумма с 18 дробными знаками и код валюты. [Unit log](unit.log) |
| `pnpm --filter @online-school/ui test:locale:browser` | 0 | 11 сценариев на реальном bundle platform с изолированными GET fixtures. RU/RO, клавиатурный выбор, фокус и описание ошибки, исходное имя, reload и полная навигация, двусторонний cross-tab, удаление и неизвестный язык, denied storage. Сетевой sentinel заблокирован, login writes 0. Маршрут общего входа 135 864 из 256 000 байт по методу K8K v2. [Browser](browser.json) |
| `pnpm --filter @online-school/ui lint` и `pnpm exec eslint apps/platform/src/App.tsx apps/platform/src/main.tsx apps/student-cabinet/src/main.tsx apps/manager-web/src/main.tsx apps/manager-web/src/lib/money.ts --max-warnings 0` | 0 | ESLint и Stylelint. Legacy CSS allowlist сохранён, новых и устаревших записей нет. |
| `pnpm --filter @online-school/platform --filter @online-school/student-cabinet --filter @online-school/manager-web typecheck` | 0 | TypeScript трёх приложений. |
| `pnpm --filter @online-school/manager-web exec vitest run src/test/forms.test.tsx` | 0 | Семь тестов CRM, включая существующее представление денег и сохранение точной строки формы. |
| `pnpm --filter @online-school/ui build:storybook`, `check:storybook`, `test:storybook` | 0 | Свежая сборка, 42 истории, 39 публичных экспортов компонентов с alias. Повторный smoke DatePicker/FreshnessLabel, клавиатуры и VIS-11 на RU/RO × 4. [Сборка](storybook-build.log) · [Smoke](storybook-smoke.json) |

Первый параллельный `test:storybook` завершился кодом 1 по таймауту менеджерского iframe. Изолированный iframe открыл Ready, затем отдельный полный прогон завершился кодом 0. [Лог повторного прогона](storybook-smoke.log)

## Визуальные доказательства

Общий вход platform на `/` и `/account`, сессия отсутствует. Синтетические GET fixtures каталога и текущей сессии. Сохранено восемь PNG для RU/RO на 360/768/1024/1280. Длинные румынские подписи видимы без горизонтального переполнения. [RO 360](screenshots/login-ro-360.png) · [RU 360](screenshots/login-ru-360.png) · [RO 1280](screenshots/login-ro-1280.png)

## Acceptance checklist

| Критерий | Результат |
|---|---|
| Одинаковые ключи и параметры, неизвестный ключ и язык | PASS |
| Румынские формы plural и диакритика | PASS |
| Blocked storage работает в памяти | PASS |
| Reload, полная навигация и cross-tab в одном origin | PASS |
| Date-only сохраняет день, instant использует переданную зону | PASS |
| Точная большая decimal сумма и совместимость CRM | PASS |
| RU/RO × 4 ширины, клавиатура, длинные подписи и accessible validation | PASS |
| Журнал и матрица, доказательства привязаны к HEAD и dirty digest | PASS |
| Вход с действующей сессией, MFA/provider/DB, полная ролевая локализация, WCAG/AT и общая матрица бюджетов | NOT_RUN в рамках адресного задания |

## Остатки, риски и обратимость

TASK-015 получает `useLocale().t`, `translate`, `MessageKey`, `MessageArgs<K>` и `LanguageSelector` из `@online-school/ui`. Полный перевод account chrome и отдельных экранов сохраняется в соответствующих заданиях. TASK-066 получает локализованный общий вход с теми же auth-ветками. Legacy CRM продолжает использовать существующее представление сумм. Зависимости не добавлены. Изменение обратимо отдельным diff к словарю, store, форматтерам, точкам инициализации и общему входу.
