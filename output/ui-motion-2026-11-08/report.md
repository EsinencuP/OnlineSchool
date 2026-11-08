# Движение в интерфейсе K8K — 08.11.2026

Применено к существующим общим компонентам по прямому указанию владельца. [Полные правила и границы применения](../../docs/UI_MOTION_2026_11_08.md) добавлены в текущую карту AGENTS.md.

Появление использует ease-out и 200 мс, уход — ease-in и 160 мс. Dropdown и native menu аккаунта остаются в диапазоне 150–250 мс. Popover начинает с 0.95 и раскрывается от origin триггера, тот же origin используется при выходе. Dialog/Drawer получают координаты источника до смены фокуса. Нет fade поверхности в центр и spring bounce.

Кнопки сжимаются до 0.97 при нажатии; disabled/aria-disabled сохраняют обычный масштаб. Списки и DenseTable появляются с шагом 30 мс, с пределом 270 мс для длинных страниц. Детали раскрываются маской с задержкой 30/60 мс. Подтверждённый успешный Toast получает один пульс; unknown/queued не получают сигнал успеха. IconSwap меняет menu/close общим местом с crossfade, scale и blur. В Tabs с keep-mounted новое содержимое появляется во время ухода старого; уходящая панель inert и aria-hidden. Черновики сохраняются. Закрытое native menu аккаунта тоже становится inert на время выхода.

Все движущиеся эффекты отключены при reduced motion. Данные и команды не ждут окончания анимации. unmount-inactive и немедленное скрытие запрещённых/приватных данных сохраняют прежние контракты. Статические иконки остаются SVG без обёртки.

Ручек switch/slider, drag-взаимодействий, переносов общих объектов и ручных покадровых материалов в текущем коде не найдено. Для них зафиксированы будущие правила: растяжение на 12%, дуги, rubber band, стабильный layout ID сущности и авторский тайминг. Новые функции drag/slider/shared-layout и зависимости не добавлялись. Маски применены к раскрытиям; существующая семантическая смена цвета остаётся мгновенной, будущие анимированные смены цвета должны использовать маску слоя.

Проверки:

| Проверка | Результат |
| --- | --- |
| Typecheck | ui, account-ui, student-cabinet, manager-web, platform — пройдены; typecheck-*.log |
| ESLint / Prettier / diff --check | Пройдены для изменённых файлов; [lint-results.json](lint-results.json), [diff-check.log](diff-check.log) |
| SSR компонентов и локализация | 12/12; [unit.log](unit.log). Старое ожидание «С возвращением» обновлено под ранее утверждённое «Вход в кабинет» |
| Контраст / Stylelint | 77/77; [design.log](design.log). 20 CSS, unexpected=0, stale=0; [stylelint-final.log](stylelint-final.log) |
| Движение / reduced motion | 22 сценария, ошибок 0; [browser-results.json](browser-results.json). Измерены реальные CSS animation timings, scale, задержки, возврат фокуса, inert, сохранение черновика и подтверждённый пульс |
| Playwright MCP | Дополнительно проверены popover от origin 0px 0px, duration 0.2s, Escape/фокус и native account duration 0.2s; [mcp-results.json](mcp-results.json), [снимок](mcp-fixture.png) |
| Пять кабинетов и общий вход | 34 снимка, шесть Axe-сцен при 360 px — 0 нарушений, переполнения/ошибок страницы/неизвестных маршрутов 0; [visual-after.json](visual-after.json) |
| Загрузка маршрутов | 50/50, максимум 255999 / 256000 байт с тремя локальными WOFF2 по прежней методике; [budgets.json](budgets.json) |

Проверка остаётся локальной, на реальных frontend-сборках с синтетическими ответами. Все вложенные бизнес-сценарии и все браузерные движки не прогонялись. Анимированное закрытие native details требует ::details-content/discrete visibility; без поддержки используется штатное мгновенное закрытие. MCP-сервер для просмотра fixture вернул один 404 favicon; ошибок приложения не было. В основных browser-проверках favicon перехвачен и внешняя сеть заблокирована. Полный gate и production GO не объявлялись.

Для сохранения бюджета удалены повторные CSS-декларации, стили неиспользуемых старых элементов и декоративные свойства, уже перекрытые актуальным визуальным слоем; см. redundant-css-removed.json, unused-css-removed.json, obsolete-chrome-removed.json. Удалены также неиспользуемые рекламные строки прежней формы входа и подписи, отсутствующие в компонентах. Работающие подписи и бизнес-сообщения сохранены. CSS baseline сокращён 255 → 231; новые исключения не добавлялись. Максимальный маршрут почти исчерпывает бюджет; лимит не повышался.

[Снимок popover во время появления](popover-in-50ms.png) · [Fixture, 360 px](fixture-motion-360.png) · [Reduced motion](fixture-reduced-360.png) · [Ученик](after/student-360.png) · [Менеджер](after/manager-1280.png).

Исходные байтовые копии 19 файлов проверены по SHA-256; [source-before.json](source-before.json). Прежняя рабочая копия и изменения предыдущего визуального задания сохранены. Исторические документы и output/ui-simplification-2026-11-08 не перезаписывались. Коммит, push, deploy, доступ к рабочей БД и провайдерам не выполнялись. Тестовый сервер остановлен, вкладка MCP закрыта.

Воспроизведение из D:/OnlineSchool:

```powershell
node packages/ui/tests/browser/motion-smoke.mjs
node output/ui-motion-2026-11-08/capture-cabinets.mjs --after
node output/ui-motion-2026-11-08/budget.mjs
pnpm --filter @online-school/ui typecheck
node --test packages/ui/tests/composites.test.mjs packages/ui/tests/overlays.test.mjs packages/ui/tests/locale.test.mjs
node scripts/k8k-design-check.mjs
```

Для ручного локального просмотра: node packages/ui/tests/browser/motion-smoke.mjs --serve; адрес 127.0.0.1:4199, остановка Ctrl+C. Сборки выполняются в памяти, без envDir/publicDir и без dist. Механика exit CSS опирается на [официальное руководство Radix](https://www.radix-ui.com/primitives/docs/guides/animation); transform origin popover — на [документацию компонента](https://www.radix-ui.com/primitives/docs/components/popover).
