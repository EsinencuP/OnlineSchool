> Исходный текст из [пакета Модуль 2](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%D0%9A%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%20%D0%BC%D0%B5%D0%BD%D0%B5%D0%B4%D0%B6%D0%B5%D1%80%D0%B0.md). Обязательны [общие инварианты и поздние решения владельца](COMMON.md).

### MGR-03: Создание аккаунта ученика после первой оплаты (СЦ-М-01)

**Приоритет:** P0 · **Сложность:** L · **Архитектурные ссылки:** INV-01, INV-03, INV-04, INV-09, INV-10, INV-11, INV-12; зависит от MGR-02, MGR-05; использует Identity-модуль (AuthAccount).

#### Контекст и бизнес-правила

1. Аккаунт создаётся только для ученика из портфолио, у которого ещё нет аккаунта и есть **подтверждённая и опубликованная в Ledger первая оплата** (MGR-05). Если оплата неполная или в рассрочку, дополнительно требуется допуск руководителя (CON-01–11); иначе 409 `FIRST_PAYMENT_NOT_CONFIRMED`.
2. Аккаунт создаётся существующим сервисом Identity (метод создания аккаунта ученика, возвращающий Result). Свой механизм хеширования в Manager-модуль не добавляется.
3. Временный пароль: генерируется на сервере из CSPRNG, 16 символов без неоднозначных (`0O1lI`), хешируется тем же алгоритмом, что и обычные пароли. Срок действия — 72 часа, флаг `mustChangePassword = true`. До смены пароля любой запрос ученика, кроме смены пароля и выхода, → 403 `PASSWORD_CHANGE_REQUIRED` (если в Identity этого ещё нет, расширение входит в задачу).
4. Пароль возвращается **один раз** в теле ответа с `Cache-Control: no-store`. Он не пишется в Audit, Outbox, логи, кэш идемпотентности и OpenAPI-примеры (INV-12).
5. Повтор запроса с тем же `Idempotency-Key` возвращает 200 с `temporaryPassword: null` и `passwordAlreadyIssued: true`; новый пароль выдаётся через `reset-password`.
6. Уведомление ученику (через Outbox → MGR-08) содержит логин и инструкцию, **без пароля**. Пароль менеджер передаёт по согласованному каналу.
7. Не более одного активного аккаунта на ученика: гарантия — частичный UNIQUE в БД; гонка двух запросов → один успех, второй 409 `ACCOUNT_ALREADY_EXISTS`.
8. Сброс пароля: новый временный пароль, отзыв всех сессий ученика, не более 3 раз в сутки на ученика.

#### Контракты

```ts
// dto/student-account.dto.ts
export class CreateStudentAccountDto {
  @IsEmail() @MaxLength(254) loginEmail!: string;
}

export class StudentAccountIssuedDto {
  accountId!: string;
  loginEmail!: string;
  temporaryPassword!: string | null;      // только в первом ответе
  temporaryPasswordExpiresAt!: string;    // ISO-8601
  passwordAlreadyIssued!: boolean;
}

export interface ManagerAccountsService {
  createAccount(ctx: ManagerContext, studentId: string, dto: CreateStudentAccountDto,
    idempotencyKey: string): Promise<Result<StudentAccountIssuedDto, DomainError>>;
  resetPassword(ctx: ManagerContext, studentId: string,
    idempotencyKey: string): Promise<Result<StudentAccountIssuedDto, DomainError>>;
}

export type AccountErrorCode =
  | 'FIRST_PAYMENT_NOT_CONFIRMED' | 'ACCOUNT_ALREADY_EXISTS' | 'EMAIL_ALREADY_USED'
  | 'ACCOUNT_NOT_FOUND' | 'RESET_LIMIT_EXCEEDED' | 'PASSWORD_CHANGE_REQUIRED';
```

Эндпоинты: `POST /api/v1/manager/students/:studentId/account` → 201 `StudentAccountIssuedDto`; `POST /api/v1/manager/students/:studentId/account/reset-password` → 200 `StudentAccountIssuedDto`. Оба требуют CSRF и `Idempotency-Key`.

Prisma: `AuthAccount` — `mustChangePassword Boolean @default(false)`, `passwordExpiresAt DateTime?` (если полей нет); частичный UNIQUE на активный аккаунт ученика уже есть в схеме — проверить, не дублировать.

#### Алгоритм (одна транзакция SERIALIZABLE, retry ≤ 3)

1. `SELECT ... FOR UPDATE` строки ученика, затем `assertStudentInPortfolio`.
2. Проверка отсутствия аккаунта и наличия подтверждённой первой оплаты (чтение статуса платежа и его публикации в Ledger — только чтение).
3. Создание аккаунта через Identity, привязка к ученику.
4. Audit `STUDENT_ACCOUNT_CREATED` (studentId, accountId, маскированный email; **без пароля**).
5. Outbox `STUDENT_ACCOUNT_CREATED` → MGR-08.
6. Сохранение ответа идемпотентности **без** пароля.

#### Безопасность и обработка исключений

- Чужой ученик → 404; `EMAIL_ALREADY_USED` не раскрывает, кому принадлежит email.
- Отказ Audit или Outbox откатывает создание аккаунта целиком.
- Сброс пароля отзывает сессии и ключи доступа ученика до выдачи нового пароля, в той же транзакции.
- Rate limit на создание и сброс (по менеджеру и по ученику).

#### Критерии готовности

- [ ] Приёмочный тест СЦ-М-01 (e2e): лид → оплата подтверждена и опубликована (MGR-05) → создание аккаунта → ученик входит с временным паролем → получает `PASSWORD_CHANGE_REQUIRED` → меняет пароль → открывает кабинет ученика
- [ ] Без подтверждённой первой оплаты → 409 `FIRST_PAYMENT_NOT_CONFIRMED`; неполная оплата без допуска руководителя → тот же код
- [ ] Гонка двух одновременных запросов: ровно один аккаунт в БД
- [ ] Повтор с тем же ключом → 200 без пароля; другой body → 409 `IDEMPOTENCY_KEY_REUSED`
- [ ] Пароль отсутствует в Audit, Outbox, логах и таблице идемпотентности (тест сканирует записи после выполнения)
- [ ] Ответ содержит `Cache-Control: no-store`
- [ ] Сброс пароля: сессии ученика отозваны, 4-й сброс за сутки → 429/409 `RESET_LIMIT_EXCEEDED`
- [ ] Откат при принудительном отказе Audit и при отказе Outbox оставляет БД без аккаунта
- [ ] Чужой ученик → 404; STUDENT/TEACHER/ADMIN → 403; без CSRF → 403
- [ ] Нет прямой записи в `LedgerEntry` (архитектурный тест INV-03)
- [ ] OpenAPI и клиент перегенерированы

---

