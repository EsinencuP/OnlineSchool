import { afterEach, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ok, err } from '@online-school/shared';
import { describeError, setLocale } from '@online-school/ui';
import { clearSession, queryClient, setUnauthorizedHandler, write } from '../api/client.js';
import { useCommand } from '../hooks/use-command.js';
vi.mock('@online-school/api-contracts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@online-school/api-contracts')>()),
  getCsrfToken: vi.fn(async () => ok({ csrfToken: 'local-only' })),
}));
afterEach(() => {
  clearSession();
  setLocale('ru');
});
it('CURRENT_PASSWORD_INVALID in a command keeps the active session and cached reads', async () => {
  const redirect = vi.fn();
  setUnauthorizedHandler(redirect);
  queryClient.setQueryData(['private'], 'kept');
  const result = await write(
    async () => err({ status: 401, code: 'CURRENT_PASSWORD_INVALID', message: 'raw' }),
    'local-intent',
  );
  expect(result.ok).toBe(false);
  expect(redirect).not.toHaveBeenCalled();
  expect(queryClient.getQueryData(['private'])).toBe('kept');
  if (!result.ok) expect(describeError(result.error).nextAction).toBe('edit');
});
it('unknown command outcome blocks blind resubmission, including a changed payload and locale', async () => {
  const command = vi.fn(async () => err({ status: 503, code: 'INTERNAL_ERROR', message: 'raw' }));
  const { result } = renderHook(() => useCommand());
  await act(async () => {
    await result.current.run({ amount: '1.0001' }, command);
  });
  expect(result.current.error?.code).toBe('INTERNAL_ERROR');
  act(() => {
    setLocale('ro');
    result.current.clearError();
  });
  await act(async () => {
    await result.current.run({ amount: '2.0001' }, command);
  });
  expect(command).toHaveBeenCalledOnce();
});
