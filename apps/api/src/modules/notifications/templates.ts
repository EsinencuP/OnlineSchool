import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import { UUID } from '../../core/http.js';
export const MANAGER_TEMPLATE_CODES = [
  'TRIAL_SCHEDULED',
  'ACCOUNT_CREATED',
  'PAYMENT_CONFIRMED',
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_RENEWED',
  'SUBSCRIPTION_FROZEN',
  'SUBSCRIPTION_UNFROZEN',
  'SUBSCRIPTION_EXPIRED',
  'LESSON_SCHEDULED',
  'LESSON_RESCHEDULED',
  'LESSON_CANCELLED',
  'RESCHEDULE_DECLINED',
  'DISPUTE_ACCEPTED',
  'DISPUTE_REJECTED',
  'MANUAL_MESSAGE',
] as const;
export type ManagerTemplateCode = (typeof MANAGER_TEMPLATE_CODES)[number];
const registry = {
  TRIAL_SCHEDULED: [
    ['lessonId', 'startsAt'],
    'Пробный урок назначен',
    'Ваш пробный урок назначен на {startsAt}. Ссылку для подключения передаст менеджер.',
    'Trial lesson scheduled',
    'Your trial lesson is scheduled for {startsAt}. Your manager will share the meeting link.',
  ],
  ACCOUNT_CREATED: [
    ['accountId', 'loginEmail'],
    'Кабинет ученика создан',
    'Ваш логин: {loginEmail}. Войдите в кабинет по инструкции менеджера.',
    'Student account created',
    'Your login: {loginEmail}. Follow the instructions from your manager.',
  ],
  PAYMENT_CONFIRMED: [
    ['paymentId', 'receiptOnly'],
    'Оплата подтверждена',
    'Руководитель подтвердил поступление. Распределение и доступ к занятиям проверяйте в кабинете.',
    'Payment confirmed',
    'The director confirmed the receipt. Check allocation and lesson access in your account.',
  ],
  SUBSCRIPTION_CREATED: [
    ['subscriptionId', 'operationId'],
    'Абонемент создан',
    'Ваш абонемент создан. Проверьте даты в кабинете.',
    'Subscription created',
    'Your subscription has been created. Check the dates in your account.',
  ],
  SUBSCRIPTION_RENEWED: [
    ['subscriptionId', 'operationId'],
    'Абонемент продлён',
    'Ваш абонемент продлён. Проверьте новый срок в кабинете.',
    'Subscription renewed',
    'Your subscription has been renewed. Check its new term in your account.',
  ],
  SUBSCRIPTION_FROZEN: [
    ['subscriptionId', 'operationId'],
    'Абонемент заморожен',
    'Заморозка оформлена. Проверьте даты в кабинете.',
    'Subscription frozen',
    'Your subscription is frozen. Check the dates in your account.',
  ],
  SUBSCRIPTION_UNFROZEN: [
    ['subscriptionId', 'operationId'],
    'Заморозка завершена',
    'Заморозка завершена. Проверьте новый срок в кабинете.',
    'Subscription unfrozen',
    'The freeze has ended. Check the updated term in your account.',
  ],
  SUBSCRIPTION_EXPIRED: [
    ['subscriptionId', 'operationId'],
    'Абонемент истёк',
    'Для продления обратитесь к менеджеру.',
    'Subscription expired',
    'Contact your manager to renew your subscription.',
  ],
  LESSON_SCHEDULED: [
    ['lessonId'],
    'Урок назначен',
    'Новый урок доступен в расписании.',
    'Lesson scheduled',
    'Your new lesson is available in the schedule.',
  ],
  LESSON_RESCHEDULED: [
    ['lessonId'],
    'Урок перенесён',
    'Расписание изменилось. Проверьте новое время в кабинете.',
    'Lesson rescheduled',
    'The schedule has changed. Check the new time in your account.',
  ],
  LESSON_CANCELLED: [
    ['lessonId'],
    'Урок отменён',
    'Урок отменён. Подробности доступны в расписании.',
    'Lesson cancelled',
    'Your lesson has been cancelled. Check the schedule for details.',
  ],
  RESCHEDULE_DECLINED: [
    ['taskId', 'lessonId'],
    'Перенос отклонён',
    'Запрос на перенос отклонён. Для уточнения обратитесь к менеджеру.',
    'Reschedule declined',
    'Your reschedule request was declined. Contact your manager for details.',
  ],
  DISPUTE_ACCEPTED: [
    ['taskId', 'lessonId'],
    'Оспаривание принято',
    'Исходное списание полностью отменено. Занятия и аванс абонемента восстановлены. Это не выплата семье.',
    'Dispute accepted',
    'The original charge was fully reversed. Lesson rights and subscription advance were restored. This is not a cash payout.',
  ],
  DISPUTE_REJECTED: [
    ['taskId', 'lessonId'],
    'Оспаривание отклонено',
    'Оспаривание списания отклонено. Для уточнения обратитесь к менеджеру.',
    'Dispute rejected',
    'Your charge dispute was rejected. Contact your manager for details.',
  ],
  MANUAL_MESSAGE: [
    ['body'],
    'Сообщение менеджера',
    '{body}',
    'Message from your manager',
    '{body}',
  ],
} as const;
export const escapeNotificationHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const containsNotificationSecret = (s: string): boolean =>
  /(?:temporary.?password|password\s*[:=]|(?:access_token|refresh_token|api_key|secret)\s*[:=]|пароль\s*[:=]|bearer\s+[a-z\d]|\b(?:sk|re)_[A-Za-z0-9]{12,}|eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.)/i.test(
    s,
  );
export function renderNotification(
  code: ManagerTemplateCode,
  variables: Record<string, string>,
  locale = 'ru',
): Result<{ title: string; body: string; locale: string }, DomainError> {
  const r = registry[code];
  if (
    !r ||
    !variables ||
    typeof variables !== 'object' ||
    Array.isArray(variables) ||
    Object.keys(variables).length !== r[0].length ||
    r[0].some(
      (k) => typeof variables[k] !== 'string' || !variables[k] || variables[k]!.length > 2000,
    ) ||
    Object.keys(variables).some((k) => !(r[0] as readonly string[]).includes(k)) ||
    Object.values(variables).some((v) => containsNotificationSecret(v))
  )
    return err(domainError('TEMPLATE_VARIABLES_INVALID', 422));
  if (
    Object.entries(variables).some(([k, v]) => k.endsWith('Id') && !UUID.test(v)) ||
    (code === 'ACCOUNT_CREATED' &&
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(variables.loginEmail!)) ||
    (code === 'PAYMENT_CONFIRMED' && variables.receiptOnly !== 'true')
  )
    return err(domainError('TEMPLATE_VARIABLES_INVALID', 422));
  const language = locale.toLowerCase().split('-')[0] === 'en' ? 'en' : 'ru',
    i = language === 'en' ? 3 : 1;
  const body = (r[i + 1] as string).replace(/\{(\w+)\}/g, (_: string, k: string) => variables[k]!);
  if (body.length > 2000) return err(domainError('TEMPLATE_VARIABLES_INVALID', 422));
  return ok({ title: r[i] as string, body, locale: language });
}
export function validateNotificationLinks(text: string): Result<void, DomainError> {
  const allowed = new Set([
    'meet.google.com',
    ...(process.env.NOTIFICATION_ALLOWED_DOMAINS || process.env.WEBAUTHN_RP_ID || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ]);
  const links =
    text.match(
      /(?:[a-z][a-z\d+.-]*:\/\/|(?:mailto|javascript|data|vbscript):|www\.)[^\s<>"']+|\b(?:[a-z\d-]+\.)+[a-z]{2,}(?:[/:][^\s<>"']*)?/gi,
    ) ?? [];
  for (const link of links) {
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(link) ? link : `https://${link}`);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        !allowed.has(url.hostname.toLowerCase())
      )
        return err(domainError('LINK_NOT_ALLOWED', 422));
    } catch {
      return err(domainError('LINK_NOT_ALLOWED', 422));
    }
  }
  return ok(undefined);
}
