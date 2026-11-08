import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { startFixture } from '../apps/student-cabinet/tests/fixture-server.mjs';
const require = createRequire(new URL('../apps/manager-web/package.json', import.meta.url));
const AxeBuilder = require('@axe-core/playwright').default;
const directory = resolve('output/k8k-redesign');
await mkdir(directory, { recursive: true });
const fixture = startFixture(4175);
const platformRoot = resolve('apps/platform/dist');
const platform = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  const target = path.startsWith('/assets/')
    ? resolve(platformRoot, '.' + path)
    : resolve(platformRoot, 'index.html');
  if (!target.startsWith(platformRoot + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const content = await readFile(target);
    res.writeHead(200, {
      'Content-Type':
        {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
        }[extname(target)] ?? 'application/octet-stream',
    });
    res.end(content);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4178, '127.0.0.1');
const browser = await chromium.launch();
const selectedRoles = process.argv.slice(2);
const roles = selectedRoles.length
  ? selectedRoles
  : ['student', 'manager', 'teacher', 'director', 'operator'];
let previousRows = [];
if (selectedRoles.length) {
  try {
    previousRows = JSON.parse(
      await readFile(resolve(directory, 'browser.json'), 'utf8'),
    ).rows.filter((row) => !roles.some((role) => row.name.startsWith(role + '-')));
  } catch {
    /* First run has no previous evidence. */
  }
}
const findings = previousRows.filter((row) => row.overflow || row.violations.length);
const rows = [...previousRows];
const now = Date.now();
const workspace = {
  name: 'Анна Тестовая',
  role: 'TEACHER',
  lessons: Array.from({ length: 6 }, (_, i) => ({
    id: `lesson-${i}`,
    startsAt: new Date(now + (i + 1) * 3600000).toISOString(),
    endsAt: new Date(now + (i + 2) * 3600000).toISOString(),
    status: 'SCHEDULED',
    subject: i % 2 ? 'Математика' : 'Английский язык',
    student: 'София Тестовая',
    teacher: 'Анна Тестовая',
    meetUrl: null,
  })),
  students: [{ id: 'student-1', name: 'София Тестовая', subject: 'Английский язык' }],
  homework: [
    {
      id: 'homework-1',
      title: 'Практика разговорной речи',
      subject: 'Английский язык',
      dueAt: new Date(now + 86400000).toISOString(),
    },
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Связаться по вопросу переноса занятия',
      status: 'NEW',
      dueAt: new Date(now - 3600000).toISOString(),
      manager: 'Тамара Тестовая',
    },
  ],
};
async function check(page, name, { baseline = false } = {}) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  const overflow = await page.evaluate(
    () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
  );
  const violations = baseline
    ? []
    : (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      }));
  const shot = name + '.png';
  await page.screenshot({ path: resolve(directory, shot), fullPage: true });
  rows.push({ name, overflow, violations, screenshot: shot });
  if (overflow || violations.length) findings.push(rows.at(-1));
  await writeFile(
    resolve(directory, 'browser-progress.json'),
    JSON.stringify({ rows, findings }, null, 2),
  );
  console.log(name, overflow ? 'OVERFLOW' : 'fit', violations.map((v) => v.id).join(','));
}
try {
  for (const role of roles) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (e) => findings.push({ role, pageerror: e.message }));
    if (!['student', 'manager'].includes(role)) {
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        const roleCode = { teacher: 'TEACHER', director: 'DIRECTOR', operator: 'TECH_OPERATOR' }[
          role
        ];
        const responses = {
          '/api/v1/auth/session': {
            account: { id: 'staff-test', kind: 'STAFF', roles: [roleCode] },
            mfa_completed: true,
            recovery_only: false,
            expires_at: new Date(now + 86400000).toISOString(),
          },
          '/api/v1/platform/accounts': { enabled: false, currentKey: null, items: [] },
          '/api/v1/platform/workspace': {
            ...workspace,
            role: roleCode,
            name: role === 'director' ? 'Елена Тестовая' : workspace.name,
          },
          '/api/v1/qa/components': { api: 'ok', db: 'ok', worker: 'ok' },
        };
        await route.fulfill({
          status: responses[path] ? 200 : 404,
          contentType: 'application/json',
          body: JSON.stringify(responses[path] ?? {}),
        });
      });
    }
    const origin =
      role === 'student'
        ? 'http://127.0.0.1:4175'
        : role === 'manager'
          ? 'http://127.0.0.1:5177'
          : 'http://127.0.0.1:4178';
    for (const width of [360, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ['0', '1']) {
        await page.goto(`${origin}/${role}/?ui.k8k=${theme}`);
        await page.locator('h1').first().waitFor({ timeout: 60000 });
        if (role === 'student') await page.locator('.summary-grid').waitFor();
        if (role === 'manager') await page.locator('.dashboard-metrics').waitFor();
        await check(page, `${role}-home-${width}-${theme === '1' ? 'after' : 'before'}`, {
          baseline: theme === '0',
        });
      }
    }
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      const routes =
        role === 'student'
          ? ['lessons', 'homework', 'skills', 'materials', 'subscription', 'profile']
          : role === 'manager'
            ? ['students', 'leads', 'schedule', 'tasks']
            : [];
      for (const route of routes) {
        await page.goto(`${origin}/${role}/${route}?ui.k8k=1`);
        await page.locator('h1').first().waitFor({ timeout: 60000 });
        await check(page, `${role}-${route}-${width}`);
      }
      if (['teacher', 'director'].includes(role)) {
        await page.goto(`${origin}/${role}/?ui.k8k=1`);
        await page.locator('.work-focus').waitFor();
        for (const title of [
          'Расписание',
          role === 'director' ? 'Ученики школы' : 'Мои ученики',
          role === 'director' ? 'Задачи менеджеров' : 'Домашние задания',
        ]) {
          await page
            .getByRole('navigation', { name: 'Разделы кабинета' })
            .getByRole('button', { name: title, exact: true })
            .click();
          await check(page, `${role}-tab-${title}-${width}`);
        }
      }
    }
    await context.close();
  }
} finally {
  await writeFile(
    resolve(directory, 'browser.json'),
    JSON.stringify(
      {
        boundary:
          'Synthetic local fixtures only. No working API, database, S3, financial writes or external messages.',
        rows,
        findings,
      },
      null,
      2,
    ),
  );
  await browser.close();
  fixture.close();
  platform.close();
}
if (findings.length) process.exitCode = 1;
