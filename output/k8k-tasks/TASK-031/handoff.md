# TASK-031 — передача

Локальный scope завершён. [Отчёт](report.md) · [Приёмка](../../k8k-taskpack/task-031/acceptance.json).
[Основа](before.json) · [Сохранность](preservation.json) · [Контракты](contracts.json).

- /student/skills?subjectId=UUID&snapshotPage=N; опущенный subjectId означает все
  собственные предметы, включая исторические. Нельзя выбирать другой предмет
  молча или считать историю оплатой/живым допуском.
- SkillMap реэкспортирован из Learning.tsx; Materials/Notifications bodies сохранены.
  Shared StagesTrack — только легенда трёх стадий; SkillStatus({status}) — текущий
  enum, включая отдельный neutral NOT_STUDIED. Не добавлять проценты/auto promotion.
- Assessment отсутствует при пустом lastUpdatedByTeacherName по текущему контракту.
  lastUpdatedAt тогда catalog creation, не придуманный assessment. Goals/text,
  targetDate/null и isAchieved только из API. formatSkillDate сохраняет date-only.
- Audit — GET skillId/page, public_comment и frozen display names. Открытие не меняет
  навык. Snapshot — сохранённые ss.skills/ss.subject_name, не текущий каталог.
- Additive GET getStudentSkillSnapshots optional subjectId через
  SkillSnapshotQueryDto/Pipe/тип, фильтр до history count/page и ownership 403.
  Path/operation/responses unchanged, 147 ops. SDK создан штатно, no new migration.
- nextSnapshotIn и lessonNumber серверные. Counter SQL не менялся; свежий
  structural test не доказывает PostgreSQL execution. 21 старый CTE case NOT_RUN.
- skills/skill-history/snapshots refresh on mount/return + explicit action,
  без нового polling. 403 выше cache, session clears private DOM/late replies.
- 57 API/HTTP mocks, 10 Chromium (включая прежний four states), 34 screenshots,
  50/50 budgets. [Команды](verification.json), [Снимки](screenshots.json).

TASK-032: Reports/PDF/reportId/deep link по отдельному заданию владельца;
snapshotId не reportId. Срез4 не публикует отчёт8. Prepared STU-08 migrations
по-прежнему требуют разрешённого release, новый frontend/API выпускать совместно.
TASK-035: полная приёмка кабинета и role gate.
TASK-042/043/044: teacher review/publish/checkpoint/reminders, без обхода CON-07/B.
Реальная БД/triggers/races, физический screen reader/mobile, FND-GATE/production GO
имеют NOT_RUN. .env, working DB/storage, push/deploy в TASK-031 не использовались.

