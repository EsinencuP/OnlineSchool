# Команды владельца

Введите Skill в чате Codex для этого репозитория или выполните эквивалент из корня. В PowerShell символ `$` относится к названию Skill в чате, а запуск в терминале начинается с `node`.

| Skill | Команда после `node qa/scripts/qa.mjs` | Результат |
|---|---|---|
| `$student` | `run student_agent` | Независимый отчёт ученика |
| `$teacher` | `run teacher_agent` | Независимый отчёт преподавателя |
| `$manager` | `run manager_agent` | Независимый отчёт менеджера |
| `$director` | `run director_agent` | Независимый отчёт руководителя |
| `$qa-engineer` | `run qa_engineer` | Технический аудит |
| `$qa-cycle` | `cycle` | Пять аудитов, сведение и пакет разработки |
| `$qa-retest` | `retest <cycle-id>` | Проверка исправлений и регрессии |
| `$qa-status` | `status` | Циклы, одиночные проверки, дефекты и риски |
| `$qa-fix` | `packet <cycle-id>` | Пакет принятой работы. Skill делегирует реализацию Developer Agent |

Пример полного запуска `$qa-cycle --gate STUDENT-GATE --build qa/fixtures/build.json`. `--gate` задаёт этап матрицы. По умолчанию RELEASE-GATE. `--build` переопределяет локальный manifest. Для установочной проверки передайте `--self-test` в `run` или `cycle`. Новому чату Codex доступны загруженные Skills. Псевдонимы `/prompts:…` не установлены.

## Передача и ретест

1. Откройте `DEVELOPER_HANDOFF.md` из завершённого аудита, просмотрите первичные доказательства. Для каждой выбранной карточки запишите `TRIAGED` и `ACCEPTED` через `node qa/scripts/qa.mjs transition <cycle-id> <defect-id> <status> "<основание>"`. `REJECTED` регистрирует ложное срабатывание, `DEFERRED` требует решение владельца о принятом риске.
2. Вызовите `$qa-fix <cycle-id>`. После получения разрешённого commit сохраните локальный `fix.json` по [образцу](fixtures/fix.json.example). Укажите commit, ID и результат проверок разработчика. Для технической карточки, которой нужен браузер, можно передать `"browser_roles": {"<defect-id>": "student_agent"}`. У ролевой карточки её исходная роль используется по умолчанию.
3. Запишите исправление через `node qa/scripts/qa.mjs submit-fix <cycle-id> qa/fixtures/fix.json`. Отправка переводит каждую принятую карточку в READY_FOR_RETEST с сохранением промежуточных событий.
4. Обновите marker и локальный manifest до сборки, содержащей fix commit. Вызовите `$qa-retest <cycle-id> --build qa/fixtures/build.json`. Независимый QA Engineer проверит исходные действия и регрессию. При недоступном сценарии карточка остаётся READY_FOR_RETEST, а причины сохраняются в отчёте.
5. Смотрите `$qa-status` и независимые отчёты. Допуск к выпуску остаётся отдельным решением владельца.
