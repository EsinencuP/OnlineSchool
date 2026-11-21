# Кабинет ученика

## Запуск и проверка

```powershell
pnpm --filter @online-school/api build
pnpm --filter @online-school/api start
# В другом терминале:
pnpm --filter @online-school/student-cabinet dev
# http://127.0.0.1:5174/student/login
```

Vite проксирует `/api` на `127.0.0.1:3000`. Для настоящих `__Host-` cookies нужен
действующий HTTPS origin и существующая конфигурация API. Локальный HTTP не
объявляется рабочим стендом аутентификации. Dev-прокси QA-оболочки `/student`
направлен на порт 5174. Вход ученика через прежнюю оболочку переводит в `/student`.

```powershell
pnpm --filter @online-school/student-cabinet build
pnpm --filter @online-school/student-cabinet lint
pnpm test:stu12
pnpm test:stu12:a11y
```

Браузерные команды сами собирают только кабинет. Playwright/Chromium должен быть
установлен (`pnpm exec playwright install chromium`, если отсутствует). Tests используют
отдельный **локальный синтетический HTTP fixture**, не PostgreSQL/Neon/S3. Он запускается
только командой проверки и не включается в bundle. Cookies fixture не являются рабочими
учётными данными. При проверке загрузки реальный fetch PUT перехватывается Playwright.

Существующая сборка Vercel собирает API, QA-оболочку и кабинет, копирует кабинет в
`apps/platform/dist/student`. Корневые rewrites сохраняют прямые `/student/...` ссылки.
Это подготовленная конфигурация: запуск build.mjs применяет рабочие миграции, поэтому
для проверки фронтенда его запускать нельзя. В этой задаче проверены отдельные SPA build.
