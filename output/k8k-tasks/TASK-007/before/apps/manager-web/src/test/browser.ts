import { setupWorker } from 'msw/browser';
import { handlers, mockState } from './handlers.js';
import { queryClient } from '../api/client.js';
declare global {
  interface Window {
    __managerMock: typeof mockState & {
      invalidate: () => Promise<void>;
      secretInCaches: () => boolean;
      cacheEmpty: () => boolean;
    };
  }
}
export async function startMocks() {
  const worker = setupWorker(...handlers);
  await worker.start({
    serviceWorker: { url: '/manager/mockServiceWorker.js' },
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
  window.__managerMock = Object.assign(mockState, {
    cacheEmpty: () =>
      queryClient.getQueryCache().getAll().length === 0 &&
      queryClient.getMutationCache().getAll().length === 0,
    invalidate: async () => {
      await queryClient.invalidateQueries();
    },
    secretInCaches: () =>
      JSON.stringify([
        queryClient
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
        queryClient
          .getMutationCache()
          .getAll()
          .map((m) => m.state),
      ]).includes('Fixture-Only-Password!47'),
  });
}
