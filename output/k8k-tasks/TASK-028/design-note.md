# TASK-028 — проектирование до правок

`NextLessonDto.status?: StudentLessonStatus` и `NextLessonDto.meetAsOf?: string` добавляются к существующей проекции hero. `LessonCardDto.meetAsOf?: string` переносит тот же server snapshot в календарь, список и detail. Новых операций, финансовых DTO и мутаций нет.

`studentMeetLinkSql(asOf)` и `studentMeetProjection(row, student, asOf)` переиспользуют единое право enrollment, назначение учителя, канонический URL и точное окно −600000…+3600000 мс. Время назначения проверяется для снимка и слота, права не выводятся из глобального признака. Hero сначала выбирает текущий разрешённый SCHEDULED, затем будущий по scheduled_at/id.

`DashboardCacheInterceptor` сохраняет TTL/revision и coalescing только для сводки без урока. На cache hit или присоединении к in-flight сводке урок перевычитывается отдельно. `generatedAt` сохраняет время сводки, `meetAsOf` задаёт время авторитетного снимка урока. HTTP остаётся no-store.

`QueryState.meet?: { lessons, countdown? }` подключает один monotonic `MeetScope` на проекцию. `JoinButton` требует SCHEDULED, положительный canJoin, канонический URL и свежий снимок с часами. Client clock только скрывает просроченную ссылку, а T−10 запрашивает новое решение через текущего refresh owner. RU/RO причины используют ключи presentation. Смена сессии и 401/402/403 остаются в существующем transport.
