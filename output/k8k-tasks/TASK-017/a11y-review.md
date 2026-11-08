# Axe incomplete — отдельная оценка

102 scans, 0 reported violations. Incomplete не превращены в автоматический PASS
и не скрыты через disableRules. Полные targets сохранены в browser/foundation.json.

| Правило | Сканирований | Оценка в рамках foundation |
|---|---:|---|
| bypass | 66 | Изолированные component stories без повторяемого меню страницы. Document-level bypass оценивается на AppShell и затем на role pages в TASK-071. |
| th-has-data-cells | 2 | Пустая DenseTable с headers и пояснением empty. Отсутствие data cells соответствует отсутствию строк; loading не подставляет fake row. |
| aria-valid-attr-value | 22 | Radix triggers с aria-controls на условно смонтированное содержимое. Открытые элементы проверены axe/AX; keyboard и focus return работают. Closed IDREF и реальную речь AT проверить в TASK-071. |
| aria-hidden-focus | 6 | Radix modal background/focus guards. В открытом modal Tab остаётся в окне, после Escape фокус возвращается. Реальное AT-восприятие скрытых guards остаётся в TASK-071. |

Фактические keyboard и visual observations находятся в manual-review.md.
Полное соответствие WCAG и реальная речь AT не утверждаются.
