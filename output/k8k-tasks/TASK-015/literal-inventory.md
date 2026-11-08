# Инвентарь подписей TASK-015

| Источник | Проверенные поверхности | Итог |
|---|---|---|
| packages/ui/src/shell.tsx и navigation.ts | Названия кабинетов, пропуск к содержимому, desktop/mobile nav, раскрытие и закрытие разделов, доступное имя колокольчика | Обе локали. Для каждого существующего пункта указаны `labelKey` и при необходимости `compactLabelKey`. Длинные мобильные подписи используют ширину собственной ячейки. `id`, `href`, `label`, `shortLabel` сохранены. |
| packages/ui/src/state.tsx, priority.tsx, freshness.tsx | Девять VIS-11, повтор чтения, подписи критической очереди и источников времени | Typed keys из прежнего контракта. Свежесть не используется как разрешение действия. |
| packages/ui/src/controls.tsx, overlays.tsx, composites.tsx, tables.tsx, calendar.tsx, stages.tsx | Fallback статуса и имени, доступное закрытие окна, toast outcomes, подписи пагинации, дня, этапа и доступности | Системные значения берутся из RU/RO. `label`, `title`, `hint`, `disabledReason` и названия действий, переданные вызывающим экраном, остаются его контентом. |
| packages/account-ui/src/index.tsx | Имя роли, выбор языка, список demo при разрешении сервера, вход по паролю, выход, загрузка, ошибка и неизвестный исход | `account.*` и существующий `LanguageSelector`. Текст имени и коды роли не преобразуются. Одна точка входа и один выход в каждом открытом меню. |
| apps/platform/src/App.tsx | Общий вход, группы ролей каталога, общий staff chrome и названия секций | Общие роли используют `accountRoleLabel`, разделы используют `roleNavigation`, в оболочке один AccountMenu. Ролевые заголовки, содержимое кабинетов и отдельные доменные ошибки в следующих задачах. |
| apps/student-cabinet/src/Layout.tsx, components.tsx, StudentNotificationMenu.tsx, pages/Account.tsx | Заголовок, навигация, сокращённые названия, контакты, подписи bell preview, пагинация, закрытие модали и pre-login | Общие подписи RU/RO. Отдельные ссылки источников уведомления, его доменные ошибки и legacy URL переданы TASK-033. |
| apps/manager-web/src/components/layout.tsx и pages/Login.tsx | Поиск, навигация, shortcuts, справка, часовой пояс, account chrome, selector и общие поля входа | Общие подписи RU/RO. Выход использует существующий адаптер CRM. MFA-ветки и ролевые формы остаются за пределами этой задачи. |

Передача в TASK-016: прежние `ClientError.status`, `ClientError.code` и result shape. Локальные сообщения AccountMenu используют typed display keys, а неизвестный исход блокирует повтор записи до сверки сессии.
