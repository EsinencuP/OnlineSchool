# TASK-033 — проектирование до реализации

Сохранить existing list/count/PATCH read/POST read-all,18 NOTIFICATION_TYPES,
TTL90d/500 archive, source event keys, first read_at и transactional advisory lock.
Новых producers, inbox writes/backfill, внешних сообщений или миграций не планируется.
TASK-032 prerequisite проверен по report/acceptance/artifacts и текущему detail route.

Planned API: NotificationsQuery = HistoryPage & {locale?:'ru'|'ro'}, optional locale
в NotificationsQueryDto/Pipe (default ru в service), тот же getStudentNotifications.
Неизвестные/repeated query fields по-прежнему400, остальные контракты неизменны.
Read-only projectNotificationText в notification-locale.ts: только typed canonical
source.type/source.payload или explicit dispatch.template_code/variables + validation.
Это existing catalog metadata, не угадывание по inbox title/body или private полям.
Historical projection без такого metadata, incomplete params и MANUAL_MESSAGE
сохраняют исходные title/body. Внутренние metadata не выходят в response, payload/read_at
и persisted dispatch/source/inbox не меняются. Producers/renderNotification не редактируются.

Planned UI: StudentNotificationMenu({count,countError?,retryCount?}) с shared Popover,
NotificationBell/Button/StatusChip/QueryState. Open контролируется events=1 в URL;
close удаляет только events, replace/preventScrollReset. Никакого onToggle/details race.
Popover title/close/Escape/outside/return focus, внутренний scroll/height на360px.
Preview query ['notifications-preview',page,locale] включён только open и не forbidden;
close отменяет текущий read, open/page/locale получает fresh read без polling.
Отдельный lightweight unread остаётся в Layout и общей refresh policy.

notificationTarget(payload,type?,locale?) сохраняет старый payload-only call;
новый UI всегда передаёт type и locale. Type определяет ровно один допустимый ID:
lesson/homework/report/subscription. Unknown/MANUAL/ACCOUNT_CREATED без ссылки.
Никакого payload.url, capability из inbox или fallback к чужому object ID.

Read intent {key,notificationId:null|string}: existing SDK/write+CSRF, synchronous
lock, same UUID при retry. Новая явная отметка после успеха — новый intent.
Unknown сначала GET preview/count, затем явный same-key retry. Никаких optimistic
read flags/zero: после204 инвалидировать count/dashboard/все preview keys, активные
reads обновляются; закрытые pages остаются invalidated и читаются при открытии.
Read notification не вызывает report-read/lesson/payment/CRM commands.

403 у count/preview очищает и отменяет всю notification read family выше cache;
503 count показывает unavailable, не0. Session lease отбрасывает late actor response.
Readonly targets сами проверяют owner/scope; vanished target — штатный unavailable.
RU/RO охватывает UI, type labels, dates и допустимые catalog templates; human content
не переводится. Full gate/PG trigger/concurrency и реальный projector — NOT_RUN.


Final overlay choice: the shared Radix Dialog-based Drawer replaces the initial Popover prototype. Measured Popover student routes exceeded the 256000-byte budget (262709 bytes at login, including all fonts). Drawer reuses the shell dependency and preserves controlled URL, ESC/outside close, focus lifecycle and internally scrolling content. No new dependency or split-budget exception.

Final header props additionally include required timeZone:string from the loaded profile; exact countError?:unknown and retryCount?:()=>unknown are wired by Layout. Final shared overlay is Drawer; no shared-kit API changes.
