import { useContext, useEffect, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { k8kEnabled } from '@online-school/ui';
import { StudentDeadlineRead } from './api.js';
import {
  MEET_EARLY_MS,
  MEET_FRESH_MS,
  MEET_LATE_MS,
  meetClockFor,
  meetReadTiming,
  StudentMeetClock,
} from './student-presentation.js';
import type { MeetInput } from './student-presentation.js';

export type MeetScopeOptions = {
  lessons: readonly MeetInput[];
  countdown?: boolean;
};

export function useMeetReadAge(snapshot: unknown, enabled: boolean) {
  const [, redraw] = useReducer((value: number) => value + 1, 0);
  const receivedAt = enabled ? meetReadTiming(snapshot)?.receivedAt : undefined;
  const expiresAt = receivedAt === undefined ? Infinity : receivedAt + MEET_FRESH_MS;
  useEffect(() => {
    const delay = expiresAt - performance.now();
    if (delay <= 0 || !Number.isFinite(delay)) return;
    const timer = setTimeout(redraw, Math.ceil(delay));
    return () => clearTimeout(timer);
  }, [expiresAt]);
  return performance.now() >= expiresAt;
}

export function MeetScope({
  snapshot,
  lessons,
  countdown = false,
  refreshing,
  refetch,
  children,
}: MeetScopeOptions & {
  snapshot: unknown;
  refreshing: boolean;
  refetch(): unknown;
  children: ReactNode;
}) {
  const request = useContext(StudentDeadlineRead);
  const [, redraw] = useReducer((value: number) => value + 1, 0);
  const [revalidateAfter, setRevalidateAfter] = useState(-Infinity);
  const notified = useRef<{ snapshot: unknown; through: number }>();
  const clock = meetClockFor(snapshot, lessons[0]?.meetAsOf);
  const asOf = clock?.asOf;
  const startedAt = clock?.startedAt;
  const receivedAt = clock?.receivedAt;
  useEffect(() => {
    if (asOf === undefined || startedAt === undefined || receivedAt === undefined) return;
    const deadlines = lessons.flatMap((lesson) => {
      if (lesson.status !== 'SCHEDULED') return [];
      const start = Date.parse(lesson.scheduledAt);
      const opens = start - MEET_EARLY_MS;
      const closes = start + MEET_LATE_MS + 1;
      return [
        ...(opens > asOf ? [receivedAt + opens - asOf] : []),
        ...(closes > asOf ? [startedAt + closes - asOf] : []),
      ];
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    function schedule() {
      const now = performance.now();
      const through =
        notified.current?.snapshot === snapshot
          ? (notified.current?.through ?? -Infinity)
          : -Infinity;
      const next = Math.min(...deadlines.filter((time) => time > through));
      if (next - now > 2_147_483_647) return;
      timer = setTimeout(
        () => {
          notified.current = { snapshot, through: next };
          redraw();
          if (k8kEnabled) request('deadline', next);
          else void refetch();
          schedule();
        },
        Math.max(0, Math.ceil(next - now)),
      );
    }
    schedule();
    const tick = countdown ? setInterval(redraw, 1000) : undefined;
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [asOf, startedAt, receivedAt, snapshot, lessons, countdown, refetch, request]);
  useEffect(() => {
    const checkVisibility = () => {
      if (document.visibilityState === 'hidden' || navigator.onLine === false) {
        setRevalidateAfter(performance.now());
      } else if (!k8kEnabled) {
        void refetch();
      }
    };
    if (document.visibilityState === 'hidden' || navigator.onLine === false) checkVisibility();
    document.addEventListener('visibilitychange', checkVisibility);
    window.addEventListener('offline', checkVisibility);
    window.addEventListener('online', checkVisibility);
    return () => {
      document.removeEventListener('visibilitychange', checkVisibility);
      window.removeEventListener('offline', checkVisibility);
      window.removeEventListener('online', checkVisibility);
    };
  }, [receivedAt, refetch]);
  return (
    <StudentMeetClock.Provider
      value={{
        clock,
        verifying:
          refreshing ||
          document.visibilityState === 'hidden' ||
          (receivedAt ?? -Infinity) <= revalidateAfter,
      }}
    >
      {children}
    </StudentMeetClock.Provider>
  );
}
