# TASK-031 — проектирование до реализации

Исходная основа: четыре enum в SkillDto, SubjectSkillMapDto, SkillAuditResponseDto,
SkillSnapshotResponseDto; StudentSkillsService/skillMapSql/skillAuditSql/skillSnapshotsSql.
Срезы — immutable SkillSnapshot; отчёты8 — отдельный EducationReport и /student/reports.
Проверяется исходный browser scenario «four skill states» до изменения Learning.tsx.

Планируемый additive контракт: SkillSnapshotQueryDto extends HistoryQueryDto,
SkillSnapshotQuery = HistoryPage & SkillSelection, SkillSnapshotQueryPipe.
GET getStudentSkillSnapshots получает optional subjectId. Фильтр проверяет ownership
и ограничивает history до count/pagination, не фильтрует готовую страницу клиента.
Путь/operation не меняются; DTO snapshot и enum остаются прежними. Миграций нет.

Планируемые UI: StagesTrack({status?}) и SkillStatus в skill-widgets.tsx,
useSkillCopy в skill-copy.ts. NOT_STUDIED отдельно от трёх учебных стадий.
SkillMap и SkillHistory остаются read-only; history раскрывается явной кнопкой
aria-expanded/aria-controls, только public comment, author/time, серверные total/page.
Предметный selector строится по полному owned skill-map read, включая старые enrollments,
а не только активным правам. URL subjectId/snapshotPage; invalid/foreign не заменяется
первым предметом. Ссылка обратно к hub отдельно и не означает активный допуск.

Главная: короткий контекст и одна текущая текстовая цель каждого возвращённого
предмета со ссылкой в его карту; не выбирается молча первый предмет, не повторяется
полный каталог. Последний snapshot обозначается срезом4; reports8 ведёт отдельно.
Публикация учителя вне scope: обновление существующих reads при возврате на маршрут
и явный refresh, без нового polling. Stale/403/session через QueryState/read lease.

| Данные/состояние | Представление | Источник |
| --- | --- | --- |
| NOT_STUDIED | нейтральный текст/иконка вне трека | server enum |
| три стадии | подписи/номера/текущая стадия, read-only | server enum |
| нет автора assessment | «Проверка ещё не опубликована», catalog date отдельно | пустое teacherName + lastUpdatedAt |
| downgrade/reset | from→to + public comment, immutable history | audit GET |
| goals/null date | teacher text, isAchieved, «без срока» | map DTO |
| snapshot4 | frozen names/comment, lessonNumber/date | snapshots GET |
| report8 | отдельное пояснение и Reports URL | report namespace |
| stale/error/403 | существующий QueryState/Freshness; forbidden выше cached data | read policy |

Никаких student mutation, процентов, рейтингов, auto stage, checkpoint/reminder writes.
Счётчик confirmed CONDUCTED по предмету через enrollments сохраняется на сервере.
Source-exact SQL cases существуют, фактическая PostgreSQL execution отдельно NOT_RUN.

Реализация: StagesTrack без props служит общей легендой; SkillStatus({status})
показывает текущее серверное состояние навыка. Это сохраняет один статус в каждой
карточке и исходный four-state test без дублирования всех стадий на каждом навыке.
formatSkillDate(value,timeZone,locale,includeTime?) показывает год и сохраняет
date-only цели без timezone shift. SkillMap вынесен в pages/SkillMap.tsx и штатно
реэкспортируется из Learning.tsx; Materials/Notifications не перерабатываются.
