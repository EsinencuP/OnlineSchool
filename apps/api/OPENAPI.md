# TASK-10 — OpenAPI и TypeScript-клиент

`GET /api/docs` отдаёт Swagger UI, `GET /api/docs-json` — OpenAPI **3.1.0**, версия
API **v1**. Спецификация содержит 46 реальных бизнес-операций Identity/CRM/Finance/
Schedule и health/CSRF. Универсальных CRUD-маршрутов не добавлено.

Источник контракта — декораторы NestJS Swagger на реальных контроллерах и
`src/openapi/dtos.ts`: классы DTO, ApiProperty и class-validator на каждом поле,
TypeScript enum для перечислений. Операции описывают summary/description, конкретный
Response DTO, ошибки 400/401/403 и дополнительные доменные статусы, CSRF,
Idempotency-Key и X-Request-ID. На критических командах ключ идемпотентности отмечен
обязательным; документация не ослабляет требования ядра.

DtoValidationPipe проверяет тела без преобразования строк в числа и без изменения
исходного payload hash. Предметные команды сохраняют строгие проверки допустимых
полей, контекста и условных правил. Денежные поля — string с точным шаблоном;
JSON number отклоняется как INVALID_MONEY/422. Доверие к WebAuthn не заменено DTO:
криптография, challenge, RP/origin и replay по-прежнему проверяются Identity.

В Swagger нет секретов, сессий или текущих персональных данных. Документационные
маршруты получают X-Request-ID; Swagger не сохраняет введённую авторизацию.
Открытый UI не обходит роли/MFA/CSRF бизнес-маршрутов.

## Генерация и использование

```sh
pnpm generate:client
```

Команда компилирует API, экспортирует Swagger JSON и запускает **orval 8.45.0** плюс
openapi-typescript. Результаты сохраняются в `packages/api-contracts/src/generated/`:
`client.ts` — fetch-клиент, `openapi.ts` — типы схемы/операций.
Это исходные артефакты; сервер и браузер не генерируют клиент во время выполнения.
Файлы не исключены из Git. В этой рабочей папке Git-репозиторий не инициализирован,
поэтому Git-коммит не создавался.

QA-shell импортирует функции и типы через `src/api.ts` из workspace-пакета
`@online-school/api-contracts`. Пример команды:

```ts
import { getCsrfToken, registerPayment } from '@online-school/api-contracts';

const csrf = await getCsrfToken();
if (csrf.ok) {
  const result = await registerPayment(
    { studentId, amount: '100.0000', currency: 'MDL' },
    {
      headers: {
        'X-CSRF-Token': csrf.value.csrfToken,
        'Idempotency-Key': crypto.randomUUID(),
      },
    },
  );
  // result — Result<PaymentReceiptResponse, ClientError>.
}
```

Для повторной доставки той же команды вызывающий сохраняет исходный Idempotency-Key.
Transport не повторяет mutations и не создаёт ключи автоматически. Cookies идут с
credentials=include; ошибки HTTP/сети возвращаются Result, без голых исключений.
Для Node/явно настроенного API допустим `{ baseUrl }`; браузер по умолчанию использует
тот же origin. CSRF, cookies и постоянный HTTPS QA-домен настраиваются по Identity
runbook; preview origins не становятся доверенными.

Выполнены только короткие адресные проверки: генерация клиента, компиляция API/
contracts/QA-shell, UI/JSON 200, общие metadata/локальные $ref, вызов health через SDK
и отклонение числового денежного DTO. Полная регрессия и интеграционная приёмка —
[в конце фазы 0](../../PHASE0_CHECKS.md).

[NestJS Swagger](https://docs.nestjs.com/openapi/introduction) ·
[Orval fetch](https://github.com/orval-labs/orval/blob/master/docs/content/docs/guides/fetch.mdx).
