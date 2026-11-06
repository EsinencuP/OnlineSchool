# TASK-018 design note — 04.11.2026, до реализации

Prererequisite: TASK-017 report/verification и текущие исходники. Новых бизнес-прав нет.

Существуют: AccountContext.accountId (auth account), TeacherAccount.id, StaffAccount.id;
workspace фильтрует TEACHER по teacher profile, директор читает school scope. ManagerScope
требует собственный активный staff profile и временное назначение контакта. Core Session/RBAC
проверяет session/revocation/MFA; manager password-only исключение действует только на
manager routes. Student /me — отдельная граница, её контракт не заменяется.

Planned additive DTO:
- StaffActorContextDto: accountId, role, staffProfileId|null, teacherProfileId|null,
  displayName, timezone, timezoneSource=SCHOOL_CONFIGURATION|SCHOOL_DEFAULT, asOf (DB clock),
  accountUpdatedAt|null, profileUpdatedAt|null. receivedAt только на клиенте; asOf не ledger fact.
- StaffActionEligibilityDto: action, objectId|null, revision|null, allowed, reason|null,
  asOf, sourceUpdatedAt|null. Для команд без revision precondition revision=null;
  updated_at не подменяет optimistic revision. Это advisory; запись повторно проверяет policy.
- WorkspacePageInfoDto(limit,returned,hasMore,total:null), WorkspaceCoverageDto
  (scope,windowFrom|null,windowTo|null,sourceUpdatedAt|null,pageInfo),
  WorkspaceCoverageSetDto(lessons,students,homework,tasks).
- PlatformWorkspaceDto += actorContext, coverage; ManagerMeResponseDto += actorContext;
  ManagerCapability += PAYMENTS_REQUEST_APPROVAL (не PAYMENTS_CONFIRM).

Planned operations:
- getStaffActorContext: GET /api/v1/platform/actor-context; teacher/director/operator;
  manager получает тот же context через существующий getManagerMe с его MFA exception.
- getTeacherLessonStartEligibility: GET /api/v1/platform/lessons/:id/start-eligibility.
- getDirectorPaymentConfirmationEligibility: GET /api/v1/platform/payments/:id/confirm-eligibility.
- getManagerPaymentApprovalEligibility: GET /api/v1/manager/payments/:paymentId/approval-eligibility.

Переиспользование: Teacher OutcomesService start checks и PaymentsService confirm checks
выделяются для read/command, менеджерский workflow использует тот же publication policy
(APPROVAL_REQUIRED означает разрешённую передачу директору). Read path не пишет и не берёт
FOR UPDATE. Neutral unavailable не возвращает чужие ID/revision/timestamps. Deactivation
и отозванный context запрещают дальнейшее allowed, HTTP guards имеют приоритет над metadata.
Workspace получает limit+1 probe и стабильный порядок, без глобальных KPI/фиктивного total=0.

Нет миграций/новых зависимостей/реальных DB запросов при проверках. Safe tests: in-memory
Prisma stubs + Nest HTTP. Штатный export OpenAPI не вызывает app.init/listen; DB provider lazy.
После source checks: api build → export:openapi → generate:client → contracts build → consumers.
UI задач TASK-019+ не подменяется новым role screen.

Уточнение consumer review до правок UI: platform App.tsx хранит второй handwritten
Workspace и выдаёт длины ограниченных массивов за общее количество. Planned:
использовать generated PlatformWorkspaceDto; local StaffCoverageNote(coverage?)
явно маркирует loaded selection/unknown total/hasMore на RU/RO. Новых действий нет.
Browser target test:staff-context — реальный App, synthetic session/workspace,
intercept-only loopback, RU/RO×4. Остальные ролевые тексты — TASK-037/047/063/069.
