# K8K — матрица требований, 03.11.2026

Нормативная основа: UX v0.9/VIS12 v1.0, CON-addendum, специальные решения31.10–01.11, roadmap9.7, текущий план владельца03.11.2026. Названия DASH не совпадают с номерами инженерных задач. Таблица — текущий статус, не акт приёмки.

| Модуль DASH- | Задача | Источник | Право/контекст | Действие | Состояния | Статус |
|---|---|---|---|---|---|---|
| STU-01 | Текущий/следующий урок | getStudentDashboard/getStudentLesson | canJoin + own lesson | Meet/карточка, не факт проведения | ready/stale/no link | partial; TASK-028: границы времени/свежесть |
| STU-02 | ДЗ | getStudentHomework/saveStudentHomeworkDraft/submitStudentHomework | own delivery, scope guard | очередь autosave/upload/явная отправка | pending/unknown/revision | partial; TASK-030: убрать status-tabs, сохранить lifecycle |
| STU-03 | Занятия/история/спор | getStudentLessons/getStudentLessonHistory/disputeStudentLessonDeduction | own enrollment/lesson/deduction | календарь/карточка/запрос переноса | cancel/reschedule/empty | partial; TASK-029: history/dispute APIs есть, UI их не вызывает |
| STU-04 | Путь/отчёты | skills/snapshots/getStudentReports/requestStudentEducationPdf/getStudentEducationPdfStatus | published only, own scope | отчёт/read; PDF не подключён | 4 vs 8/empty/error | partial; TASK-031/032: deep link/PDF/4-vs-8 |
| STU-05 | Абонемент по предметам | getStudentSubscription/ledger/payments; полная предметная проекция отсутствует | server access | детали выбранного абонемента | active/frozen/limited | partial; TASK-024/026: предметные сводки/права |
| STU-06 | Колокольчик | notifications/read/read-all | own events | read/source/page | empty/error/page | partial; TASK-033: все источники/состояния/RU/RO; legacy URL перенаправляется к bell |
| STU-07 | Менеджер | getStudentMe → studentManagerContacts | assigned manager, validated public links | external WhatsApp/Telegram | missing channel | partial; TASK-027: нет имени/официального телефона в проекции |
| TCHD-01 | Следующий урок | getPlatformWorkspace; startLesson backend отдельно | scheduled/assigned own rows, core RBAC | read-only preview, команда не подключена | VIS11 не принят | partial; TASK-036/037: текущий урок/detail/capabilities |
| TCHD-02 | План сегодня | getPlatformWorkspace | own rows; take100 без totals | read-only список | VIS11 не принят | partial; TASK-036/037: полный план/пагинация/детали |
| TCHD-03 | Подтверждение факта | startLesson/reportLessonOutcome/confirmLessonOutcome | ScheduleScopeGuard/сервисные полномочия | generic API есть, teacher UI отсутствует | version/24h ещё проверять | partial; TASK-038: отдельный рабочий сценарий |
| TCHD-04 | Проверка ДЗ | workspace показывает выданные задания; EducationModule пуст | issued_by/свой контекст | read-only список, review отсутствует | VIS11 не принят | partial; TASK-039/040/041: assignment/issue/materials/submitted-review API+UI |
| TCHD-05 | Навыки/отчёты4/8 | teacher очередь/assessment/publish API отсутствуют | явная педагогическая публикация | UI отсутствует | 4≠8 | missing; TASK-042/043/044 |
| TCHD-06 | Личная ведомость | getTeacherPayroll backend отдельно | свой teacher scope / директорские права отдельно | UI ведомости/ставки отсутствует | accrued≠paid≠disputed | partial; TASK-045: current-rate projection + UI |
| TCHD-07 | События/обращения | собственная teacher notifications/appeals API отсутствует | свои объекты/назначения | UI отсутствует | queued≠delivered | missing; TASK-046 |
| MGR-01 | Заявки | listManagerLeads/summary/workflow | ManagerRoute + resource guard/service scope | карточка/claim/trial/transition | conflict/pending/read | partial; TASK-048/053/054: capabilities/board paging/keyboard/dnd |
| MGR-02 | Очередь | dashboard/listManagerTasks/claimManagerTask | assigned/portfolio context | read/claim/предметное resolve | read≠claim≠resolve | partial; TASK-049: настоящая очередь на главной |
| MGR-03 | Срочные | dashboard/task projection | серверный источник/claim/escalation | открыть контекст | critical/stale/unknown | partial; TASK-022/050: типизированный event и эскалация |
| MGR-04 | Журнал контактов | student card/contact edit есть; structured journal отсутствует | portfolio, чужие дети не раскрываются | contact edit не факт взаимодействия | empty/error/pending | partial; TASK-051/052: append-only журнал API+UI |
| MGR-05 | Организационные случаи | schedule/trial/task-reschedule workflow | Manager guards + revision/approval | существующие формы/диалоги | conflict/approval/unknown | partial; TASK-048/057 |
| MGR-06 | Продления/платежи | subscription/payment/distribution workflow | portfolio; окончательное подтверждение директором | confirmManagerPayment = отправить на согласование | заявлено≠подтверждено≠права | partial; TASK-055/056/057 |
| MGR-07 | Обращения учителей | generic tasks; teacher appeal API отсутствует | назначенный контекст | очередь не заменяет teacher workflow | pending/escalation/error | partial; TASK-046/050 |
| DIR-01 | Финансовые решения на подтверждение | Finance commands, отдельная read-очередь отсутствует | director-only, полное решение/аудит | условный DASH aggregate отключён | VIS11 не принят | conditional, выключено; обязательные решения отдельно TASK-059/060 |
| DIR-02 | Денежные движения — фактическая сводка | ledger, методика агрегатов не утверждена | утверждённые определения/период | условный DASH aggregate отключён | деньги≠прибыль | conditional, выключено; TASK-063 без новых KPI |
| DIR-03 | Обязательства преподавателям | payroll/payout commands | director rights, начислено≠выплачено | условный DASH aggregate отключён | disputed/confirmed/paid | conditional, выключено; обязательные workflows TASK-062 |
| DIR-04 | Финансовые споры и открытые исключения | dispute approvals/period APIs; read registry неполон | director revision/closed-period policy | условный DASH aggregate отключён | открытый спор не закрывает долг | conditional, выключено; TASK-061/062 |
| DIR-05 | Срочные операционные эскалации | workspace tasks не заменяют escalation projection | серверная эскалация | условный DASH aggregate отключён | source/claim/escalation | conditional, выключено; TASK-050/063 |
| DIR-06 | Сотрудники и ученики — управленческий контекст | workspace assignments take100, не школьный KPI | определения активного/периода открыты | условный DASH aggregate отключён | неполная выборка | conditional, выключено; TASK-063 без выдуманных totals |
| DIR-07 | BI/P&L | будущая методика поверх ledger | нет нового бизнес-одобрения | выключено | не применимо | out-of-release |

TASK-002 уточнил наименования DIR-02/04/05/06 по каноническим VIS12 строкам; прежние
сокращения не являлись новым решением. Статусы выше — сравнение исходников с требованиями,
не runtime-приёмка. Полная трассировка: [inventory.json](../output/k8k-tasks/TASK-002/inventory.json)
и [таблица](../output/k8k-tasks/TASK-002/inventory.md).

## Основа и доказательства

| TASK / модуль | Требование | Источник | Артефакт / проверка | Статус |
|---|---|---|---|---|
| TASK-001 / M00.1 | Восстановимая основа HEAD + dirty patch + содержимое untracked | TASK-001 §§5–8; план, этап0; AGENTS preservation | [Отчёт](../output/k8k-tasks/TASK-001/report.md), manifest/байтовые копии25 tracked +145 untracked, отдельное восстановление170 файлов и повторный снимок; HEAD `171db2142858e035594737e141d422fa5378e844`, dirty `d716b9262ca859e0048d46b563872d9690026089eb1cb53b28f453555044ee76` | DONE; архивы/секретные и ignored-файлы/исторические untracked outputs исключены из backup; UI baseline и gate не закрыты |
| TASK-002 / M00.1 | Полный инвентарь routes/forms/read/write/source/ACL | TASK-002 §§6–8; VIS12; фактические router/SDK/controllers/services | [Отчёт](../output/k8k-tasks/TASK-002/report.md):48 точек входа,140 SDK contracts/89 используемых,59 write refs,28 VIS12+7 дополнительных строк; dirty `7004c02408417244f0008373cd1be12d2835a70ab32f577bd1a9324019648bc2` | DONE, статический source inventory; application/browser/DB tests NOT_RUN |
| TASK-003 / M00.2 | Воспроизводимая baseline-матрица текущего UI | TASK-003 §§5–8; inventory TASK-002; реальные DTO и локальные fixtures | [INDEX](../output/k8k-tasks/TASK-003/runs/2026-11-03T20-50-31-027Z-8bc616/INDEX.md), [audit](../output/k8k-tasks/TASK-003/runs/2026-11-03T20-50-31-027Z-8bc616/audit.json):48/48 поверхностей×RU/RO×360/768/1024/1280×2 прохода;2128 PNG,1064 semantic matches/1010 exact PNG; dirty `b6821f156103220df0bb2f8347db889ad00a399fb611191bba4578493c7dd36d` | DONE baseline;124 overflow PNG/62 first-pass наблюдения сохранены;16 health-empty NOT_RUN, отсутствующие workflows отдельно NOT_RUN; production/ролевые gates не приняты |
| TASK-004 / M00.2 | Единые route budgets и адресные дефекты | TASK-004 §§5–8; actual Vite manifests; TASK-002/003 evidence | [bundle](../output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/bundle.json), [defects](../output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/defects.json):48/48 entrypoints≤256000, оба fonts59948; max238089; dirty `35000c52207a367a478c67f1e221a20dd3d038654d36ee41bb5892c7903fc58b` | DONE измерение/реестр;74 OPEN (13 overflow,31 locale,28 functional gaps,1 pixel variability,1 secret-command lifecycle); старая delta unavailable, исправления/gates впереди |

| TASK-005 / M01.1 | Единственные tokens, семантический контраст и CSS guard | TASK-005 §§5–8; VIS-10/11; design §3 | [Отчёт](../output/k8k-tasks/TASK-005/report.md), [contrast](../output/k8k-tasks/TASK-005/runs/2026-11-03T21-34-16.851Z/contrast.json), [visual](../output/k8k-tasks/TASK-005/runs/2026-11-03T21-34-16.851Z/gallery.html): 25 CSS/culori pairs, 17 thresholds; 98 UI tests; 48/48 budgets; dirty `cea448a53cb0f9d5e2fde7356e019fcdb3bf9e612d8e448ea735e64b50275280` | DONE scoped; 715 legacy declarations с removal TASK, полный WCAG/локализация/визуальная приёмка открыты |

| TASK-006 / M01.1 | Local Golos RU/RO, typography, decorative Icon и initials | TASK-006 §§5–8; actual Fontsource exports/cmap; design §3 | [Отчёт](../output/k8k-tasks/TASK-006/report.md), [specimens](../output/k8k-tasks/TASK-006/runs/2026-11-03T21-57-30.880Z/gallery.html):103 UI tests,32 loaded/fallback PNG,48/48 v2 budgets; dirty `59e4a81081966a3b5f6c4fa0eaeccc04585d102987cf79765f226de3556049c3` | DONE scoped; fonts63492; полный WCAG/actual speech/legacy migration отдельно |

| TASK-007 / M01.2 | Native Button/Field/Select/StatusChip/Card/Avatar | TASK-007 §§5–8; React18 native semantics; design §3 | [Отчёт](../output/k8k-tasks/TASK-007/report.md), [gallery](../output/k8k-tasks/TASK-007/runs/2026-11-03T22-17-03.782Z/gallery.html):111 unit,49 browser cases/80 PNG; actual Profile pending/422/success K8K+legacy; dirty `04eb5901ce4a206fad7bddcf88cb7365a91793905ca2aea069465d1d5bc9963f` | DONE scoped; hooks/SDK неизменны, full Storybook/runtime/i18n/role gates отдельно |
| TASK-008 / M01.2 | Controlled Dialog/ConfirmDialog/Drawer/Popover/DropdownMenu | TASK-008 §§5–8; Radix React18; VIS-03…12; app-owned lifecycle | [Отчёт](../output/k8k-tasks/TASK-008/report.md), [gallery](../output/k8k-tasks/TASK-008/runs/2026-11-03T22-51-32.206Z/gallery.html):116 unit,71 browser/66 PNG; nested/dirty/pending/unknown/revoke;48 v2 budgets≤256000; dirty `3c1036a16e8e2693ec0238c6f97eda4d7320ad97f65ada37bc2cce234018b5ba` | DONE scoped; one read-only Profile consumer; native/account-ui ownership preserved; full migration/session/AT/WCAG gates отдельно |
| TASK-009 / M01.3 | Tabs, Segmented, Tooltip, Toast, HeroCard и StatTile | TASK-009 §§5–8, VIS-05/08/10/11/12 | [Отчёт](../output/k8k-tasks/TASK-009/report.md). Клавиатура и guard черновика, месяц списка и календаря, 202/unknown/error, live dedup, RU/RO×4. Бюджет 48/48. Dirty `90d3461a10826873673eb101d747dbd1ac9ac73454140362af7c0aa3a62078e7`. | DONE в объёме задания. Составные компоненты и Segmented в расписании ученика. |
| TASK-010 / M01.3 | DenseTable, ListRow, KanbanColumn и серверная пагинация | TASK-010 §§5–8, VIS-08/10/11 | [Отчёт](../output/k8k-tasks/TASK-010/report.md). Серверный sort/filter, cursor без total, 403, Back, RU/RO×4. Dirty `df3bdc81b880102b798d569c8a52ba481f4c163cb7ed3b6ee57030726347b0d6`. | DONE в объёме задания. Список заявок K8K подключён к DenseTable. |
| TASK-011 / M01.3 | Calendar, DatePicker, IANA и границы загруженных данных | TASK-011 §§5–8, VIS-08/10/11, MGR-06 | [Отчёт](../output/k8k-tasks/TASK-011/report.md). DST reject, offset повторного часа, date-only, URL и refetch focus, RU/RO×4. Dirty `ec13d68e673e737b62e94dfd42bc05364988d9fec39ea2635e2d697fc821c5ed`. | DONE в объёме задания. Read-only календарь, ресурсная интеграция оценена. |

TASK-003 фиксирует вид после имеющегося инкремента. [Наблюдения](../output/k8k-tasks/TASK-003/baseline-findings.json)
и [недоступные сценарии](../output/k8k-tasks/TASK-003/unavailable-scenarios.json) не заменяют
следующий реестр TASK-004. У39 реально вызванных operations ответы fixtures проверены по DTO,
532/532 external sentinel requests прерваны. Снимки частично локализованного UI не закрывают RU/RO gaps выше.

## Дополнительные поверхности

| Поверхность | Фактический вход / источник | Пробел | Следующий TASK |
|---|---|---|---|
| Оператор | /operator?section=overview; getComponentStatus | контекст checkedAt/heartbeat, полная RU/RO и private DOM/401 | TASK-064/065 |
| Общий вход | /account и /; createSession/currentSession/catalog; manager Login имеет passkey ветви | shared MFA/recovery workflow; RU/RO; scoped password-only исключения сохраняются | TASK-066 |
| AccountMenu | общий private account menu; switchDemoUser/deleteSession | приватный DOM/reads/cache/late actor/cross-tab и RU/RO | TASK-019/067 |
| Профиль/безопасность ученика | /student/profile, /student/security, /student/security/change-password | полный RU/RO, privacy/session acceptance; пароли/OTP не сохраняются в инвентаре | TASK-034 |
| Материалы ученика | /student/materials; getStudentMaterials/getStudentMaterialUrl | полный RU/RO и revocation/access acceptance; teacher materials workflow отдельно | TASK-034; teacher TASK-039/041 |
| Обязательные решения директора | generic finance/schedule/dispute/period commands есть, /director пока read-only | единая read-очередь/detail и разрешённые командные формы; отдельно от условных DASH-DIR-01…06 | TASK-059/060/061/062 |

## Сквозные проверки

Смена сессии/401/403, поздний ответ, CSRF/idempotency/unknown-result; 360/768/1024/1280; RU/RO и длинные подписи; серверные часы/DST; decimal-money; оплаченные права отдельно от денег и календаря; заморозка отдельно от истечения; нет внешних организационных автосообщений. Оператор: health API только чтение, проверка stale/error; общий вход: текущие MFA/password-only исключения и fixed demo catalog. Эти строки ещё требуют ролевого приёмочного прогона.

## Незакрытые работы

Инвентарь форм/команд опубликован в TASK-002, screenshot/state baseline — в TASK-003.
Бюджеты и адресный реестр опубликованы в TASK-004; исправления OPEN записей остаются
в конкретных future TASK реестра. Сохраняются
полный перевод; Radix/Storybook; удаление legacy CSS allowlist; subject-access DTO; staff контекст/пагинация/capabilities;
teacher review/education APIs/appeals/current-rate; CRM contact journal/action eligibility/board paging;
director decision queues; подключение уже существующих student history/dispute/PDF APIs; итоговый gate.
Отсутствие API или frontend consumer не означает успешного завершения скрытого модуля.
