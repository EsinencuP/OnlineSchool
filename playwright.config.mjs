import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [['list'], ['json', { outputFile: '.codex/fnd/playwright.json' }]],
  outputDir: '.codex/fnd/browser-output',
  use: { browserName: 'chromium', headless: true, trace: 'off', video: 'off', screenshot: 'off' },
});
