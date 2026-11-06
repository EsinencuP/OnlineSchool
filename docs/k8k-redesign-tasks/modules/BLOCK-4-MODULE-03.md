# Блок4 — Навыки, цели и образовательные отчёты

Модуль выполняется отдельными заданиями по порядку. Этот индекс не заменяет текст TASK; каждый файл содержит собственный контекст и правила.

- [TASK-042 — Преподаватель: наступившие контрольные точки4/8 и серверное чтение педагогической очереди](../TASK-042.md). Исходно: В БД уже есть ProgressCheckpoint, типы LESSON_4/LESSON_8, completion-поля и SkillSnapshot с SQL freeze guard. STU-08 считает confirmed CONDUCTED уроки по предмету через все enrollment. Teacher workflow создания/чтения/подтверждения контрольных точек и согласованный retro-recompute пока отсутствуют.
- [TASK-043 — Преподаватель: явная оценка навыков, текстовые цели и подтверждение4-контроля](../TASK-043.md). Исходно: SkillEntry/SkillAssessment с immutable revisions, SkillAuditLog, LearningGoal/History и ProgressCheckpoint completion существуют в schema. STU-08 read API и SQL guards аудита/snapshot подготовлены. Teacher commands редактирования/оценки/целей и соответствующие UI ещё не реализованы.
- [TASK-044 — Преподаватель: черновик, явная публикация8-отчёта и безопасные исправления версиями](../TASK-044.md). Исходно: EducationReport имеет DRAFT/GENERATED/PUBLISHED, версии/supersedes и count snapshot; STU-09 читает только опубликованные LESSON_8 и сохраняет прошлую публикацию при draft correction. SQL publication/freeze guards существуют, worker PDF реализован для student. Teacher editor/publish commands и3-working-day workflow отсутствуют.

Выход модуля: критерии каждого TASK и доступные по ссылкам отчёты; gate не считается пройденным по наличию исходного кода.
