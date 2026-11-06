# Блок6 — Общий вход, сессии и защита данных

Модуль выполняется отдельными заданиями по порядку. Этот индекс не заменяет текст TASK; каждый файл содержит собственный контекст и правила.

- [TASK-066 — Общий вход: RU/RO пароль, обязательные проверки, восстановление и доступность без ослабления защиты](../TASK-066.md). Исходно: В platform есть password Login, который при дополнительной MFA/recovery только показывает сообщение. Identity API имеет WebAuthn register/authenticate и initiate/complete recovery; student password/email/sessions отдельные. Manager/demo password-only исключения уже ограничены текущими server policies. Полной общей auth UI последовательности нет.
- [TASK-067 — AccountMenu: RU/RO, demo switching, logout и синхронная смена session во всех вкладках](../TASK-067.md). Исходно: packages/account-ui уже содержит AccountMenu, getAccounts, switchDemoUser/logout, CSRF mutation и BroadcastChannel school-account; полная навигация очищает runtime. Demo switch server ограничен фиксированными аккаунтами и двумя flags. Меню/role labels/ошибки в основном RU, нужна интеграция с foundation session019 и locale.
- [TASK-068 — Права на данные и privacy: понятные интерфейсы, представитель и юридический gate](../TASK-068.md). Исходно: ARCH-20/TECH-14 задают категории данных/основания/access/retention/legal hold, но юридически заполненный каталог и тексты/сроки не утверждены. Student shared child/parent account и suspended-manager contact существуют. Готового автоматического data-subject export/delete/request API в корпусе не установлено.

Выход модуля: критерии каждого TASK и доступные по ссылкам отчёты; gate не считается пройденным по наличию исходного кода.
