import base from './playwright.student-gate.config.mjs';
import path from 'node:path';
export default {
  ...base,
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: path.join(process.env.K8K_STUDENT_GATE_OUTPUT, 'playwright-accessibility.json'),
      },
    ],
  ],
  outputDir: path.join(process.env.K8K_STUDENT_GATE_OUTPUT, 'test-results-accessibility'),
  projects: [
    { name: 'student-state-accessibility', testMatch: 'student-gate-extra.acceptance.mjs' },
  ],
};
