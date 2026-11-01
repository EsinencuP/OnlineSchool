import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test',
  testMatch: '*.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: '../../output/mgr10/playwright.json' }]],
  outputDir: '../../output/mgr10/browser',
  use: {
    baseURL: 'http://127.0.0.1:5177',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: 'pnpm dev --mode mock',
    url: 'http://127.0.0.1:5177/manager/',
    reuseExistingServer: !process.env.CI,
  },
});
