import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const app = fileURLToPath(new URL('./', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const output =
  process.env.K8K_STUDENT_GATE_OUTPUT ??
  path.join(root, 'output/k8k-taskpack/task-035/runs/direct');
process.env.K8K_STUDENT_GATE_OUTPUT = output;
const build = path.join(root, 'output/k8k-taskpack/task-035/build/student');
mkdirSync(output, { recursive: true });
export default {
  testDir: './tests',
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: path.join(output, 'playwright.json') }]],
  outputDir: path.join(output, 'test-results'),
  metadata: {
    studentGate: true,
    evidenceRoot: pathToFileURL(output + path.sep).href,
    subjectHubEvidence: pathToFileURL(path.join(output, 'evidence/TASK-025') + path.sep).href,
  },
  use: {
    baseURL: 'http://127.0.0.1:4175',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    launchOptions: { proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' } },
  },
  projects: [
    {
      name: 'student-k8k',
      testMatch: [
        'subject-hub.spec.mjs',
        'subject-subscriptions.spec.mjs',
        'manager-contacts.spec.mjs',
        'meet-eligibility.spec.mjs',
        'lesson-journey.spec.mjs',
        'homework-redesign.spec.mjs',
        'skill-map.spec.mjs',
        'report-export.spec.mjs',
        'bell.spec.mjs',
        'locales.spec.mjs',
        'navigation.spec.mjs',
        'student-gate.acceptance.mjs',
      ],
      grepInvert: /subject-baseline/,
    },
    {
      name: 'editor-preservation',
      testMatch: 'student.spec.mjs',
      grep: /debounce, server|failed save|confirmation and submission|serialized slow|logout discards/,
    },
  ],
  webServer: {
    command: 'node tests/fixture-server.mjs',
    cwd: app,
    url: 'http://127.0.0.1:4175/student',
    reuseExistingServer: false,
    env: { STUDENT_FIXTURE_DIST: build },
  },
};
