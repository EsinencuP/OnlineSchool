import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startFixture, lessonId, homeworkId } from './fixture-server.mjs';
const server = startFixture(4176);
const browser = await chromium.launch({ args: ['--remote-debugging-port=9229'] });
const routes = [
  '',
  '/lessons',
  `/lessons/${lessonId}`,
  '/homework',
  `/homework/${homeworkId}`,
  '/skills',
  '/materials',
  '/subscription',
  '/notifications',
  '/profile',
  '/security',
  '/security/change-password',
  '/suspended',
  '/login',
];
const results = [];
try {
  for (const path of routes) {
    const result = await lighthouse(
      `http://127.0.0.1:4176/student${path}`,
      { port: 9229, onlyCategories: ['accessibility'], output: 'json', logLevel: 'error' },
      {
        extends: 'lighthouse:default',
        settings: {
          formFactor: 'desktop',
          screenEmulation: {
            mobile: false,
            width: 1600,
            height: 1000,
            deviceScaleFactor: 1,
            disabled: false,
          },
          throttlingMethod: 'provided',
        },
      },
    );
    const lhr = result.lhr;
    const failures = Object.values(lhr.audits)
      .filter((a) => a.score !== null && a.score < 1 && a.details?.items?.length)
      .map((a) => ({
        id: a.id,
        title: a.title,
        nodes: a.details.items.flatMap((i) =>
          i.node ? [{ selector: i.node.selector, explanation: i.node.explanation }] : [],
        ),
      }));
    results.push({
      route: `/student${path}`,
      score: Math.round(lhr.categories.accessibility.score * 100),
      failures,
    });
    console.log(`${results.at(-1).score}: /student${path}`);
  }
  await mkdir('../../output/stu12', { recursive: true });
  await writeFile(
    '../../output/stu12/accessibility.json',
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        lighthouseVersion: '13.6.0',
        boundary: 'Production bundle, local synthetic API only; no working DB or S3 writes',
        results,
      },
      null,
      2,
    ),
  );
  if (results.some((r) => r.score < 90)) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
