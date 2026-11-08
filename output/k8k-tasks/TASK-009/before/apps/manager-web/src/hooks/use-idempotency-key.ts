import { useCallback, useRef } from 'react';
export function useIdempotencyKey(): { key: string; rotate(): void } {
  const key = useRef(crypto.randomUUID());
  const rotate = useCallback(() => {
    key.current = crypto.randomUUID();
  }, []);
  return {
    get key() {
      return key.current;
    },
    rotate,
  };
}
