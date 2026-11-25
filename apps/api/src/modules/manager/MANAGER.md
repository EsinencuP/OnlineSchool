# API менеджера

## Контекст, guard-ы и ошибки

`ManagerModule` импортирует `CoreModule`, подключён в `AppModule` и ничего не
экспортирует. Последующие manager-контроллеры/сервисы регистрируются внутри этого
модуля и используют только его `ManagerScopeService` для портфолио.

Каждый контроллер обязан иметь `@ManagerRoute()`. Декоратор задаёт существующий
`RequireRole('MANAGER')`, cookie security `sessionCookie`, tag `manager`, ответы
401/403 и `ManagerContextGuard`. Глобальные core Session/RBAC/CSRF/WebAuthn/
Idempotency guards выполняются до controller guard. Общая default-deny политика
и обязательная MFA сотрудников остаются включены. Mixed-role principal также
запрещён: в этом кабинете разрешена только роль MANAGER и kind STAFF.

Core metadata `roleErrorCode` задаёт FORBIDDEN_ROLE для manager-роутов ещё на
глобальном RBAC. `managerProfileErrors` разрешает SessionStore вернуть 403
MANAGER_INACTIVE / MANAGER_PROFILE_NOT_FOUND вместо обычного 401 при валидной
manager-сессии. Эта настройка меняет только диагностику отказа: неактивный профиль
не получает контекст/доступ. Отключённый аккаунт, отозванная/просроченная сессия и
access revocation по-прежнему имеют приоритет и возвращают 401. Обычные маршруты
сохраняют прежний отказ для отсутствующего/неактивного staff-профиля.

`ManagerContextGuard` удаляет старый request.managerCtx, получает профиль только
по доверенному accountId и сохраняет замороженный контекст с managerId/sessionId/
requestId. managerId из query/body/path не используется. Отказы пишутся общим
AuditService без контактов или сведений чужого ученика. HTTP-конвертация Result
выполняется только core `fail`/`unwrap` на границе controller/guard.

`assertStudentInPortfolio` выполняет один scoped `student.findFirst` с проекцией
только `id`. Чужой и отсутствующий корректный UUID используют одинаковую форму
запроса и возвращают одинаковый 404 STUDENT_NOT_FOUND. Некорректный UUID тоже
получает 404. Искусственные задержки не используются; постоянное время работы БД
не обещается. Будущие списки должны применять `AND: [portfolioWhere(ctx), filters]`,
а не перезаписывать scope клиентским фильтром. Предикат учитывает период назначения.

Ошибки data access перехватываются и превращаются в Result DATABASE_ERROR/503
без текста SQL/соединения. Публичные ошибки используют стандартный core ApiError
с requestId, code, message, timestamp. Ответы помечаются core middleware no-store.

## GET /api/v1/manager/me

Возвращает ManagerMeResponseDto: managerId, displayName, role=MANAGER,
portfolioSize, timezone, capabilities. Count применяется к Student с тем же
portfolioWhere; контакты и идентификаторы учеников не загружаются. DTO оформлен
Swagger/class-validator декораторами; клиент генерируется из OpenAPI.

Capabilities показывают полномочия действующей core policy, а не готовность
будущих MGR endpoint-ов:

| Capability                        | Текущая проверка                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| STUDENTS_VIEW                     | student:read                                                                       |
| ACCOUNTS_CREATE                   | student:create; создание аккаунта остаётся отдельной MGR-03 с платёжными условиями |
| SUBSCRIPTIONS_MANAGE              | subscription:create                                                                |
| SCHEDULE_MANAGE                   | schedule:manage                                                                    |
| PAYMENTS_CONFIRM                  | payment:confirm; у обычного менеджера отсутствует и не возвращается                |
| TASKS_PROCESS, NOTIFICATIONS_SEND | Тип зарезервирован; до появления соответствующей core policy не возвращаются       |

MGR-01 не вводит подтверждение платежей менеджером, не отменяет директорские
решения и не реализует бизнес-команды следующих задач.

## MGR-11 — заявки и пробные уроки

Существующие Lead, AssignedManager и LeadStudentLink расширены для воронки.
Таблица соответствий, решения владельца и границы Trial/Finance/CONTACT:
[leads/MGR-11.md](leads/MGR-11.md).
