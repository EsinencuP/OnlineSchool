import { fileURLToPath } from 'node:url';
import base from './playwright.config.mjs';
export default {
  ...base,
  testMatch: ['bell.spec.mjs', 'student.spec.mjs'],
  grep: /TASK-033|read-all resets/,
  reporter: [['list'], ['json', { outputFile: '../../output/k8k-tasks/TASK-033/playwright.json' }]],
  outputDir: '../../output/k8k-tasks/TASK-033/test-results',
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    reuseExistingServer: false,
  },
};
