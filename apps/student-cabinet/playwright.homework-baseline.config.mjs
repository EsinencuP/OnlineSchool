import { fileURLToPath } from 'node:url';
import base from './playwright.config.mjs';
export default {
  ...base,
  testDir: '../../output/k8k-tasks/TASK-030/baseline-tests',
  testMatch: 'student.spec.mjs',
  grep: /debounce, server|failed save|confirmation and submission|serialized slow|logout discards/,
  reporter: 'list',
  outputDir: '../../output/k8k-tasks/TASK-030/baseline-results',
  webServer: {
    ...base.webServer,
    command: 'node tests/fixture-server.mjs',
    env: { STUDENT_FIXTURE_DIST: '../../../output/k8k-tasks/TASK-030/baseline-dist' },
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    reuseExistingServer: false,
  },
};
