# TASK-032 — передача

Локальный scope завершён. [Отчёт](report.md) · [Приёмка](../../k8k-taskpack/task-032/acceptance.json).
[Основа](before.json) · [Контракты](contracts.json) · [Проверки](verification.json).

- /student/reports?page=3&reportId=UUID: detail GET, без поиска всех страниц.
  Focusing heading/return page сохранены. Срез4 не reportId, publication только teacher.
- getStudentReport → EducationalReportDto из прежнего publishedReportsCte/reportJson.
  Foreign/unknown/draft/future/superseded одинаково forbidden; raw SQL execution NOT_RUN.
- Явный read использует прежний schoolEmptyFetch204/200. isNew обновляется после ответа;
  unknown сначала сверяет detail, затем при необходимости тот же key. Новая версия unread.
- PDF existing POST requestStudentEducationPdf и GET getStudentEducationPdfStatus.
  Additive getStudentEducationPdfRequestResult(requestId) восстанавливает потерянный202:
  ACCEPTED+jobId либо UNKNOWN/null. Это read-only lookup существующего job по actor/student
  и original operation, без подписи/нового job. ACCEPTED не значит READY.
- Intent key/body неизменны в session-owned query cache. Unknown → GET receipt →
  явный same-key/body retry. После reload без body только сверка; не угадывать selection.
- URL содержит pdfJobId/pdfRequestId/page/reportId; signed URL только в mounted UI.
  Poll2s ≤30 attempts/60s, pause/resume того же job, не cancellation/new export.
  READY требует HTTPS+future expiresAt; download делает fresh GET; expiry/sleep скрывают URL.
- Logout/401/403/session switch abort timers/reads. Поздний старый READY не возвращает DOM.
- 86 mocks,14 browser,43 screenshots,50/50 budgets. Реальный worker/renderer/S3/PG не запускались.
- Два GET добавлены к147 прежним operations, SDK штатно создан, transport/worker/renderer/
  export-data/lockfile unchanged, новых dependencies/миграций нет. UI/API выпускать совместно.

TASK-033: bell/source links, по отдельному заданию владельца. TASK-035: role gate.
TASK-042/043/044: teacher publication4/8/reminders. Production/FND-GATE/LEGAL,
реальные PostgreSQL/S3/worker delivery и физический WCAG/manual имеют NOT_RUN.
Рабочая БД, .env, push/deploy не использовались. Следующий TASK не начат.
