import { fileURLToPath } from 'node:url';
import base from '../../../apps/student-cabinet/playwright.config.mjs';

const app = new URL('../../../apps/student-cabinet/', import.meta.url);

export default {
  ...base,
  testDir: fileURLToPath(new URL('tests/', app)),
  reporter: 'line',
  outputDir: fileURLToPath(new URL('student-browser/', import.meta.url)),
  use: { ...base.use, screenshot: 'off', trace: 'off' },
  webServer: { ...base.webServer, cwd: fileURLToPath(app), reuseExistingServer: false },
};
