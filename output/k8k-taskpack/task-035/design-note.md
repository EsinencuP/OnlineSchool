# TASK-035 — план приёмки

Новых product DTO/operation/migration/бизнес-правил не планируется. Используются существующие student operations и generated SDK после TASK-024…034. Новые интерфейсы только тестовые: отдельный playwright.student-gate.config.mjs, script test:k8k-student-gate и metadata.evidenceRoot для перенаправления доказательств в изолированный каталог.

Проверка имеет три решения: функциональная локальная готовность, визуальная/доступность, внешние release-условия. DB/provider/OAuth/S3/cookies/migration rehearsal остаются NOT_RUN без разрешённой среды. Итог student rollout — GO только при выполненных обязательных условиях; локальный fixture PASS не является production/FND GO.

Доказательства: текущий HEAD плюс dirty manifest 214 исходников; свежие source builds, student unit/HTTP/SDK mocks, presentation, новый fixture-only Playwright config, общий путь, negative suites, RU/RO × 360/768/1024/1280, zoom/keyboard/reduced motion, route gzip/fonts и 25 контрастных пар. Ранние отчёты — prerequisites/baseline, не свежие проверки.

Последние owner visual/motion правила от08.11 имеют приоритет над историческим шаблоном. Существующие функциональные ожидания сохраняются; устаревшие селекторы/названия допускается адаптировать только под фактическое утверждённое поведение, без ослабления проверяемого условия.
