# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.mjs >> legacy student notifications opens the K8K bell
- Location: tests\navigation.spec.mjs:3:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/student\?events=1$/
Received string:  "http://127.0.0.1:4175/student?ui.k8k=1&events=1"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    - locator resolved to <html lang="ru" data-k8k="provisional">…</html>
    - unexpected value "http://127.0.0.1:4175/student/notifications?ui.k8k=1"
    13 × locator resolved to <html lang="ru" data-k8k="provisional">…</html>
       - unexpected value "http://127.0.0.1:4175/student?ui.k8k=1&events=1"

```

```yaml
- dialog "Последние события":
  - banner:
    - heading "Последние события" [level=2]
    - button "Закрыть окно"
  - paragraph: Событие ведёт к исходному объекту. Отметка прочтения не выполняет действие по нему.
  - button "Прочитать все"
  - button "Обновить события"
  - status: "Непрочитанных во всей ленте: 2 · Всего событий: 1"
  - paragraph:
    - text: Получено в
    - time: 8 ноября в 12:46
    - text: · Europe/Chisinau
  - list:
    - listitem:
      - paragraph: ДЗ на доработке
      - heading "Преподаватель проверил работу" [level=3]
      - paragraph: Добавь ещё один пример и отправь новую версию.
      - time: 8 ноября 2026 г. в 12:46
      - paragraph: Не прочитано
      - button "Отметить прочитанным"
```

# Test source

```ts
  1  | import { expect, test } from './gate-fixtures.mjs';
  2  | 
  3  | test('legacy student notifications opens the K8K bell', async ({ request, context, page }) => {
  4  |   await request.post('/__fixture/reset', { data: {} });
  5  |   await context.addCookies((await request.storageState()).cookies);
  6  |   await page.goto('/student/notifications?ui.k8k=1');
> 7  |   await expect(page).toHaveURL(/\/student\?events=1$/);
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  8  |   const bell = page.locator('.k8k-notification-menu');
  9  |   await expect(bell).toHaveAttribute('open', '');
  10 |   await expect(bell.getByText('Преподаватель проверил работу')).toBeVisible();
  11 |   await page.keyboard.press('Escape');
  12 |   await expect(bell.locator('summary')).toBeFocused();
  13 |   await expect(bell).not.toHaveAttribute('open');
  14 | });
  15 | 
```