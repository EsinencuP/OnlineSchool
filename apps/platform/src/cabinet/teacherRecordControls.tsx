import { useState } from 'react';

export function TeacherRecordLoad({
  t,
  pending,
  retry,
}: {
  t: { loading: string; unavailable: string; retryRead: string };
  pending?: boolean;
  retry?: () => void;
}) {
  return (
    <div
      className={'cab-empty' + (pending ? '' : ' cab-empty-error')}
      role={pending ? 'status' : 'alert'}
    >
      <span>{pending ? t.loading : t.unavailable}</span>
      {!pending && retry && (
        <button type="button" className="cab-text-button" onClick={retry}>
          {t.retryRead}
        </button>
      )}
    </div>
  );
}

export function useCursorPages() {
  const [cursors, setCursors] = useState<string[]>([]);
  return {
    cursor: cursors.at(-1),
    hasPrevious: cursors.length > 0,
    previous: () => setCursors((values) => values.slice(0, -1)),
    next: (cursor: string) =>
      setCursors((values) => (values.includes(cursor) ? values : [...values, cursor])),
  };
}

export function CursorPager({
  page,
  next,
  t,
}: {
  page: ReturnType<typeof useCursorPages>;
  next: string | null | undefined;
  t: { prev: string; next: string };
}) {
  if (!page.hasPrevious && !next) return null;
  return (
    <div className="cab-form-actions">
      <button
        type="button"
        className="cab-button cab-secondary"
        disabled={!page.hasPrevious}
        onClick={page.previous}
      >
        {t.prev}
      </button>
      <button
        type="button"
        className="cab-button cab-secondary"
        disabled={!next || next === page.cursor}
        onClick={() => next && page.next(next)}
      >
        {t.next}
      </button>
    </div>
  );
}
