import { fileURLToPath } from 'node:url';
import base from './playwright.config.mjs';

export default {
  ...base,
  reporter: 'line',
  outputDir: '../../output/k8k-tasks/TASK-027/test-results',
  metadata: { subjectHubEvidence: '../../../output/k8k-tasks/TASK-027/hub-regression/' },
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    reuseExistingServer: false,
  },
};
