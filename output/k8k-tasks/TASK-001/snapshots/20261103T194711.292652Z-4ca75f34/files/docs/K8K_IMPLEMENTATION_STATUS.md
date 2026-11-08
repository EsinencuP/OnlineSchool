# K8K — выполненный инкремент 03.11.2026

## Реализовано

- Сохранён снимок HEAD/dirty patch/SHA256; актуализированы действующие инструкции, план и матрица28 dashboard-модулей. Frozen исходники не менялись.
- Добавлены typed locale ru/ro, сохранение выбора, cross-tab синхронизация, переключатель в общей оболочке и общем входе. Навигация/свежесть/новый экран отчётов локализованы; полный перевод приложения ещё не выполнен.
- Добавлены общие Button/IconButton/Field/StatusChip/Avatar/Card без SDK/прав/доменных команд.
- Все25 документированных цветов проверяются по WCAG; accent отдельно запрещён для обычного текста и графики на sand. Починен устаревший design-check.
- Hero ученика сохраняет текущий SCHEDULED урок в существующем60-минутном join window. SQL по-прежнему проверяет предметное право и назначение; click не проводит урок.
- Подключён существующий API опубликованных восьмиурочных отчётов: список/период/содержание/явное прочтение, пагинация, отдельный маршрут и ссылка из навыков/главной/уведомления.
- Колокольчик содержит пагинацию/прочитать все; прежний адрес notifications в K8K перенаправляется к раскрытому колокольчику. Legacy view сохранён.
- Разделы сотрудников адресуются query-параметром section с browser history; серверные команды не добавлялись в staff preview.

## Проверки текущего инкремента

- UI64/64, ученический presentation9/9, server dashboard32/32. Dashboard unit/SQL mocks не заменяют реальную PostgreSQL-проверку.
- Адресные сборки UI/API/student/platform; manager typecheck; ESLint изменённых компонентов/scripts и Prettier успешны.
- Fixture browser: отчёт на360/768/1024/1280 без overflow, axe0 на каждой ширине; сохранениеRU/RO после reload; переход legacy events→bell; read-all; Escape. Только локальные HTTP fixtures, внешний network заблокирован. Результат: output/k8k-implementation/browser/results.json.
- Screenshot отчёта360 визуально просмотрен; baseline скриншоты всех ролей не переснимались.
- GzipJS/CSS+fonts student187608/platform125382 <256000. Manager budget не измерен заново.

## Осталось по принятому плану

Полный baseline-инвентарь и before/after всех экранов; полный переводRU/RO (включая account-ui/CRM/state messages); Radix/Storybook/Stylelint/полный UI-kit; subject-access/subscriptions/manager contacts DTO; staff контекст/пагинация/action capabilities/priority; teacher education/review/report/appeals/current-rate; CRM journal/board pagination; director approvals queues; reportPDF и глубокая ссылка к старому отчёту за пределами текущей страницы; общий итоговый regression.

Не изменялись рабочая БД, миграции, финансовые формулы и production. Никаких push/deploy. Новые backend отчётные/педагогические модули не выдаются за завершённые. FND-GATE/LEGAL/FIN-LEGAL/MeetPOC/G4 остаются открытыми.
