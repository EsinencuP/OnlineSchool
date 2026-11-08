# K8K — журнал последовательного выполнения

Все исходные статусы исполнения NOT_STARTED. Частично существующий код не является выполненным TASK. Допустимые итоговые статусы: DONE/PARTIAL/BLOCKED; IN_PROGRESS — работа начата. Таблица обновляется только по факту, не генерацией старых результатов.

| TASK | Название | Выполнение | Commit/dirty digest | Отчёт/блокер |
|---|---|---|---|---|
| [TASK-001](TASK-001.md) | Сохранить рабочую основу и восстановимый снимок | DONE | `171db2142858e035594737e141d422fa5378e844` / `d716b9262ca859e0048d46b563872d9690026089eb1cb53b28f453555044ee76` | [Отчёт](../../output/k8k-tasks/TASK-001/report.md): 25 tracked + 145 untracked; binary patch и восстановление 170 файлов; повторный снимок сохраняет предыдущие |
| [TASK-002](TASK-002.md) | Полный инвентарь маршрутов, форм, команд и источников | DONE | `171db2142858e035594737e141d422fa5378e844` / `7004c02408417244f0008373cd1be12d2835a70ab32f577bd1a9324019648bc2` | [Отчёт](../../output/k8k-tasks/TASK-002/report.md), [инвентарь](../../output/k8k-tasks/TASK-002/inventory.md):48 URL/поверхностей,89 используемых SDK operations,59 write refs;28 VIS12+7 дополнительных строк; статический аудит, не UI/DB gate |
| [TASK-003](TASK-003.md) | Воспроизводимая baseline-матрица экранов и состояний | DONE | `171db2142858e035594737e141d422fa5378e844` / `b6821f156103220df0bb2f8347db889ad00a399fb611191bba4578493c7dd36d` | [Отчёт](../../output/k8k-tasks/TASK-003/report.md), [INDEX](../../output/k8k-tasks/TASK-003/runs/2026-11-03T20-50-31-027Z-8bc616/INDEX.md):48/48 surfaces RU/RO×4 ширины×2 прохода;2128 PNG,1064 сравнения;124 overflow,16 явно неприменимых health-empty NOT_RUN; UI gate не закрыт |
| [TASK-004](TASK-004.md) | Бюджеты маршрутов и адресный реестр дефектов | DONE | `171db2142858e035594737e141d422fa5378e844` / `35000c52207a367a478c67f1e221a20dd3d038654d36ee41bb5892c7903fc58b` | [Отчёт](../../output/k8k-tasks/TASK-004/report.md), [route budgets](../../output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/bundle.md), [74 OPEN defects](../../output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/defects.md).48/48≤256000; max238089; историческая delta unavailable, gates не закрыты |
| [TASK-005](TASK-005.md) | Токены, семантический контраст и Stylelint | DONE | `171db2142858e035594737e141d422fa5378e844` / `cea448a53cb0f9d5e2fde7356e019fcdb3bf9e612d8e448ea735e64b50275280` | [Отчёт](../../output/k8k-tasks/TASK-005/report.md): 25 пар с culori, 17 порогов, Stylelint/CI, 715 точных legacy entries; 98 UI tests; 16 PNG; 48/48 budgets PASS, +147…160 байт. Палитра provisional |
| [TASK-006](TASK-006.md) | Типографика, локальный Golos и единый Icon | DONE | `171db2142858e035594737e141d422fa5378e844` / `59e4a81081966a3b5f6c4fa0eaeccc04585d102987cf79765f226de3556049c3` | [Отчёт](../../output/k8k-tasks/TASK-006/report.md): RO subset3544, fonts63492;103 UI tests,32 PNG loaded/fallback, AX/Avatar;48/48 budgets v2 PASS max241999 |
| [TASK-007](TASK-007.md) | Завершить Button, Field, Select, StatusChip и Avatar | DONE | `171db2142858e035594737e141d422fa5378e844` / `04eb5901ce4a206fad7bddcf88cb7365a91793905ca2aea069465d1d5bc9963f` | [Отчёт](../../output/k8k-tasks/TASK-007/report.md): native Select/refs/description merge/neutral status/Card/Avatar; safe Profile migration;111 UI tests,49 browser cases/80 PNG;48 v2 budgets PASS max243227 |
| [TASK-008](TASK-008.md) | Radix Dialog, ConfirmDialog, Drawer и Popover | NOT_STARTED | — | — |
| [TASK-009](TASK-009.md) | Tabs, Segmented, Tooltip и Toast | NOT_STARTED | — | — |
| [TASK-010](TASK-010.md) | DenseTable, ListRow и server-controlled pagination | NOT_STARTED | — | — |
| [TASK-011](TASK-011.md) | Calendar и DatePicker с корректными таймзонами | NOT_STARTED | — | — |
| [TASK-012](TASK-012.md) | Девять состояний, FreshnessLabel и стабильность DOM | NOT_STARTED | — | — |
| [TASK-013](TASK-013.md) | Storybook, истории и component coverage | NOT_STARTED | — | — |
| [TASK-014](TASK-014.md) | Typed RU/RO locale contract и форматирование | NOT_STARTED | — | — |
| [TASK-015](TASK-015.md) | Общая оболочка, контролы и account menu на RU/RO | NOT_STARTED | — | — |
| [TASK-016](TASK-016.md) | Локализованные ошибки и валидация без изменения wire codes | NOT_STARTED | — | — |
| [TASK-017](TASK-017.md) | Приёмка UI-kit и локализации | NOT_STARTED | — | — |
| [TASK-018](TASK-018.md) | Staff actor context и action eligibility из сервера | NOT_STARTED | — | — |
| [TASK-019](TASK-019.md) | Смена сессии, late response и очистка приватного кэша | NOT_STARTED | — | — |
| [TASK-020](TASK-020.md) | Устойчивая оболочка и адресуемые staff-разделы | NOT_STARTED | — | — |
| [TASK-021](TASK-021.md) | Одна политика чтения и ясная свежесть | NOT_STARTED | — | — |
| [TASK-022](TASK-022.md) | Серверный источник критического события и очереди | NOT_STARTED | — | — |
| [TASK-023](TASK-023.md) | Приёмка общей оболочки и API-совместимости | NOT_STARTED | — | — |
| [TASK-024](TASK-024.md) | Серверная проекция предметов, доступа и абонементов ученика | NOT_STARTED | — | — |
| [TASK-025](TASK-025.md) | Предметный хаб, навигация и помощь ученику | NOT_STARTED | — | — |
| [TASK-026](TASK-026.md) | Абонементы по каждому предмету и точные детали прав | NOT_STARTED | — | — |
| [TASK-027](TASK-027.md) | Назначенный менеджер: официальные контакты и безопасная карточка | NOT_STARTED | — | — |
| [TASK-028](TASK-028.md) | Текущий/следующий урок: единая серверная доступность Meet и hero | NOT_STARTED | — | — |
| [TASK-029](TASK-029.md) | Календарь, карточка урока, история, перенос и предметный спор | NOT_STARTED | — | — |
| [TASK-030](TASK-030.md) | Редизайн домашних заданий без потери надёжности редактора | NOT_STARTED | — | — |
| [TASK-031](TASK-031.md) | Карта навыков: четыре технических состояния, срез4 и отчёт8 | NOT_STARTED | — | — |
| [TASK-032](TASK-032.md) | Опубликованный отчёт по deep link и полный workflow PDF | NOT_STARTED | — | — |
| [TASK-033](TASK-033.md) | Колокольчик событий: завершение пагинации, прочтения и переходов | NOT_STARTED | — | — |
| [TASK-034](TASK-034.md) | Полная RU/RO локализация, материалы, профиль и безопасность | NOT_STARTED | — | — |
| [TASK-035](TASK-035.md) | Приёмочный gate ученического кабинета K8K | NOT_STARTED | — | — |
| [TASK-036](TASK-036.md) | Преподаватель: серверный контекст, доступ к собственным объектам и детализация урока | NOT_STARTED | — | — |
| [TASK-037](TASK-037.md) | Преподаватель: K8K «Сегодня», недельное расписание и единая карточка урока | NOT_STARTED | — | — |
| [TASK-038](TASK-038.md) | Преподаватель: подключить фактическое начало и версионированный результат урока, сохранить срок24ч | NOT_STARTED | — | — |
| [TASK-039](TASK-039.md) | Преподаватель: серверные команды создания задания, выдачи и разрешённых материалов | NOT_STARTED | — | — |
| [TASK-040](TASK-040.md) | Преподаватель: очередь отправленных работ и версионированная проверка без оценок | NOT_STARTED | — | — |
| [TASK-041](TASK-041.md) | Преподаватель: интерфейс выдачи, единой очереди и проверки ДЗ в контексте урока и ученика | NOT_STARTED | — | — |
| [TASK-042](TASK-042.md) | Преподаватель: наступившие контрольные точки4/8 и серверное чтение педагогической очереди | NOT_STARTED | — | — |
| [TASK-043](TASK-043.md) | Преподаватель: явная оценка навыков, текстовые цели и подтверждение4-контроля | NOT_STARTED | — | — |
| [TASK-044](TASK-044.md) | Преподаватель: черновик, явная публикация8-отчёта и безопасные исправления версиями | NOT_STARTED | — | — |
| [TASK-045](TASK-045.md) | Преподаватель: собственная ставка и ведомость с раздельными начислениями, обязательствами и выплатами | NOT_STARTED | — | — |
| [TASK-046](TASK-046.md) | Преподаватель: собственные рабочие уведомления и структурированные обращения менеджеру | NOT_STARTED | — | — |
| [TASK-047](TASK-047.md) | TEACHER-GATE: сквозная функциональная, RU/RO и K8K-приёмка кабинета преподавателя | NOT_STARTED | — | — |
| [TASK-048](TASK-048.md) | Capabilities конкретных действий и согласованность сервера с mock | NOT_STARTED | — | — |
| [TASK-049](TASK-049.md) | Настоящая очередь задач на главной и корректные агрегаты CRM | NOT_STARTED | — | — |
| [TASK-050](TASK-050.md) | Критические события, эскалация и обращения преподавателей в CRM | NOT_STARTED | — | — |
| [TASK-051](TASK-051.md) | Append-only API структурированного журнала контактов | NOT_STARTED | — | — |
| [TASK-052](TASK-052.md) | CRM интерфейс истории контактов и фиксации результата | NOT_STARTED | — | — |
| [TASK-053](TASK-053.md) | Полная серверная пагинация и согласованные фильтры доски заявок | NOT_STARTED | — | — |
| [TASK-054](TASK-054.md) | Доска заявок: клавиатурные переходы и dnd без обхода workflow | NOT_STARTED | — | — |
| [TASK-055](TASK-055.md) | Абонементы CRM: направление, продление, заморозка и разморозка | NOT_STARTED | — | — |
| [TASK-056](TASK-056.md) | Поступления, распределения и директорские допуски: точный финансовый UI | NOT_STARTED | — | — |
| [TASK-057](TASK-057.md) | Споры о списании и исключения расписания без обхода директора | NOT_STARTED | — | — |
| [TASK-058](TASK-058.md) | Полная RU/RO локализация и приёмочный gate менеджерского кабинета | NOT_STARTED | — | — |
| [TASK-059](TASK-059.md) | Директор: единая read-очередь ожидающих решений и безопасные detail-проекции | NOT_STARTED | — | — |
| [TASK-060](TASK-060.md) | Директор: интерфейс подтверждения поступлений, распределений и отдельного частичного допуска | NOT_STARTED | — | — |
| [TASK-061](TASK-061.md) | Директор: ревизионное одобрение исключений расписания и исполнение полной отмены спорного списания | NOT_STARTED | — | — |
| [TASK-062](TASK-062.md) | Директор: подтверждённые обязательства, отдельный реестр споров и корректное закрытие периода OPS-02/B | NOT_STARTED | — | — |
| [TASK-063](TASK-063.md) | Директор: честный операционный главный экран и RU/RO-приёмка рабочего кабинета | NOT_STARTED | — | — |
| [TASK-064](TASK-064.md) | Техоператор: контекст здоровья компонентов, устаревание и защищённые read-only diagnostics API | NOT_STARTED | — | — |
| [TASK-065](TASK-065.md) | Техоператор: K8K status workspace и RU/RO-приёмка безопасных диагностических сценариев | NOT_STARTED | — | — |
| [TASK-066](TASK-066.md) | Общий вход: RU/RO пароль, обязательные проверки, восстановление и доступность без ослабления защиты | NOT_STARTED | — | — |
| [TASK-067](TASK-067.md) | AccountMenu: RU/RO, demo switching, logout и синхронная смена session во всех вкладках | NOT_STARTED | — | — |
| [TASK-068](TASK-068.md) | Права на данные и privacy: понятные интерфейсы, представитель и юридический gate | NOT_STARTED | — | — |
| [TASK-069](TASK-069.md) | Cross-role gate: director/operator/auth RU/RO, безопасность решений и открытые внешние зависимости | NOT_STARTED | — | — |
| [TASK-070](TASK-070.md) | Сквозная функциональная регрессия пяти кабинетов | NOT_STARTED | — | — |
| [TASK-071](TASK-071.md) | WCAG 2.2 AA и визуальная регрессия полного интерфейса | NOT_STARTED | — | — |
| [TASK-072](TASK-072.md) | Финальные бюджеты, производительность и зависимости | NOT_STARTED | — | — |
| [TASK-073](TASK-073.md) | Финальная сборка, генерация и безопасная регрессия | NOT_STARTED | — | — |
| [TASK-074](TASK-074.md) | Реестр LEGAL, FIN-LEGAL, Meet и release-зависимостей | NOT_STARTED | — | — |
| [TASK-075](TASK-075.md) | Итоговый отчёт, feature rollout и обратимый cleanup | NOT_STARTED | — | — |
| [TASK-076](TASK-076.md) | Финальный handoff и закрытие taskpack | NOT_STARTED | — | — |
