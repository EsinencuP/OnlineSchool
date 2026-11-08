export function homeworkReturn(value: string | null) {
  if (!value?.startsWith('/student/homework')) return '/student/homework';
  const url = new URL(value, 'https://student.local');
  if (url.origin !== 'https://student.local' || url.pathname !== '/student/homework' || url.hash)
    return '/student/homework';
  const params = new URLSearchParams();
  for (const key of ['status', 'page', 'fromSubjectId', 'lessonId', 'ui.k8k'])
    if (url.searchParams.getAll(key).length === 1) params.set(key, url.searchParams.get(key)!);
  return url.pathname + (params.size ? '?' + params : '');
}
