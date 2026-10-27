export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.mjs'],
  testTimeout: 30000,
  maxWorkers: 1,
  clearMocks: true,
  restoreMocks: true,
  // A timeout or open handle must fail visibly; never force-exit a leaking gate.
  forceExit: false,
};
