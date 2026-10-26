# Проверки фазы 0

Актуальное уточнение владельца TASK-14 (27.10.2026): одна рабочая среда Vercel и
одна Neon main, без дополнительных QA/staging/test БД. Старый список ниже сохранён
как история отложенных проверок, а не разрешение создавать эти БД. Integration CI
временно явно пропущен; существующие синтетические/destructive suites нельзя
запускать на рабочей БД. Для TASK-15 нужна совместимая стратегия проверки и явное
разрешение владельца при необходимости исключения; FND-GATE этим не закрыт.

Указание владельца от 26.10.2026: во время отдельных TASK пропускать масштабные,
долгие и повторные проверки. Оставлять только необходимую адресную компиляцию,
генерацию и короткий smoke. Общую крупную проверку выполнять после завершения
нулевой фазы. Выполненные ранее проверки остаются историческими доказательствами;
они не означают, что общий итоговый прогон уже состоялся.

## Отложенная общая проверка

- [ ] Frozen install, recursive typecheck/build/lint и форматирование.
- [ ] Unit/smoke, проверка workspace ESM и отдельного worker-процесса.
- [ ] Worker TASK-11: повторить адресный `test:integration` на отдельной migrated
      `WORKER_TEST_DATABASE_URL` (localhost `online_school_test_task11*`); проверить
      shutdown, lease/reclaim, retry/DEAD и reconciliation вместе с API-регрессией.
- [ ] Полная API-регрессия core + Identity + Finance + Schedule на отдельных БД.
- [ ] DB/SQL-regression, включая конкурентные бронирования и списания, immutable
      audit/ledger, закрытые периоды, replay и неизвестные внешние результаты.
- [ ] Идемпотентный/конкурентный QA seed без дублей и изменения истории.
- [ ] Чистое применение всей цепочки миграций и rehearsal предыдущей схемы с данными;
      status/diff/checksums, сохранность ID, значений и timestamps.
- [ ] Семантическая сверка новых/изменённых регламентов: `docs/regul/online_academy_manager_regulations_v1.0.md` и `docs/regul/online_academy_teacher_regulations_v1.0.md`; Graphify пометил их как требующие обновления.
- [ ] Повторная генерация OpenAPI/SDK без расхождений; Swagger UI/JSON, схемы DTO,
      соответствие фактических ответов, импорт клиента и работа ошибок/CSRF/idempotency.
- [ ] Сквозные роли/MFA/контекст, расписание → подтверждённый факт → разрешённые
      финансовые команды; никаких автоматических оплат/долга из календаря.
- [ ] Постоянный QA HTTPS origin и браузер/физический authenticator, если стенд предоставлен.

Команды общего прогона (пока **не запускать автоматически после каждого TASK**):

```sh
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r build
pnpm -r lint
pnpm format:check
pnpm test
pnpm generate:client
pnpm --filter @online-school/db db:validate
# Четыре отдельные migrated localhost online_school_test*:
# TEST_DATABASE_URL, IDENTITY_TEST_DATABASE_URL,
# FINANCE_TEST_DATABASE_URL, SCHEDULE_TEST_DATABASE_URL
pnpm --filter @online-school/api test:integration
# Отдельная reference-seeded TEST_DATABASE_URL:
pnpm --filter @online-school/db test:integration
# Отдельная QA_DATABASE_URL online_school_qa*:
pnpm --filter @online-school/db test:qa
```

Сброс QA — отдельная явно разрешённая операция, не часть seed или обычной проверки.
Production GO и FND-GATE требуют собственной приёмки; локальные артефакты их не выдают.
