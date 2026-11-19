import { useEffect, useState } from 'react';
import { request } from './contract.js';

type State<T> = { signature: string; data: T | null; error: unknown };
export function useEndpoint<T>(
  id: string | null,
  path?: Record<string, string>,
  filters?: Record<string, string | number | boolean>,
  revision = 0,
) {
  const [state, setState] = useState<State<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const params = JSON.stringify(path ?? {});
  const query = JSON.stringify(filters ?? {});
  const signature = JSON.stringify([id, params, query, attempt, revision]);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    void request<T>(id, {
      params: JSON.parse(params),
      query: JSON.parse(query),
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setState({ signature, data, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ signature, data: null, error });
      });
    return () => controller.abort();
  }, [id, params, query, signature]);
  const settled = id && state?.signature === signature ? state : null;
  return {
    data: settled?.data ?? null,
    error: settled?.error ?? null,
    pending: Boolean(id && !settled),
    refresh: () => setAttempt((value) => value + 1),
  };
}
