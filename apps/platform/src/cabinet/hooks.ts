import { useEffect, useRef, useState } from 'react';
import { sessionSignal } from '@online-school/account-ui';
import { CabinetError, request } from './contract.js';

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

type ActionOptions = Omit<NonNullable<Parameters<typeof request>[1]>, 'signal'>;
type Outcome<T> = { ok: true; data: T } | { ok: false; error: unknown };

export function useCabinetAction() {
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => active.current?.abort(), []);
  async function run<T>(operation: string, options: ActionOptions): Promise<Outcome<T> | null> {
    const session = sessionSignal();
    if (active.current || session.aborted) return null;
    const controller = new AbortController();
    active.current = controller;
    const lease = AbortSignal.any([controller.signal, session]);
    setBusy(true);
    try {
      const data = await request<T>(operation, {
        ...options,
        signal: AbortSignal.any([lease, AbortSignal.timeout(15_000)]),
      });
      return lease.aborted ? null : { ok: true, data };
    } catch (error) {
      return lease.aborted ? null : { ok: false, error };
    } finally {
      active.current = null;
      if (!lease.aborted) setBusy(false);
    }
  }
  return { busy, run };
}

type Intent<Body> = { body: Body; key: string; startedAt: number };
type CommandFailure = 'rejected' | 'forbidden' | 'throttled' | 'retryExpired';

export function useCabinetCommand<Body, Response, Failure extends string = never>(
  operation: string,
  accept: (data: Response, body: Body) => boolean,
  onRejected?: (code: string) => Failure | undefined,
  params?: Record<string, string>,
) {
  const action = useCabinetAction();
  const [pending, setPending] = useState<Intent<Body> | null>(null);
  const [failure, setFailure] = useState<CommandFailure | Failure | null>(null);

  async function send(intent: Intent<Body>) {
    // The API retains idempotency records for 48 hours.
    if (Date.now() - intent.startedAt >= 47 * 60 * 60 * 1000) {
      setFailure('retryExpired');
      return;
    }
    const outcome = await action.run<Response>(operation, {
      body: intent.body,
      key: intent.key,
      ...(params ? { params } : {}),
    });
    if (!outcome) return;
    setFailure(null);
    if (outcome.ok) {
      setPending(accept(outcome.data, intent.body) ? null : intent);
      return;
    }
    const issue = outcome.error instanceof CabinetError ? outcome.error.issue : null;
    if (!issue || !issue.status || issue.status >= 500 || issue.code === 'COMMAND_IN_PROGRESS') {
      setPending(intent);
      return;
    }
    // On a retry an auth error or rate limit can precede idempotency lookup.
    // Keep the original intent until the server can resolve it.
    if (!pending || ![401, 403, 429].includes(issue.status)) setPending(null);
    const message = onRejected?.(issue.code);
    setFailure(
      message ??
        (issue.status === 429
          ? 'throttled'
          : [401, 403].includes(issue.status)
            ? 'forbidden'
            : 'rejected'),
    );
  }

  return {
    busy: action.busy,
    unresolved: pending !== null,
    error: failure,
    submit: (body: Body) => {
      if (!pending) void send({ body, key: crypto.randomUUID(), startedAt: Date.now() });
    },
    retry: () => {
      if (pending) void send(pending);
    },
  };
}
