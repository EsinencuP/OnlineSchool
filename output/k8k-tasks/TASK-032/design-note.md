# TASK-032 — проектирование до реализации

Основа: Reports.tsx/list/read, publishedReportsCte/reportJson/normalizeReport,
requestStudentEducationPdf/getStudentEducationPdfStatus и существующий worker.
TASK-024/031 evidence проверены; teacher publication/render/storage policy не меняются.

Planned additive reads:
- GET /reports/:reportId → getStudentReport → существующий EducationalReportDto;
  StudentReportsService.detail / studentReportSql с тем же publishedReportsCte.
- GET /reports/export-pdf/requests/:requestId → getStudentEducationPdfRequestResult
  → PdfExportRequestResultDto {status:ACCEPTED|UNKNOWN,jobId:string|null}.
  Нужен для сверки неизвестного POST: текущий status GET требует потерянный jobId.
  Поиск только своего PdfExportJob через student_id/requested_by и существующие
  job_ref.type/source_operation_id/deduplication_key; без нового реестра/миграции.
  ACCEPTED означает факт enqueue, не READY; UNKNOWN не доказывает отсутствие команды.

Сначала explicit export routes, потом :reportId. UUID validation; no-store и
существующие session/student/active guards. Foreign/unknown/draft/future/superseded
detail — одинаковый REPORT_FORBIDDEN403. Штатная OpenAPI/SDK генерация.

UI: ReportContent({report,focus?}), Reports, EducationPdfExport и useReportCopy.
URL page/reportId/pdfJobId/pdfRequestId — только идентификаторы, без signed URL.
Список серверный, selected query отдельный и не загружает все страницы.
Фокус заголовка после адресного чтения; возврат сохраняет page. Read receipt —
явная CSRF команда и schoolEmptyFetch, isNew меняется только после ответа.

PDF intent в session-owned query cache: key + immutable selection body + jobId,
без signed URL. На route return сохраняется тот же intent; reload восстанавливает
job/request UUID из URL и делает GET. Потерянный body после reload не восстанавливать
эвристикой: проверять receipt, не посылать новый POST с неизвестным телом.
Unknown retry в той же сессии: GET receipt, затем только явный same-key/body POST
если receipt пока UNKNOWN. На ACCEPTED — polling того же job без POST.

| Состояние | UI / разрешённые действия |
| --- | --- |
| enqueue pending/unknown | форма не меняет intent, double-click lock; GET сверка, никакого успеха |
| QUEUED/PROCESSING | status/jobId, estimate30s не обещание; GET каждые2s ≤60s |
| polling paused | тайм-аут не отменяет job; явный resume того же job, route return тоже resume |
| READY | только валидный HTTPS URL + expiresAt в будущем; не хранить URL в cache/storage |
| download | отдельное явное действие сначала GET status; свежая ссылка/expiry проверены перед переходом |
| FAILED/expired | локализованная причина, signed URL скрыт; новый export только явной командой |
| 429 | пояснение о двух незавершённых заданиях; не retry автоматически |
| 403/401/switch | URL/приватный DOM скрыты, lease отменяет timers/reads/поздние ответы |

Visibilitychange сна/возврата скрывает старую ссылку до свежего GET. URL живёт только
в памяти mounted export UI, expiry таймер убирает его на точной границе. Максимум
30 последовательных poll-попыток в одном60s окне; abort/cleanup при unmount/session.
Subject/date selection из разрешённых subjects, date-only без timezone shift.
Срез4 и отчёт8 не объединяются. Новых dependencies/миграций/внешней рассылки нет.

Уточнение после проверки: неопределённое mark-read тоже сначала сверяет isNew
через getStudentReport, затем при необходимости повторяет тот же ключ. Текст о
приостановке не обещает продолжающуюся подготовку при ошибке чтения: job не отменён,
его состояние можно проверить ещё раз. Malformed/duplicated PDF IDs не подменяются
предыдущим job из памяти. Скачивание — явная кнопка с fresh GET перед navigation,
поэтому signed URL не попадает в href DOM, storage или screenshots.
