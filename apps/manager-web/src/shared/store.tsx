import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

/** Same success/failure shape for every cabinet; error codes mirror backend codes. */
export type CommandResult<S> =
  | { ok: true; state: S; message: string }
  | { ok: false; code: string; message: string };

export interface Toast {
  id: number;
  tone: 'ok' | 'error';
  text: string;
}

export interface CabinetStore<S, C> {
  state: S;
  run: (cmd: C) => CommandResult<S>;
  toasts: Toast[];
  dismiss: (id: number) => void;
  reset: () => void;
}

/**
 * In-memory demo store. `execute` is a pure command handler, so swapping it for
 * HTTP calls to `/api/v1/<role>/*` later does not change the screens.
 */
export function createCabinetStore<S, C>(seed: () => S, execute: (s: S, c: C) => CommandResult<S>) {
  const Ctx = createContext<CabinetStore<S, C> | null>(null);

  function Provider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<S>(seed);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const ref = useRef(state);
    ref.current = state;
    const seq = useRef(0);

    const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
    const run = useCallback(
      (cmd: C) => {
        const result = execute(ref.current, cmd);
        if (result.ok) {
          ref.current = result.state;
          setState(result.state);
        }
        const id = ++seq.current;
        setToasts((t) => [...t.slice(-2), { id, tone: result.ok ? 'ok' : 'error', text: result.message }]);
        window.setTimeout(() => dismiss(id), 4200);
        return result;
      },
      [dismiss],
    );
    const reset = useCallback(() => setState(seed()), []);
    const value = useMemo(() => ({ state, run, toasts, dismiss, reset }), [state, run, toasts, dismiss, reset]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  function useStore() {
    const v = useContext(Ctx);
    if (!v) throw new Error('Cabinet store used outside its provider');
    return v;
  }

  return { Provider, useStore };
}

/** Pure helper for tests and command handlers. */
export const fail = <S,>(code: string, message: string): CommandResult<S> => ({ ok: false, code, message });
