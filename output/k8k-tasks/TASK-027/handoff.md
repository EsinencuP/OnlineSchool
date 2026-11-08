# TASK-027 — передача

- `GET /api/v1/student/me` и `ACCESS_SUSPENDED` (402) используют `ManagerContactsDto`. Обязательные `whatsapp` и `telegram` сохранены. `displayName` и `phoneE164` опциональны и могут быть `null`.
- `studentManagerContacts` выбирает действующее назначение по `Student.id` из сессии. Текущее назначение должно вести к активному staff/login и роли MANAGER либо DIRECTOR. `StaffAccount.full_name` передаётся как имя только для этого назначения. Отсутствие назначения не создаёт контакт другой роли.
- Миграция добавляет nullable `staff_accounts.student_phone_e164` с E.164 CHECK. Для рабочей среды сначала нужно штатно применить миграцию. Отдельная авторизованная staff/config операция должна явно завести официальный номер. `StaffAccount.phone` не является источником настройки. TASK-075 получает эту зависимость rollout, TASK-035 получает ролевой прогон.
- `StudentManagerCard` и `ManagerContacts` используют существующий bootstrap. Пути `/student`, `/student/help` и `/student/suspended` сохранены. При ошибке повторного чтения ссылки из предыдущего назначения скрываются. TASK-067 получает адресный сценарий смены demo пользователя и позднего `/me` во второй вкладке.
- Связь остаётся внешней. Проверки открытия реальных каналов и рабочей конфигурации не запускались. [Миграция](../../../packages/db/prisma/migrations/20261107120000_k8k_student_manager_phone/migration.sql)
