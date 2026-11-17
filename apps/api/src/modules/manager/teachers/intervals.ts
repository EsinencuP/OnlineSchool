export type Span = { start: Date; end: Date };

/** Part of `span` that lies inside [from, to); null when nothing remains. */
export function clip(span: Span, from: Date, to: Date): Span | null {
  const start = new Date(Math.max(+span.start, +from)),
    end = new Date(Math.min(+span.end, +to));
  return end > start ? { start, end } : null;
}

/** `span` minus every busy span; result is sorted and non-overlapping. */
export function subtract(span: Span, busy: Span[]): Span[] {
  const sorted = [...busy].sort((a, b) => +a.start - +b.start);
  const free: Span[] = [];
  let cursor = span.start;
  for (const b of sorted) {
    if (b.end <= cursor) continue;
    if (b.start >= span.end) break;
    if (b.start > cursor) free.push({ start: cursor, end: b.start });
    if (b.end > cursor) cursor = b.end;
  }
  if (cursor < span.end) free.push({ start: cursor, end: span.end });
  return free;
}

export const minutes = (spans: Span[]): number =>
  Math.round(spans.reduce((sum, s) => sum + (+s.end - +s.start), 0) / 60000);

export const toIso = (s: Span) => ({
  startsAt: s.start.toISOString(),
  endsAt: s.end.toISOString(),
});
