import { test as base, expect } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

/** Existing task suites keep their destinations unless the isolated gate is explicitly selected. */
export function evidenceUrl(relative, parent) {
  const url = new URL(relative, parent);
  const root = process.env.K8K_STUDENT_GATE_OUTPUT;
  if (!root) return url;
  const match = /\/output\/(k8k-tasks\/TASK-\d{3}|stu12)\/(.*)/.exec(url.pathname);
  if (!match) return url;
  const destination = path.join(root, 'evidence', match[1], decodeURIComponent(match[2]));
  const directory = url.pathname.endsWith('/');
  mkdirSync(directory ? destination : path.dirname(destination), { recursive: true });
  return pathToFileURL(destination + (directory ? path.sep : ''));
}

export const test = base.extend({
  context: async ({ context }, use, info) => {
    if (info.config.metadata.studentGate) {
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === 'http://127.0.0.1:4175'
          ? route.fallback()
          : route.abort(),
      );
    }
    await use(context);
  },
  page: async ({ page }, use, info) => {
    if (info.config.metadata.studentGate) {
      const screenshot = page.screenshot.bind(page);
      page.screenshot = async (options = {}) => {
        const result = await screenshot({
          ...options,
          mask: [
            ...(options.mask ?? []),
            page.locator(
              'input[type=password], input[autocomplete=one-time-code], input[name=otp], input[name=code]',
            ),
          ],
        });
        if (options.path)
          appendFileSync(
            path.join(process.env.K8K_STUDENT_GATE_OUTPUT, 'screenshots.jsonl'),
            JSON.stringify({
              taskId: 'TASK-035',
              test: info.title,
              route: new URL(page.url()).pathname + new URL(page.url()).search,
              locale: await page.locator('html').getAttribute('lang'),
              viewport: page.viewportSize(),
              browserViewport: await page.evaluate(() => ({
                width: globalThis.innerWidth,
                height: globalThis.innerHeight,
                dpr: globalThis.devicePixelRatio,
              })),
              evidence: path.relative(process.cwd(), options.path).replaceAll('\\', '/'),
            }) + '\n',
          );
        return result;
      };
    }
    await use(page);
  },
});
export { expect };
