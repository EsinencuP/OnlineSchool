const returnKeys = new Set([
  'period',
  'view',
  'month',
  'page',
  'historyPage',
  'subjectId',
  'fromSubjectId',
  'ui.k8k',
]);
export function scheduleReturn(value: string | null | undefined) {
  if (!value?.startsWith('/student/lessons')) return '/student/lessons';
  const parsed = new URL(value, 'https://student.local');
  if (
    parsed.origin !== 'https://student.local' ||
    parsed.pathname !== '/student/lessons' ||
    parsed.hash
  )
    return '/student/lessons';
  const safe = new URLSearchParams();
  for (const [key, item] of parsed.searchParams)
    if (returnKeys.has(key) && parsed.searchParams.getAll(key).length === 1) safe.set(key, item);
  const query = safe.toString();
  return '/student/lessons' + (query ? '?' + query : '');
}
export function lessonHref(id: string, backTo: string, subjectId?: string) {
  const query = new URLSearchParams({ backTo: scheduleReturn(backTo) });
  if (subjectId) query.set('fromSubjectId', subjectId);
  return '/student/lessons/' + encodeURIComponent(id) + '?' + query;
}
export function positivePage(value: string | null) {
  const page = Number(value);
  return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(page) ? page : 1;
}
