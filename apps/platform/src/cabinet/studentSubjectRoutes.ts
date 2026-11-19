export const subjectHub = '/student/subjects';
export const subjectSkills = '/student/skills';
export const studentSubscriptionPath = '/student/subscription';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function isRouteUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && uuid.test(value);
}

export function withSubject(path: string, subjectId?: string | null) {
  return subjectId ? path + '?' + new URLSearchParams({ subjectId }) : path;
}

export function subjectUrl(id: string) {
  return withSubject(subjectHub, id);
}

export function studentSubscriptionUrl(subscriptionId: string, fromSubjectId: string) {
  return studentSubscriptionPath + '?' + new URLSearchParams({ subscriptionId, fromSubjectId });
}

export function subjectSelection(search: string, ...keys: string[]) {
  const params = new URLSearchParams(search);
  const values = keys.flatMap((key) => params.getAll(key));
  if (!values.length) return null;
  return values.length === 1 && isRouteUuid(values[0]) ? values[0].toLowerCase() : '';
}
