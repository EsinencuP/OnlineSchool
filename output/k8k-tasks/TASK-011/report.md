TASK: TASK-011
Статус: DONE
Дата: 04.11.2026
Основа: HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design`, dirty digest `ec13d68e673e737b62e94dfd42bc05364988d9fec39ea2635e2d697fc821c5ed`.
Source digest: `329827c0436b0c0c21cf6ab16732944424727693515290c80f33a1f5dcec2b5a`.

Подтверждены 493 исходника TASK-010. Сохранены 497 копий и бинарный diff до правок.
После обновления журнала совпали 501 исходник принятого прогона и девять ранее защищённых
артефактов. Build-time digest и финальный patch hash записаны отдельно. [Сохранение основы](preservation.json)

## Что уже существовало

Менеджер использовал Temporal PlainDate и localToIso с disambiguation reject.
Его часовой пояс приходит из /me. Student Layout применяет timeZone из профиля.
Ученический список и календарь используют серверный month/period и лёгкую группировку.

## Что изменено

- packages/ui/src/calendar.tsx и calendar.css добавляют Calendar, DatePicker и типы
  read-only события и горизонта. Calendar показывает локальное время с явным смещением,
  сохраняет исходные instants в time datetime, выводит protected, pending-renewal,
  busy, free и unknown текстом. Незагруженный диапазон отличим от пустого.
- DatePicker принимает plain date, проверяет календарную валидность и сохраняет YYYY-MM-DD.
  Нативное поле дополнено кнопками предыдущего и следующего дня с доступными RU/RO именами.
- Manager Schedule сохраняет дату, вид и фильтры в URL. Используются прежние schoolDate,
  weekStart, dateShift и localToIso. Если границы нельзя определить однозначно, запрос
  пропускается и показано объяснение. K8K Calendar использует фактические DTO и существующие
  карточки действий. Менеджерский adapter и LessonAction побайтно совпали с основой.
- Student Lessons сохраняет month, view, period и page в URL. Список и календарь возвращаются
  к месяцу после Back. Существующий SDK и лёгкая группировка используются в обоих режимах.

## Контракты, SDK и миграции

[Props и URL](handoff.md) · [Проект контракта](design-note.md)

ManagerLessonDto передаёт id и время. В этом DTO нет revision, поэтому adapter использует null.
Commands, ACL, бизнес-решения, SDK, DTO и миграции остаются у действующих границ.
UI importer повторно использует Temporal 0.5.1. Установленные package/snapshot records совпали.
[Проверка зависимостей](dependency-policy.json) · [Lock delta](lock-delta.json)

@event-calendar/core 5.5.1 MIT проверен по registry и архиву. В исследованном _fromISOString
строка разбирается по числовым компонентам без применения ISO offset. В документации
актуального upstream перечислены local, UTC и фиксированные offset, тогда как здесь нужен
IANA пояс на всём интервале. Staff resource integration остаётся с явным требованием
авторизованного read-model. React Aria не потребовалась для нативного поля с кнопками дня.
[Оценка пакета](event-calendar-review.json) · [Документация EventCalendar](https://github.com/vkurko/calendar#timezone)

## Источники и решения

TASK-011 §§5–8, K8K_DESIGN_INSTRUCTIONS §§2–7, VIS-08/10/11 и актуальный MGR-06.
Решения о 60 минутах, 24 часах, точной ревизии и директорских исключениях соблюдаются
существующими командами. DST проверен по установленному Temporal и правилам disambiguation.
[Temporal PlainDateTime](https://tc39.es/proposal-temporal/docs/plaindatetime.html#toZonedDateTime)

## Проверки

| Команда | Exit | Результат |
|---|---:|---|
| pnpm --filter @online-school/ui build | 0 | Сборка UI |
| pnpm --filter @online-school/ui test | 0 | [125 тестов](ui-test.log) |
| pnpm --filter @online-school/ui lint | 0 | [16 CSS файлов и ESLint](ui-lint.log), 715 прежних legacy записей |
| pnpm --filter @online-school/manager-web typecheck:ui-calendar | 0 | [Строгая типизация обеих страниц и fixture](typecheck.log) |
| Адресный ESLint изменённых страниц, fixture и helper | 0 | [Точная команда](checks.json) |
| pnpm k8k:calendar:evidence | 0 | [20 сценариев и 10 снимков](evidence.log) |

Ранний прогон выявил различие поведения ArrowUp в нативном мобильном поле.
Кнопки дня обеспечили предсказуемый выбор Enter/Space. Проверка переключения radio
теперь дожидается перехода router и проверяет значение после него.
Chromium использовал пояс America/Los_Angeles, аккаунт менеджера Europe/Chisinau.
Все 20 GET подменены на loopback. Рабочая БД, провайдеры, миграции и production не затронуты.

## Визуальные доказательства

[Галерея](runs/2026-11-04T05-04-04.818Z/gallery.html) · [Сценарии, запросы и хеши](runs/2026-11-04T05-04-04.818Z/visual.json)

Manager fixture покрывает RU/RO на 360, 768, 1024 и 1280. Manager Schedule с реальным
компонентом и локальными GET проверен на RU 360 и RO 1280. Student Lessons проверен
в обеих локалях на переключении и возврате. Просмотрены 360 px снимки общего календаря
и Schedule. На них виден повторный час с разными смещениями и разница между занятостью,
ожиданием продления и отсутствием загруженного диапазона.

## Бюджет

48/48 маршрутов проходят 256000 байт. Максимум 247590, включая 63492 байта WOFF2.
Manager Schedule 245537 (+2552), Student Lessons 207383 (+665), platform max 132765.
Optional passkey closure 186046. Метод v2 сопоставим с TASK-010.
[Бюджеты](runs/2026-11-04T05-04-04.818Z/bundle.md) · [Manifest](runs/2026-11-04T05-04-04.818Z/bundle.json)

## Acceptance checklist

| Критерий | Статус | Доказательство |
|---|---|---|
| DST gap/overlap отклоняются | PASS | Существующий localToIso возвращает null для 03:30 в обе даты перехода |
| RO month names | PASS | octombrie в Calendar и DatePicker |
| Validity date сохраняется | PASS | Та же строка и подпись после смены Chisinau на Honolulu |
| Protected и pending-renewal отделены от free | PASS | Текстовые состояния, частичный free становится unknown |
| Клавиатурный выбор | PASS | Enter/Space на кнопках дня |
| Resize сохраняет UTC | PASS | Значения time datetime совпали на 360↔1280 |
| URL и refetch focus | PASS | Back сохраняет контекст обеих страниц, refetch сохраняет узел и фокус |
| Проверка ресурсов и зависимостей | PASS | Pinned registry и архив кандидата, IANA причина выбора |
| Сохранение основы и учёт | PASS | Хеши, журнал, матрица и handoff |

## Не проверено, остатки и обратимость

NOT_RUN: production, БД, провайдеры, полная WCAG/AT приёмка, роль и ресурсы в реальном
кабинете, FND-GATE, LEGAL/FIN-LEGAL и Meet/G4. Прежние русские строки форм и карточек
подлежат полной локализации в TASK-034/058. Ресурсный read-model относится к последующей
интеграции расписания, в частности TASK-037. TASK-012 остаётся отдельным заданием.

Откат ограничивается изменениями из preservation.json и резервными копиями before/.
