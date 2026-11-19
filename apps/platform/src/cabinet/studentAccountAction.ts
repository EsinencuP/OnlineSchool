import { useEffect, useRef, useState } from 'react';
import { sessionSignal } from '@online-school/account-ui';
import { request } from './contract.js';

type ActionOptions = Omit<NonNullable<Parameters<typeof request>[1]>, 'signal'>;
type Outcome<T> = { ok: true; data: T } | { ok: false; error: unknown };

export function useStudentAccountAction() {
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
