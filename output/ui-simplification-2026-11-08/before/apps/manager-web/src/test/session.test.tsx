import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ok, err } from '@online-school/shared';
import { queryClient, read, write, clearSession, setUnauthorizedHandler } from '../api/client.js';
import { useCommand } from '../hooks/use-command.js';
import { useIdempotencyKey } from '../hooks/use-idempotency-key.js';
vi.mock('@online-school/api-contracts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@online-school/api-contracts')>()),
  getCsrfToken: vi.fn(async () => ok({ csrfToken: 'fixture-csrf' })),
}));

describe('session boundary', () => {
  it('any401 cancels in-flight work, clears query AND mutation caches and redirects', async () => {
    const redirect = vi.fn();
    setUnauthorizedHandler(redirect);
    queryClient.setQueryData(['private'], { name: 'private' });
    queryClient.getMutationCache().build(queryClient, { mutationFn: async () => true });
    const command = vi.fn(async () =>
      err({
        code: 'UNAUTHENTICATED',
        status: 401,
        message: 'internal database detail',
        requestId: 'fixture-request',
      }),
    );
    await expect(read(command)).rejects.toMatchObject({
      status: 401,
      requestId: 'fixture-request',
    });
    expect(redirect).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  });
  it('never accepts late successful responses from a terminated session', async () => {
    let release: (value: ReturnType<typeof ok<string>>) => void = () => undefined;
    const pending = read<string>(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    clearSession();
    release(ok('late-secret'));
    await expect(pending).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
  it('ignores a late 401 from a canceled generation before touching the current cache', async () => {
    const redirect = vi.fn();
    setUnauthorizedHandler(redirect);
    const response = err({ status: 401, code: 'UNAUTHENTICATED', message: '' });
    let release: (value: typeof response) => void = () => undefined;
    const pending = read(
      () =>
        new Promise<typeof response>((resolve) => {
          release = resolve;
        }),
    );
    clearSession();
    queryClient.setQueryData(['current-actor'], 'current');
    release(response);
    await expect(pending).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(redirect).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['current-actor'])).toBe('current');
    clearSession();
  });
  it('sends session cookies, CSRF and caller idempotency UUID', async () => {
    const command = vi.fn(
      async (options: import('@online-school/api-contracts').SchoolRequestOptions) => {
        expect(options.credentials).toBe('include');
        return ok({ done: true });
      },
    );
    const key = crypto.randomUUID();
    await write(command, key);
    expect(command.mock.calls[0]?.[0]).toMatchObject({
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'fixture-csrf', 'Idempotency-Key': key },
    });
  });
  it('a denied object cannot reappear from cache during a later transient failure', async () => {
    const redirect = vi.fn();
    setUnauthorizedHandler(redirect);
    const queryKey = ['protected-object'];
    queryClient.setQueryData(queryKey, 'old object');
    queryClient.setQueryData(['other-object'], 'still allowed');
    for (const status of [403, 503]) {
      await expect(
        queryClient.fetchQuery({
          queryKey,
          staleTime: 0,
          queryFn: () => read(async () => err({ status, code: 'READ_FAILED', message: '' })),
        }),
      ).rejects.toMatchObject({ status });
      expect(queryClient.getQueryData(queryKey)).toBeUndefined();
    }
    expect(queryClient.getQueryData(['other-object'])).toBe('still allowed');
    expect(redirect).not.toHaveBeenCalled();
    clearSession();
  });
});
it('idempotency hook remains stable over rerenders and explicitly rotates', () => {
  const { result, rerender } = renderHook(() => useIdempotencyKey());
  const first = result.current.key;
  rerender();
  expect(result.current.key).toBe(first);
  act(() => result.current.rotate());
  expect(result.current.key).not.toBe(first);
});
it('command keeps the key after a confirmed rejection and rotates changed intent without caching a secret', async () => {
  clearSession();
  const { result } = renderHook(() => useCommand());
  const keys: string[] = [];
  let calls = 0;
  const command = vi.fn(
    async (options: import('@online-school/api-contracts').SchoolRequestOptions) => {
      keys.push(new Headers(options.headers).get('Idempotency-Key')!);
      calls++;
      return calls < 3
        ? err({ code: 'CALENDAR_CONFLICT', status: 409, message: 'internal' })
        : ok({ temporaryPassword: 'example-one-time-secret' });
    },
  );
  await act(async () => {
    await result.current.run({ amount: '1' }, command);
  });
  await act(async () => {
    await result.current.run({ amount: '1' }, command);
  });
  expect(keys[0]).toBe(keys[1]);
  await act(async () => {
    await result.current.run({ amount: '2' }, command);
  });
  expect(keys[2]).not.toBe(keys[1]);
  expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});
it('leaving the form ignores a late one-time password response', async () => {
  let release: (value: ReturnType<typeof ok<string>>) => void = () => undefined;
  const { result, unmount } = renderHook(() => useCommand());
  let pending: Promise<unknown>;
  await act(async () => {
    pending = result.current.run(
      {},
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
  });
  unmount();
  release(ok('late-secret'));
  await expect(pending!).resolves.toBeUndefined();
});
it('two submissions in the same tick execute once, and success rotates the next command key', async () => {
  clearSession();
  const { result } = renderHook(() => useCommand());
  let release: (value: ReturnType<typeof ok<boolean>>) => void = () => undefined;
  const keys: string[] = [];
  const command = vi.fn((options: import('@online-school/api-contracts').SchoolRequestOptions) => {
    keys.push(new Headers(options.headers).get('Idempotency-Key')!);
    return new Promise<ReturnType<typeof ok<boolean>>>((resolve) => {
      release = resolve;
    });
  });
  let pending: Promise<unknown>;
  await act(async () => {
    pending = result.current.run({ intent: 'same' }, command);
    await result.current.run({ intent: 'same' }, command);
  });
  expect(command).toHaveBeenCalledOnce();
  await act(async () => {
    release(ok(true));
    await pending;
  });
  await act(async () => {
    await result.current.run({ intent: 'same' }, async (options) => {
      keys.push(new Headers(options.headers).get('Idempotency-Key')!);
      return ok(true);
    });
  });
  expect(keys[1]).not.toBe(keys[0]);
});
