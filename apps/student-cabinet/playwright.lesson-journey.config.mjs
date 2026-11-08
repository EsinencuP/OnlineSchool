import { fileURLToPath } from 'node:url';
import base from './playwright.config.mjs';

export default {
  ...base,
  testMatch: 'lesson-journey.spec.mjs',
  reporter: [['list'], ['json', { outputFile: '../../output/k8k-tasks/TASK-029/playwright.json' }]],
  outputDir: '../../output/k8k-tasks/TASK-029/test-results',
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    reuseExistingServer: false,
  },
};
