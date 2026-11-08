TASK: TASK-012
Статус: DONE
Дата: 04.11.2026
Основа: HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design`, dirty digest `8bb7a93eb06760bade794be6cb2763bf4eb62ec6bc512b20053ed464e15d1b49`.
Source digest: `0b5f9cb5c4e4420f4f5e3e8b71af520aa2df8f44bf37734fd85a195bead44c9e`.

Подтверждён 501 исходник TASK-011. Перед правками сохранены 505 копий и бинарный diff.
После обновления журнала совпали 508 входов принятого прогона и девять защищённых артефактов.
[Сверка основы](preservation.json)

## Что уже существовало

BoundaryState уже описывал девять статусов. QueryState ученика, State менеджера и
StateBoundaryAdapter платформы использовали общую классификацию в режиме K8K. Слот children
уже позволял сохранить дерево. Свежесть отображалась одной подписью at, а тексты границы
были на русском. Словарь этапов уже существовал в SDK.

## Что изменено

- packages/ui/src/state.tsx выводит все девять состояний через locale store. Skeleton, EmptyState,
  ErrorState и StaleBanner используют общий union. При ошибке или старении пустого кэша stale.empty
  описывает предыдущий ответ и текущую неизвестность. RetryRead доступен у stale/error.
  Pending и unknown не предлагают повтор команды или контекстное действие.
- packages/ui/src/freshness.tsx выводит server asOf и client receivedAt раздельно. Старый at
  совместим как receipt. Отсутствующее или некорректное время не заменяется текущим.
  Подпись не меняет refresh policy и не подтверждает бизнес-операцию.
- Manager, Student и Platform передают отдельные источники через действующие adapters.
  Student использует generatedAt, когда он есть, и dataUpdatedAt. Manager и Platform передают receipt.
  При 401/403 и наличии кэша denial имеет приоритет. Legacy adapters также снимают данные.
  Platform сохраняет прежний редирект и выставляет состояние 401 до него.
- packages/ui/src/stages.tsx отображает три качественных этапа, текущий aria-current и
  нейтральное NOT_STUDIED. Компонент не изменяет server enum и не вычисляет оценку.
- Stories и локальный fixture проверяют состояния, повторное чтение, переходы и фокус.
  Целевое доказательство DOM сравнивает исходный узел поля, его фокус и введённое значение.

## Контракты, SDK и миграции

[Props и следующий потребитель](handoff.md) · [Проект контракта](design-note.md)

Доменный status store, SDK, DTO, миграции и команды не изменялись. Существующие авторизованные
children при subscription-limited сохраняются. Выбор разрешённых предметов остаётся
за read-model. Новых зависимостей нет. Lockfile побайтно совпадает с TASK-011.

## Источники и решения

TASK-012 §§5–8, VIS-06 и VIS-11, действующие разделы 2–7 K8K_DESIGN_INSTRUCTIONS.md.
Приоритеты ACL, неавтоматический выбор этапа и серверные решения сохранены.
RO boundary использует общий локализованный текст ошибки. Предметные переводы wire codes
относятся к TASK-016.

## Проверки

| Команда | Exit | Результат |
|---|---:|---|
| pnpm --filter @online-school/ui build | 0 | Сборка UI |
| pnpm --filter @online-school/ui test | 0 | [129 тестов](ui-test.log) |
| pnpm --filter @online-school/ui lint | 0 | [16 CSS файлов и ESLint](ui-lint.log), 715 прежних legacy записей |
| pnpm --filter @online-school/manager-web typecheck:ui-states | 0 | [Строгая типизация fixtures и adapters](typecheck.log) |
| pnpm --filter @online-school/platform exec tsc -p tsconfig.json --pretty false | 0 | Типизация Platform |
| Адресный ESLint приложений, fixture и helper | 0 | [Точная команда](checks.json) |
| pnpm k8k:states:evidence | 0 | [34 сценария и 16 снимков](evidence.log) |

60 GET подменены на loopback. Неожиданных сетевых запросов и ошибок браузера не было.
Manager State и Student QueryState проверены с cached denial в K8K и legacy режимах.
Platform проверен адресной типизацией и сборкой. БД, провайдеры, миграции и production не затронуты.

## Визуальные доказательства

[Галерея](runs/2026-11-04T05-14-33.552Z/gallery.html) · [Сценарии и хеши](runs/2026-11-04T05-14-33.552Z/visual.json)

Локальный manager UI fixture покрывает все девять состояний и переходы на RU/RO при
360, 768, 1024 и 1280. Просмотрены RO каталог и RU черновик с неизвестным результатом.
На снимках видны два источника времени, нейтральные этапы и сохранённый фокус.

## Бюджет

48/48 маршрутов ≤ 256000 байт. Максимумы manager 248669, student 208344, platform 133829.
Каждый маршрут включает 63492 байта локальных WOFF2. Optional manager passkey 187139.
[Таблица v2](runs/2026-11-04T05-14-33.552Z/bundle.md) · [Manifest](runs/2026-11-04T05-14-33.552Z/bundle.json)

## Acceptance checklist

| Критерий | Статус | Доказательство |
|---|---|---|
| Cached 403 скрывает children | PASS | 401/403 после кэша, узел редактора, действие и freshness удалены |
| Loading отделён от empty | PASS | Удержанный GET и отдельный empty read |
| Stale empty отмечен stale | PASS | Старый пустой ответ после 503 |
| Unknown отделён от success | PASS | Текст неизвестности, повтор команды отсутствует |
| Черновик переживает refetch | PASS | Тот же узел, фокус и текст при реальном refetch и stale/pending |
| Все девять классов RU/RO | PASS | Каталог и визуальная матрица четырёх ширин |
| Freshness provenance | PASS | Два distinct instants, неизвестность и alias at |
| StagesTrack | PASS | Три этапа, один current, нейтральный NOT_STUDIED |
| Сохранение основы и учёт | PASS | Хеши, журнал, матрица и handoff |

## Не проверено, остатки и обратимость

NOT_RUN: полный WCAG/AT, Storybook runtime, производственные роли, БД, провайдеры,
FND-GATE, LEGAL/FIN-LEGAL и Meet/G4. Runtime относится к TASK-013, предметные ошибки
к TASK-016, авторитетные навыки к TASK-031/043.

Откат ограничивается изменениями из preservation.json и резервными копиями before/.
