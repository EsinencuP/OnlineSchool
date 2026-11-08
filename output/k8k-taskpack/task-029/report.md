# TASK-029

Статус DONE в локальном объёме задания, 08.11.2026.

Основа HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, ветка
`feat/k8k-design`, 403 исходные status-записи, dirty digest
`82e1b71a09fa429ab65f7ef6b10e2e51fa8846964985fa444c9ac4cb33d63bc7`.
38 исходных файлов сохранены в before. Исходные пути присутствуют, 31 SHA-256
миграций сохранены. [Сохранность](../../k8k-tasks/TASK-029/preservation.json)

## Исходная реализация

TASK-024 и TASK-028 имеют реальные локальные артефакты DONE и проверены по коду.
List/calendar/detail, серверные history/dispute и перенос существовали.
History UI отсутствовал, detail не читал факты списания и связанные ресурсы.
Форма переноса имела только RU-текст. Календарь ограничивался 62 строками,
не предлагал список выбранного месяца после overflow. Возврат терял контекст.
При неизвестном исходе не было адресного чтения результата.
[Проектирование до правок](../../k8k-tasks/TASK-029/design-note.md)

## Что изменено

- `apps/student-cabinet/src/pages/Lessons.tsx` сохраняет URL period/view/month/page,
  предмет и historyPage. Календарь и список используют один lesson source.
  Overflow ведёт на постраничный список того же месяца с настоящим server total.
  История — единый хронологический раздел без status-tabs.
- Карточка читает свой history fact по lessonId. Назначенный преподаватель
  остаётся в плане, фактический и duration приходят из подтверждённой истории.
  Время до переноса берётся из original_scheduled_at. ДЗ и материалы читаются
  через существующие scoped projections с pagination.
- `lesson-requests.tsx` использует kit Dialog/Button/Field, ограничения текста,
  server canRequestReschedule/canDispute, один ключ и синхронную защиту от double
  submit. 201 показывает crmTaskId. Плановый урок и право сохраняют своё значение.
  Timeout сохраняет UNKNOWN, включая закрытие формы и reload.
- Только UUID незавершённого намерения хранится в actor/lesson/type sessionStorage.
  Текст формы остаётся в памяти. Успех, явный отказ и session teardown удаляют UUID.
  UNKNOWN допускает только GET-проверку по исходному ключу. Отсутствие receipt
  не создаёт новую команду. Type явно выбирает namespace команды.
- `lesson-copy.ts` содержит RU/RO подписи и объяснения. `lesson-navigation.ts`
  разрешает backTo только внутри расписания. Dialog возвращает фокус.
  Ролевой scope перенесён в portal для 48px главного действия.
- `api.ts` перевычитывает history/resources при входе, очищает snapshots
  истории после 403. Существующий session transport отбрасывает late response.
  `router.tsx` сохраняет scroll context расписания.
- API переиспользует lesson/history/homework/material services, прежние транзакции
  переноса/спора, guards, CSRF и idempotency. Новый GET receipt читает существующую
  CRM task по owner, lesson, command type и стабильному ключу.

## Контракт и источники

Добавлены optional LessonCardDto.subjectId/originalScheduledAt и шесть optional
query parameters для lesson list/history и lesson resources. Новый
getStudentLessonRequestResult добавляет одну GET operation и LessonRequestResultDto.
146 существующих операций сохранены, всего 147. Их request bodies, response
contracts и required fields сохранены. Общая пагинация отделена от
LessonHistoryQueryDto/Pipe, поэтому соседние reports/skills API не расширены.
[Контракт](../../k8k-tasks/TASK-029/contracts.json)

OpenAPI и SDK созданы штатными export:openapi → generate:client с no-db preload
TASK-018. Новых dependencies и миграций нет. Порядок rollout API/SDK → UI,
старый сервер отклонит новые query parameters до обновления.
[Генерация](../../k8k-tasks/TASK-029/generate.log) · [SDK](../../k8k-tasks/TASK-029/sdk-check.log)

Применены TASK-029 §§3/5/6, решения №10.3/C, №10.6/A, №10.7/B, design §5.1/5.2,
CON-02/B и актуальная PHASE0_CHECKS. COMPLETED требует подтверждённого outcome.
NO_SHOW требует explicit confirmed report. Существующий approved CANCELLED
опирается на опубликованное количественное списание. Текущие балансы не
подставляются вместо неизвестных исторических снимков.

## Свежие проверки

Точные команды, безопасный Vite stdin и параметры no-db экспорта сохранены
в [verification.json](../../k8k-tasks/TASK-029/verification.json).

| Проверка | Exit | Результат |
| --- | --- | --- |
| API typecheck | 0 | [API build](../../k8k-tasks/TASK-029/api-build.log) |
| OpenAPI/Orval/SDK typecheck | 0 | [Генерация](../../k8k-tasks/TASK-029/generate.log), [SDK](../../k8k-tasks/TASK-029/sdk-check.log) |
| `pnpm test:stu03 --roots tests` | 0 | 84 tests, [lessons](../../k8k-tasks/TASK-029/lessons.log) |
| `pnpm test:stu04 --roots tests` | 0 | 47 tests, [history](../../k8k-tasks/TASK-029/history.log) |
| `pnpm test:student-lesson-context` | 0 | 4 tests, [resources](../../k8k-tasks/TASK-029/resources.log) |
| `pnpm test:stu02 --roots tests` | 0 | 38 tests, [Meet regression](../../k8k-tasks/TASK-029/dashboard.log) |
| Student typecheck/Vite build | 0 | [Student build](../../k8k-tasks/TASK-029/student-check.log) |
| Student и адресный API/test ESLint | 0 | [Student](../../k8k-tasks/TASK-029/student-lint.log), [API](../../k8k-tasks/TASK-029/api-lint.log) |
| `pnpm --filter @online-school/student-cabinet test:presentation` | 0 | 11 tests, [presentation](../../k8k-tasks/TASK-029/presentation.log) |
| `pnpm --filter @online-school/student-cabinet test:lesson-journey` | 0 | 12 Chromium cases, [лог](../../k8k-tasks/TASK-029/browser.log), [JSON](../../k8k-tasks/TASK-029/playwright.json) |
| `node scripts/k8k-refresh-budget.mjs --task-029` | 0 | 50/50, [бюджеты](../../k8k-tasks/TASK-029/budgets.json) |
| Контракт, сохранность, artifact links и scoped diff | 0 | [Контракт](../../k8k-tasks/TASK-029/contracts.json), [сохранность](../../k8k-tasks/TASK-029/preservation.json), [артефакты](../../k8k-tasks/TASK-029/artifacts-check.json), [diff](../../k8k-tasks/TASK-029/diff-check.log) |

Build использовал envDir=false/publicDir=false/emptyOutDir=false.
Source budget build использовал configFile=false/envDir=false/publicDir=false/
write=false. Student route 237987 байт по методу v2 с локальными Golos subsets.
Максимум 255923 при лимите 256000 байт. Полный recursive regression отложен
по политике владельца.

API/HTTP прогоны используют mock Prisma и настоящий Nest routing. Проверены DST
23/25 часов, недели 167/169 часов, local midnight, 24h и 24h−1ms, точные 30 суток
и +1ms, same-key 201 и другой payload 422, открытый case 409, restored right,
legacy null, точные Decimal quantities, own/foreign scope и no-store.
Проверка SQL означает проверку сформированных запросов и mock-результатов.
Выполнение SQL в PostgreSQL имеет статус NOT_RUN.

Первые прогоны выявили неоднозначный test selector поля, ожидание страницы до
завершения GET, специфичность 44px кнопки в portal и перенос UNKNOWN между
fixture-сессиями с одинаковым actor. Эти случаи исправлены. Контрактная сверка
обнаружила наследование DTO пагинации соседними API, затем фильтры были изолированы.
Финальные проверки завершились успешно.

## Визуальные доказательства

Student, локальный синтетический fixture, внешние запросы блокируются.
RU/RO × 360/768/1024/1280, календарь, история, detail и обе формы.
40 матричных снимков и три снимка overflow/unknown/forbidden.
Проверены 100-символьные имена, сохранение ввода, Tab/Enter/Escape,
возврат фокуса, 48px primary и отсутствие горизонтального overflow.

[RO перенос 360](../../k8k-tasks/TASK-029/after/ro-360-reschedule.png) ·
[RU спор 360](../../k8k-tasks/TASK-029/after/ru-360-dispute.png) ·
[RU detail 1280](../../k8k-tasks/TASK-029/after/ru-1280-detail.png) ·
[RO overflow](../../k8k-tasks/TASK-029/after/ro-overflow-page2.png) ·
[Unknown](../../k8k-tasks/TASK-029/after/ro-unknown.png) ·
[Forbidden](../../k8k-tasks/TASK-029/after/ru-history-forbidden.png)

## Acceptance checklist

| Критерий TASK-029 | Статус |
| --- | --- |
| Общий calendar/list source и сохранённый query context | PASS |
| История подтверждённых фактов и точных quantity snapshots | PASS для source/mock/UI |
| Только server capabilities, адресные CRM tasks | PASS |
| 24h/30days, replay/conflict/unknown | PASS для local mocks/browser |
| Просмотр и формы не меняют attendance/ledger/refund/rights | PASS для read-only source и mock assertions |
| RU/RO, четыре viewport, focus/input/scroll context | PASS |
| Источники реальны, синтетические fixtures обозначены | PASS |
| Исходное поведение и свежие проверки различены | PASS |
| Исходные пути и migration checksums сохранены | PASS |
| PostgreSQL execution и реальные transaction/index races | NOT_RUN |
| Полный ролевой/phase gate, production CRM, Meet OAuth/POC/G4 | NOT_RUN |

Машинные критерии и ссылки находятся в
[acceptance.json](acceptance.json).

## Передача и обратимость

TASK-030 продолжает ДЗ, TASK-031 — библиотеку материалов, TASK-035 — ролевую
приёмку. Их работа автоматически не начиналась. Общая библиотека сохраняет
оставшиеся задачи локализации и file workflow. Для реальной БД и provider/gate
нужен отдельно разрешённый target и безопасный сценарий.

Rollback ограничивается diff TASK-029 относительно before с сохранением исходного
dirty дерева. Новые metadata fields optional, доменные команды прежние.
Документы не объявляют FND-GATE, LEGAL/FIN-LEGAL или production GO.
[Передача](../../k8k-tasks/TASK-029/handoff.md)
