import { createContext } from 'react';

// A cached read never grants a new capability. Transport/session handling stays in api.ts.
export const StudentReadFreshness = createContext(true);
export function formatStudentDate(
  value: string | null | undefined,
  zone: string,
  includeTime = false,
  locale: 'ru' | 'ro' = 'ru',
): string {
  if (!value) return locale === 'ro' ? 'Nespecificat' : 'Не указан';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat(locale === 'ro' ? 'ro-MD' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(includeTime && !dateOnly ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: dateOnly ? 'UTC' : zone,
  }).format(new Date(dateOnly ? `${value}T12:00:00Z` : value));
}

type MeetInput = {
  scheduledAt: string;
  canJoin: boolean;
  meetLink: string | null;
  status?: string;
};
export type MeetPresentation =
  { kind: 'ready'; url: string } | { kind: 'disabled' | 'unavailable'; reason: string };
export function meetPresentation(
  lesson: MeetInput,
  validUrl: string | undefined,
  fresh: boolean,
  serverNow?: number | null,
  locale: 'ru' | 'ro' = 'ru',
): MeetPresentation {
  const ro = locale === 'ro';
  if (lesson.status && lesson.status !== 'SCHEDULED')
    return {
      kind: 'unavailable',
      reason: ro
        ? 'Conectarea la această lecție este indisponibilă. Verifică starea în pagina lecției.'
        : 'Этот урок недоступен для подключения. Актуальный статус указан в карточке урока.',
    };
  if (!fresh)
    return {
      kind: validUrl ? 'disabled' : 'unavailable',
      reason: ro
        ? 'Actualizează datele lecției. Este posibil ca disponibilitatea conectării să se fi schimbat.'
        : 'Сначала обнови данные урока: доступность подключения могла измениться.',
    };
  const start = Date.parse(lesson.scheduledAt);
  if (
    serverNow != null &&
    Number.isFinite(serverNow) &&
    Number.isFinite(start) &&
    serverNow < start - 600_000
  ) {
    return {
      kind: validUrl ? 'disabled' : 'unavailable',
      reason: ro
        ? 'Te poți conecta cu 10 minute înainte dacă întâlnirea și accesul sunt confirmate.'
        : 'Вход откроется за 10 минут до начала, если встреча и доступ будут подтверждены.',
    };
  }
  if (!validUrl)
    return {
      kind: 'unavailable',
      reason: ro
        ? 'Linkul întâlnirii încă nu este disponibil. Te poți conecta cu 10 minute înainte dacă accesul este confirmat.'
        : 'Ссылка на встречу пока недоступна. Вход открывается за 10 минут до начала при подтверждённом доступе.',
    };
  if (!lesson.canJoin)
    return {
      kind: 'disabled',
      reason: ro
        ? 'Conectarea încă nu este disponibilă. Deschide lecția sau verifică din nou mai târziu.'
        : 'Подключение пока недоступно. Открой карточку урока или проверь данные позже.',
    };
  return { kind: 'ready', url: validUrl };
}
export function serverSampleTime(
  serverAt: string | undefined,
  receivedAt: number,
  clientNow: number,
): number | null {
  const at = serverAt ? Date.parse(serverAt) : NaN;
  return Number.isFinite(at) && receivedAt > 0 ? at + Math.max(0, clientNow - receivedAt) : null;
}
export function lessonCountdown(
  start: string,
  serverNow: number | null,
  locale: 'ru' | 'ro' = 'ru',
): string | null {
  if (serverNow === null || !Number.isFinite(Date.parse(start))) return null;
  const minutes = Math.max(0, Math.ceil((Date.parse(start) - serverNow) / 60_000));
  if (locale === 'ro') {
    if (minutes > 1440) return `Peste ${Math.ceil(minutes / 1440)} zile`;
    if (minutes > 60) return `Peste ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
    return minutes ? `Peste ${minutes} min` : 'Este ora de începere a lecției';
  }
  return minutes > 1440
    ? `Через ${Math.ceil(minutes / 1440)} дн.`
    : minutes > 60
      ? `Через ${Math.floor(minutes / 60)} ч. ${minutes % 60} мин.`
      : minutes > 0
        ? `Через ${minutes} мин.`
        : 'Время начала урока наступило';
}
export function notificationTarget(
  payload: Record<string, unknown>,
): { href: string; label: string } | null {
  const validId = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  if (validId(payload.lessonId))
    return { href: `/student/lessons/${payload.lessonId}`, label: 'Открыть урок' };
  if (validId(payload.homeworkId))
    return { href: `/student/homework/${payload.homeworkId}`, label: 'Открыть задание' };
  if (validId(payload.reportId))
    return { href: `/student/reports?reportId=${payload.reportId}`, label: 'Открыть отчёт' };
  if (validId(payload.subscriptionId))
    return {
      href: `/student/subscription?subscriptionId=${payload.subscriptionId}`,
      label: 'Открыть абонемент',
    };
  return null;
}
