import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: '../../output/stu12/playwright.json' }]],
  outputDir: '../../output/stu12/browser',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1600, height: 1000 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tests/fixture-server.mjs',
    url: 'http://127.0.0.1:4175/student',
    reuseExistingServer: !process.env.CI,
  },
});
