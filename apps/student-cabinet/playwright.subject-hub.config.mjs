import { fileURLToPath } from 'node:url';
import base from './playwright.config.mjs';

export default {
  ...base,
  testDir: './tests',
  reporter: 'line',
  outputDir: '../../output/k8k-tasks/TASK-025/test-results',
  use: { ...base.use, screenshot: 'off', trace: 'off' },
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    reuseExistingServer: false,
    env:
      process.argv.includes('--grep') && process.argv.includes('subject-baseline')
        ? {
            STUDENT_FIXTURE_DIST: fileURLToPath(
              new URL('../../output/k8k-tasks/TASK-025/baseline-dist/', import.meta.url),
            ),
          }
        : {},
  },
};
