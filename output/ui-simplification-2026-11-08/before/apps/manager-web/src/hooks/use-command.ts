import { useEffect, useRef, useState } from 'react';
import type { ClientError, SchoolRequestOptions } from '@online-school/api-contracts';
import type { Result } from '@online-school/shared';
import { write, queryClient } from '../api/client.js';
import type { ApiErrorView } from '../api/error-view.js';
import { useIdempotencyKey } from './use-idempotency-key.js';
import { describeError } from '@online-school/ui';

/** Commands deliberately bypass MutationCache: one-time credentials never enter a shared cache. */
export function useCommand() {
  const idempotency = useIdempotencyKey();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorView | null>(null);
  const pending = useRef(false);
  const unresolved = useRef(false);
  const intent = useRef<string>();
  const lifetime = useRef<AbortController>();
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const hide = () => controller.abort();
    window.addEventListener('pagehide', hide);
    return () => {
      controller.abort();
      window.removeEventListener('pagehide', hide);
    };
  }, []);
  async function run<T>(
    payload: unknown,
    command: (options: SchoolRequestOptions) => Promise<Result<T, ClientError>>,
  ): Promise<T | undefined> {
    if (pending.current || unresolved.current || lifetime.current?.signal.aborted) return undefined;
    const fingerprint = JSON.stringify(payload);
    if (intent.current !== undefined && intent.current !== fingerprint) idempotency.rotate();
    intent.current = fingerprint;
    pending.current = true;
    setBusy(true);
    setError(null);
    const controller = lifetime.current;
    const result = await write(command, idempotency.key, controller?.signal);
    pending.current = false;
    if (controller?.signal.aborted) return undefined;
    setBusy(false);
    if (!result.ok) {
      unresolved.current = describeError(result.error).outcome === 'unknown';
      setError(result.error);
      return undefined;
    }
    idempotency.rotate();
    intent.current = undefined;
    void queryClient.invalidateQueries();
    return result.value;
  }
  return { busy, error, run, clearError: () => setError(null) };
}
