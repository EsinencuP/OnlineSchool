# TASK-027 — проектирование до правок

Действующий `ManagerContactsDto` получает `displayName?: string | null` и `phoneE164?: string | null`. `studentManagerContacts(client, studentId)` выбирает текущее назначение по Student.id и времени, затем проверяет staff/login/роль. Имя берётся из StaffAccount.full_name назначенного сотрудника. `student_phone_e164` — отдельная nullable колонка с проверкой E.164. Данные из StaffAccount.phone не переносятся.

`projectManagerContacts(value)` пропускает только whatsapp, telegram, displayName, phoneE164. `studentAccessSuspended(contacts)` использует этот контакт и существующий ACCESS_SUSPENDED. ErrorMapper выдаёт контакт только для 402 ACCESS_SUSPENDED. MeService не читает контакт при требовании первоначальной смены пароля. Bootstrap и операции не расширяются. Для деплоя исходников нужен предварительно применённый additive SQL владельцем среды.

`StudentManagerCard({ contacts, unavailable?, id? })` и `ManagerContacts({ contacts, unavailable? })` используют тот же снимок /me на домашней, в помощи, legacy вариантах и на экране ограничения. `StudentViewProfile.managerContactsUnavailable` сообщает об ошибке текущего чтения без использования прежних ссылок. Активное и suspended /me обновляются существующей политикой авторизации и при возвращении фокуса. Смена сессии остаётся в account-ui. Новых URL, API, каналов отправки и прав записи нет.
