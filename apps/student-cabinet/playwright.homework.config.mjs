import { fileURLToPath } from 'node:url';
import base from './playwright.config.mjs';
export default {
  ...base,
  testMatch: ['student.spec.mjs', 'homework-redesign.spec.mjs'],
  grep: /TASK-030|debounce, server|failed save|confirmation and submission|serialized slow|logout discards/,
  reporter: [['list'], ['json', { outputFile: '../../output/k8k-tasks/TASK-030/playwright.json' }]],
  outputDir: '../../output/k8k-tasks/TASK-030/test-results',
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    reuseExistingServer: false,
  },
};
