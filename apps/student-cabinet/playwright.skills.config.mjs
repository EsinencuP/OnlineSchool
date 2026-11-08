import { fileURLToPath } from 'node:url';
import base from './playwright.config.mjs';
export default {
  ...base,
  testMatch: ['student.spec.mjs', 'skill-map.spec.mjs'],
  grep: /TASK-031|four skill states/,
  reporter: [['list'], ['json', { outputFile: '../../output/k8k-tasks/TASK-031/playwright.json' }]],
  outputDir: '../../output/k8k-tasks/TASK-031/test-results',
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    reuseExistingServer: false,
  },
};
