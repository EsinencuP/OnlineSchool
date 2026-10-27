// One set of assertions for legacy node:test commands and the foundation Jest gate.
// This module is test-only and is never imported by application code.
const jestRun = process.env.JEST_WORKER_ID !== undefined;
const runner = jestRun ? await import('@jest/globals') : await import('node:test');
export const before = jestRun ? runner.beforeAll : runner.before;
export const after = jestRun ? runner.afterAll : runner.after;
export const beforeEach = runner.beforeEach;
export const afterEach = runner.afterEach;
export const test = jestRun
  ? (name, run) =>
      runner.test(name, async () => {
        const cleanup = [];
        try {
          await run({ after: (fn) => cleanup.push(fn) });
        } finally {
          for (const fn of cleanup.reverse()) await fn();
        }
      })
  : runner.test;
