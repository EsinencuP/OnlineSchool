# TASK-021 — владельцы чтений K8K

Интервалы 60 с для оперативных данных, 15 с для открытой карточки урока и 120 с для предупреждения о возрасте оперативного снимка — инженерные значения до приёмки. Во всех группах сохраняются загрузка при входе, ручные чтения и адресная инвалидация после команды. Фоновые чтения выбирают только активные ключи. Проверки прав остаются на штатном пути SDK и сессии.

| Приложение и ключ/GET | Контекст | Владелец фонового чтения | Свежесть |
|---|---|---|---|
| Student `['student','me']`, `suspended-me` | Сессия, доступ к кабинету | TanStack focus/reconnect, `me` с существующими 60 с | Ошибки сессии обрабатываются до приватного DOM |
| Student `dashboard`, `upcoming`, `lessons` (кроме архивного списка), `calendar` | Следующий урок, расписание и существующий календарь | `StudentLayout`, 60 с; карточка следующего урока передаёт сигнал T−10 этому же владельцу | `dashboard.generatedAt` отдельно от `dataUpdatedAt`; остальное с временем получения; operational stale |
| Student `unread`, `notifications-preview`, `notifications` | Колокольчик | `StudentLayout`, 60 с для наблюдаемых включённых ключей | Состояние списка и время получения в открытом колокольчике |
| Student `['student','lesson',id]` | Открытая карточка | Отдельная группа `StudentLayout`, 15 с | Время получения; stale блокирует действие Meet через существующую проверку |
| Student `homework`, `homework-detail`, `recent-homework`, `skills`, `snapshots`, `skill-history`, `materials`, `reports`, `subscription`, `payments`, `ledger`, архивный список, `sessions` и прочие | ДЗ, опубликованное, история, деньги, настройки | Загрузка по ключу, ручное чтение или адресная инвалидация | Снимок по ответу; существующие реакции на ошибки и доступ |
| Manager `['manager','me']` | Вход и сессия | TanStack, при наличии подписчика | Состояние доступа в существующем route guard |
| Manager `dashboard`, `tasks`, `leads`, `lead-summary`, `schedule` | Оперативные списки CRM | `ManagerLayout`, 60 с | `dashboard.generatedAt` и получение отдельно; для остальных получение и operational stale |
| Manager `['manager','notifications',studentId,status,cursor]` | Текущая страница с `QUEUED` | Компонент `Notifications`, 60 с, пока есть `QUEUED` | Получение и stale; статус доставки берётся из ответа |
| Manager `lead`, `task`, `students`, `student`, `subscriptions`, `payments`, `distributions`, `ready-distributions` и прочие | Карточки, справочные и финансовые выборки | Загрузка по ключу, ручное чтение или адресная инвалидация | Существующие состояния запроса и команды |
| Platform `GET /api/v1/auth/session`, каталог аккаунтов | Вход, смена роли и сессии | `App` и `AccountMenu` по своему lifecycle | Проверки actor/role/MFA прежние |
| Platform `getPlatformWorkspace` | Рабочее пространство преподавателя и директора | `StaffCabinet`, 60 с, через существующий reload | `actorContext.asOf`, время успешного получения, stale |
| Platform `getPlatformWorkspaceDetail(section,id)` | Адресуемая staff-карточка | Активный `StaffDetail` по сигналу того же `StaffCabinet`, самостоятельный read retry | `actorContext.asOf`, время получения, stale; 403/404 скрывают данные |
| Platform `currentSession` → `getComponentStatus` | Проверка доступа оператора перед health read | `StaffCabinet`, 60 с; session preflight выполняется перед каждым таким чтением | Время получения health и stale |

В Student и Manager TanStack focus, reconnect и интервалы для K8K non-auth отключены на уровне запросов. Группы с одним владельцем объединяют focus, visibility, online и тик таймера. `refetchQueries` и `refetch` используют `cancelRefetch:false` для уже выполняющегося чтения. После фоновой паузы из-за ввода или диалога восстанавливается один ожидающий запрос. На смене кабинета или размонтировании слушатели и таймеры снимаются. Наследуемые пути с выключенным K8K сохраняют прежний режим.

`dataUpdatedAt` и `Date.now()` фиксируют успешное получение на клиенте. `generatedAt` и `actorContext.asOf` приходят от источника. Если контракт источника не содержит общего времени снимка, интерфейс показывает только получение. Ошибка источника или превышение возраста при наличии кэшированного снимка приводит к `stale`, в том числе при пустом списке. 401/403 имеют приоритет. Состояния оплаты, проведения, эскалации и eligibility определяются их серверными ответами.
