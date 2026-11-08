import { formatDate, formatDateOnly, formatDateTime, translateStudent } from '@online-school/ui';
import { createContext } from 'react';

// A cached read never grants a new capability. Transport/session handling stays in api.ts.
export const StudentReadFreshness = createContext(true);
export function formatStudentDate(
  value: string | null | undefined,
  zone: string,
  includeTime = false,
  locale: 'ru' | 'ro' = 'ru',
): string {
  const fallback = translateStudent(locale, 'student.notSpecified');
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDateOnly(value, locale) ?? fallback;
  return (
    (includeTime ? formatDateTime(value, locale, zone) : formatDate(value, locale, zone)) ??
    fallback
  );
}

export type MeetInput = {
  scheduledAt: string;
  canJoin: boolean;
  status?: string | undefined;
  meetAsOf?: string | undefined;
};
export const MEET_EARLY_MS = 600_000;
export const MEET_LATE_MS = 3_600_000;
export const MEET_FRESH_MS = 120_000;
const meetMessages = {
  status: [
    'Этот урок недоступен для подключения.',
    'Conectarea la această lecție este indisponibilă.',
  ],
  refresh: [
    'Проверь актуальные данные урока перед входом.',
    'Verifică datele actualizate ale lecției înainte de conectare.',
  ],
  early: [
    'Вход откроется за 10 минут до начала при подтверждённом доступе.',
    'Te poți conecta cu 10 minute înainte dacă accesul este confirmat.',
  ],
  ended: ['Время подключения закончилось.', 'Intervalul de conectare s-a încheiat.'],
  noLink: [
    'Подключение к этому уроку пока недоступно.',
    'Conectarea la lecție încă nu este disponibilă.',
  ],
};
export type MeetReason = keyof typeof meetMessages;
export type MeetPresentation =
  | { kind: 'ready'; url: string }
  | { kind: 'disabled' | 'unavailable'; reason: string; reasonKey: MeetReason };

export function meetPresentation(
  lesson: MeetInput,
  validUrl: string | undefined,
  fresh: boolean,
  serverNow?: number | null,
  locale: 'ru' | 'ro' = 'ru',
): MeetPresentation {
  const denied = (reasonKey: MeetReason): MeetPresentation => ({
    kind: validUrl ? 'disabled' : 'unavailable',
    reason: meetMessages[reasonKey][locale === 'ro' ? 1 : 0]!,
    reasonKey,
  });
  if (lesson.status && lesson.status !== 'SCHEDULED') return denied('status');
  const start = Date.parse(lesson.scheduledAt);
  if (
    !fresh ||
    lesson.status !== 'SCHEDULED' ||
    serverNow == null ||
    !Number.isFinite(serverNow) ||
    !Number.isFinite(start)
  )
    return denied('refresh');
  if (serverNow < start - MEET_EARLY_MS) return denied('early');
  if (serverNow > start + MEET_LATE_MS) return denied('ended');
  if (!lesson.canJoin || !validUrl) return denied('noLink');
  return { kind: 'ready', url: validUrl };
}

type ReadTiming = { startedAt: number; receivedAt: number };
export type MeetClock = ReadTiming & { asOf: number };
const meetReads = new WeakMap<object, ReadTiming>();

export function rememberMeetRead(data: unknown, startedAt: number, receivedAt: number) {
  if (data && typeof data === 'object') meetReads.set(data, { startedAt, receivedAt });
}
export function meetReadTiming(data: unknown) {
  return data && typeof data === 'object' ? meetReads.get(data) : undefined;
}
export function meetClockFor(data: unknown, asOf: string | undefined): MeetClock | null {
  const time = Date.parse(asOf ?? '');
  const timing = meetReadTiming(data);
  return timing && Number.isFinite(time) ? { ...timing, asOf: time } : null;
}
export function meetTime(clock: MeetClock | null, monotonic: number, conservative = false) {
  return clock
    ? clock.asOf + Math.max(0, monotonic - (conservative ? clock.startedAt : clock.receivedAt))
    : null;
}
export const StudentMeetClock = createContext<{ clock: MeetClock | null; verifying: boolean }>({
  clock: null,
  verifying: true,
});
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
    return minutes ? `Peste ${minutes} min` : 'Lecția a început';
  }
  return minutes > 1440
    ? `Через ${Math.ceil(minutes / 1440)} дн.`
    : minutes > 60
      ? `Через ${Math.floor(minutes / 60)} ч. ${minutes % 60} мин.`
      : minutes > 0
        ? `Через ${minutes} мин.`
        : 'Урок начался';
}
export function notificationTarget(
  payload: Record<string, unknown>,
  type?: string,
  locale: 'ru' | 'ro' = 'ru',
): { href: string; label: string } | null {
  const validId = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const lesson = [
    'LESSON_SCHEDULED',
    'LESSON_RESCHEDULED',
    'LESSON_CANCELLED',
    'RESCHEDULE_DECLINED',
    'DISPUTE_ACCEPTED',
    'DISPUTE_REJECTED',
  ];
  const subscriptions = [
    'SUBSCRIPTION_CREATED',
    'SUBSCRIPTION_RENEWED',
    'SUBSCRIPTION_FROZEN',
    'SUBSCRIPTION_UNFROZEN',
    'SUBSCRIPTION_EXPIRED',
    'SUBSCRIPTION_EXPIRING',
    'PAYMENT_CONFIRMED',
  ];
  const key =
    type === undefined
      ? ['lessonId', 'homeworkId', 'reportId', 'subscriptionId'].find((key) =>
          validId(payload[key]),
        )
      : lesson.includes(type)
        ? 'lessonId'
        : ['HOMEWORK_REVIEWED', 'HOMEWORK_NEEDS_REVISION'].includes(type)
          ? 'homeworkId'
          : type === 'REPORT_READY'
            ? 'reportId'
            : subscriptions.includes(type)
              ? 'subscriptionId'
              : undefined;
  if (!key || !validId(payload[key])) return null;
  const id = payload[key];
  const ro = locale === 'ro';
  if (key === 'lessonId')
    return { href: '/student/lessons/' + id, label: ro ? 'Deschide lecția' : 'Открыть урок' };
  if (key === 'homeworkId')
    return { href: '/student/homework/' + id, label: ro ? 'Deschide tema' : 'Открыть задание' };
  if (key === 'reportId')
    return {
      href: '/student/reports?' + new URLSearchParams({ reportId: id }),
      label: ro ? 'Deschide raportul' : 'Открыть отчёт',
    };
  return {
    href: '/student/subscription?' + new URLSearchParams({ subscriptionId: id }),
    label: ro ? 'Deschide abonamentul' : 'Открыть абонемент',
  };
}
