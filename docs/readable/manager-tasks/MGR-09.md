> Исходный текст из [пакета Модуль 2](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%D0%9A%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%20%D0%BC%D0%B5%D0%BD%D0%B5%D0%B4%D0%B6%D0%B5%D1%80%D0%B0.md). Обязательны [общие инварианты и поздние решения владельца](COMMON.md).

### MGR-09: Дашборд менеджера

**Приоритет:** P1 · **Сложность:** M · **Архитектурные ссылки:** INV-01, INV-05, INV-14, INV-15; зависит от MGR-02, MGR-04, MGR-06, MGR-07.

#### Контекст и бизнес-правила

1. Один эндпоинт `GET /api/v1/manager/dashboard` возвращает сводку по портфолио: активные ученики, ближайшие уроки, просроченные задачи, истекающие абонементы и ожидающие оплаты. Только чтение, Audit не нужен.
2. **Определения** (единые с остальными задачами; дашборд переиспользует их спецификации запросов и не реализует собственные фильтры):
   - активные ученики — статус `ACTIVE` с действующим абонементом (MGR-02); отдельно счётчики `FROZEN` и `LEAD`;
   - ближайшие уроки — статус «запланирован», начало в интервале `[now, now + lessonsHorizonHours]` (MGR-06), не более 10 в списке;
   - просроченные задачи — как в MGR-07 (`dueAt < now`, статус `OPEN` или `IN_PROGRESS`), счётчик и топ-5 по давности;
   - истекающие абонементы — `ACTIVE`, `endsAt` в интервале `(now, now + expiringDays]`, замороженные исключаются (MGR-04), не более 10;
   - ожидающие оплаты — платежи `PENDING` и `AWAITING_APPROVAL` (MGR-05): количество и суммы по валютам.
3. Параметры: `lessonsHorizonHours` ∈ {24, 48, 168} (по умолчанию 48), `expiringDays` ∈ {3, 7, 14} (по умолчанию 7).
4. Данные читаются в одной read-only транзакции с единым снимком (согласованность счётчиков и списков), не более 8 запросов.
5. Кэш в первой версии не вводится (нет рассинхронизации с финансами и расписанием). **Целевой p95 ответа ≤ 300 мс при портфеле до 500 учеников — предположение, подтвердить на нагрузочном тесте.**
6. Пустой портфель → 200 с нулями и пустыми массивами.

#### Контракты

```ts
export class DashboardQueryDto {
  @IsOptional() @Type(() => Number) @IsIn([24, 48, 168]) lessonsHorizonHours: number = 48;
  @IsOptional() @Type(() => Number) @IsIn([3, 7, 14]) expiringDays: number = 7;
}

export class ManagerDashboardDto {
  generatedAt!: string;
  students!: { active: number; frozen: number; leads: number };
  upcomingLessons!: { lessonId: string; studentId: string; studentName: string; startsAt: string; teacherName: string; hasMeetLink: boolean }[];
  overdueTasks!: { count: number; top: { taskId: string; type: ManagerTaskType; studentName: string; dueAt: string }[] };
  expiringSubscriptions!: { subscriptionId: string; studentId: string; studentName: string; endsAt: string; remainingLessons: number }[];
  pendingPayments!: { count: number; totalsByCurrency: { currency: string; amount: string }[] };   // amount — Decimal как строка
}

export interface ManagerDashboardService {
  get(ctx: ManagerContext, q: DashboardQueryDto): Promise<Result<ManagerDashboardDto, DomainError>>;
}
```

Суммы считаются агрегатом `Decimal` в БД или `decimal.js`, в ответ уходят строками (INV-05).

#### Безопасность и обработка исключений

- Все запросы строятся от `portfolioWhere(ctx)`; идентификаторы чужих учеников не могут попасть ни в счётчики, ни в списки.
- Значения параметров вне разрешённых → 422; ошибки БД → `Result` с обобщённым кодом без деталей.
- Дашборд не раскрывает контакты и учебные данные (только имена и идентификаторы).

#### Критерии готовности

- [ ] Счётчики и списки совпадают с результатами эндпоинтов MGR-02/04/06/07 при тех же фильтрах (тест согласованности на общем наборе данных)
- [ ] Данные чужого портфолио не попадают в ответ (тест с двумя менеджерами)
- [ ] Замороженные абонементы не попадают в «истекающие», границы `expiringDays` покрыты тестами на полуночи школьной таймзоны
- [ ] Суммы `pendingPayments` — строки, без потери точности (тест с четырьмя знаками)
- [ ] Пустой портфель → корректный пустой ответ
- [ ] Не более 8 запросов, единый снимок (тест на счётчик запросов)
- [ ] Нагрузочный тест: p95 ≤ 300 мс на 500 учениках зафиксирован в отчёте
- [ ] STUDENT/TEACHER/ADMIN → 403, анонимный → 401
- [ ] OpenAPI и клиент перегенерированы

---

