import { fileURLToPath } from 'node:url';
import base from './playwright.config.mjs';

export default {
  ...base,
  reporter: 'line',
  metadata: { subjectHubEvidence: '../../../output/k8k-tasks/TASK-026/hub-regression/' },
  outputDir: '../../output/k8k-tasks/TASK-026/test-results',
  use: { ...base.use, trace: 'off' },
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    reuseExistingServer: false,
  },
};
