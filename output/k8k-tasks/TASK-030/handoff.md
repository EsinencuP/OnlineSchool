# TASK-030 — передача

Локальный scope завершён. [Отчёт](report.md) · [Приёмка](../../k8k-taskpack/task-030/acceptance.json).
Основа и preservation — [before.json](before.json), [preservation.json](preservation.json).

- Список /student/homework сохраняет status/page/lessonId и безопасный backTo.
  Сервер контролирует pagination/chronology, идентификатор — HomeworkDelivery.id.
- HomeworkEditor сохраняет 2s timer, queue.current/persistRef, uploadIntent и submitKey.
  Не переносить autosave в shared Field и не создавать параллельную очередь.
- Upload request UUID и confirm UUID различаются; successful PUT запоминается.
  Retry confirm не повторяет PUT; expired URL требует нового intent с тем же File.
  Только VERIFIED fileId попадает в body submit. Private URL не логировать/не хранить.
- Submit intent фиксирует body/key/baseVersion. Unknown блокирует edit/autosave.
  GET detail/version проверяется перед явным same-key/body retry. Иная новая версия
  не даёт создавать новую команду вслепую. Unknown не переживает unmount/session как
  durable queue; отсутствие durable offline queue не означает подтверждения отправки.
- Не менять key textarea по refetch/status/save. Expired draft убирает saved claim,
  сохраняя локальное content/selection. До authoritative response success отсутствует.
- 401/402/session lease обходят blocker и очищают private DOM; 403 выше stale cache.
  SUBMITTED/REVIEWED read-only, NEEDS_REVISION допускает следующую immutable версию.
- RU/RO copy в src/homework-copy.tsx; учебный контент и comments — plain text.
  Button ≥48px для основного CTA, видимый file control локализован.
- 5 baseline, 16 итоговых browser, 55 API mocks, 50/50 budgets. Команды и ограничения
  в [verification.json](verification.json). Backend/SDK/lockfile без изменений.

TASK-031: только по отдельной команде владельца продолжить материалы и существующие
file permissions/downloads, не делать public URLs из metadata ДЗ.
TASK-035: общий ролевой gate, расширенная приёмка кабинета.
Реальные S3/CORS, PostgreSQL write/races/migrations, физический mobile keyboard,
полный WCAG и FND-GATE имеют NOT_RUN. Исторические provider probes не новый прогон.
В этой задаче working DB/storage, .env, production, push/deploy не использовались.

