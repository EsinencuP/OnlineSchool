export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.mjs'],
  modulePathIgnorePatterns: ['<rootDir>/.codex/'],
  testPathIgnorePatterns: ['/node_modules/', '/.codex/'],
  testTimeout: 30000,
  maxWorkers: 1,
  clearMocks: true,
  restoreMocks: true,
  // A timeout or open handle must fail visibly; never force-exit a leaking gate.
  forceExit: false,
};
