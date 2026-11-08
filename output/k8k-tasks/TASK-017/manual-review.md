# Ручная проверка TASK-017 — 04.11.2026

Reviewer: Codex, Chromium через Playwright MCP, static loopback catalog 6007.
Это отдельный интерактивный просмотр, а не повторное обозначение unit/axe как manual.

- RO Dialog: Tab → Enter открыл окно, начальный фокус в подписанном поле имени.
  Tab → Enter открыл вложенный popover. Два Escape закрыли слои по очереди;
  после завершения focus restore активна исходная кнопка. AX snapshot содержит
  heading, description, named close, textbox и actions. Приватных данных нет.
- RO Dialog при CSS zoom 200% (1280×900): текст и видимое кольцо фокуса читаются,
  заголовок переносится, закрытие и нижние действия доступны. Scroll/client width
  равны 1280. [Снимок](manual-dialog-csszoom200.png).
  Reduced motion установлен через emulateMedia, matchMedia=true, running animations=0.
  Native Ctrl++ в headless Chromium не меняет zoom: его не считаем доказательством.
  Автоматическая reflow-матрица использует 640/320 CSS px для эквивалента 200/400%.
- Руками просмотрены AX snapshots девяти VIS-11: loading отдельно от empty,
  stale-empty сообщает неизвестную текущую ситуацию, error допускает retry чтения,
  unknown не имеет кнопки повтора команды, forbidden/session-expired не показывают
  тело данных, limited сохраняет разрешённый предмет. Семь snapshots сохранены
  в manual-states.json; unknown RO и limited RU проверены в том же browser session.
- Визуально просмотрены RO shell reflow400, RO Dialog360, RO Kanban360,
  RO month1280 и RU month360. Длинные подписи/диакритика читаемы. В месяце
  1 октября стоит в четверг, повторный час 25 октября имеет +3 и +2, дни вне
  horizon явно неизвестны. На узком экране дни идут хронологически без обрезания.
- React best practices review: hooks и зависимости календаря сохранены,
  нет дополнительного state/effect/network, keys остаются датами/ID, новые weekday
  attributes только презентационные. Обязательные контекст/ACL/команды у adapter.

В review server были два ожидаемых 403 для отсутствующего favicon.ico, без ошибок JS.
Сервер остановлен, browser tab закрыт. Фактическая речь NVDA/JAWS/VoiceOver, native
browser zoom и полная WCAG2.2AA проверка всех ролевых экранов NOT_RUN; TASK-071/072.
Палитра/шрифт/размеры остаются provisional до решения владельца.
