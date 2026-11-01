import { Injectable, Module } from '@nestjs/common';
import type { Prisma, StudentNotificationSource, StudentNotificationType } from '@online-school/db';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { at } from '../finance/finance-common.js';
import { email, object, uuid } from '../identity/input.js';
import { MANAGER_TEMPLATE_CODES, renderNotification } from './templates.js';
import type { ManagerTemplateCode } from './templates.js';
import { unwrap } from '../../core/errors/domain-error.js';
export { NotificationOutboxPublisher } from './notification-outbox.publisher.js';
export {
  renderNotification,
  escapeNotificationHtml,
  validateNotificationLinks,
  MANAGER_TEMPLATE_CODES,
} from './templates.js';

export const NOTIFICATION_TTL_MS = 90 * 86400000;
export const NOTIFICATION_LIMIT = 500;
export function notificationContent(
  type: StudentNotificationType,
  input: unknown,
  locale?: string,
) {
  if (
    [
      'LESSON_SCHEDULED',
      'RESCHEDULE_DECLINED',
      'DISPUTE_ACCEPTED',
      'DISPUTE_REJECTED',
      'MANUAL_MESSAGE',
    ].includes(type) ||
    (type === 'PAYMENT_CONFIRMED' &&
      !!input &&
      typeof input === 'object' &&
      'receiptOnly' in input) ||
    (locale !== undefined && MANAGER_TEMPLATE_CODES.includes(type as ManagerTemplateCode))
  ) {
    const variables = input as Record<string, string>;
    const rendered = unwrap(renderNotification(type as ManagerTemplateCode, variables, locale));
    return { title: rendered.title, body: rendered.body, payload: variables };
  }
  const payload = object(input, [
    'homeworkId',
    'reviewId',
    'lessonId',
    'reportId',
    'subscriptionId',
    'paymentId',
    'distributionId',
    'daysBefore',
    'expiresAt',
    'accountId',
    'loginEmail',
    'operationId',
  ]);
  const ids = (keys: string[]) =>
    Object.fromEntries(
      keys.map((key) => {
        const value = payload[key];
        uuid(value);
        return [key, value as string];
      }),
    );
  switch (type) {
    case 'SUBSCRIPTION_CREATED':
    case 'SUBSCRIPTION_RENEWED':
    case 'SUBSCRIPTION_FROZEN':
    case 'SUBSCRIPTION_UNFROZEN':
    case 'SUBSCRIPTION_EXPIRED': {
      const copy = {
        SUBSCRIPTION_CREATED: [
          'Абонемент создан',
          'Ваш абонемент создан. Проверьте срок и доступные занятия в кабинете.',
        ],
        SUBSCRIPTION_RENEWED: [
          'Абонемент продлён',
          'Менеджер продлил ваш абонемент. Новый срок и остаток занятий доступны в кабинете.',
        ],
        SUBSCRIPTION_FROZEN: [
          'Абонемент заморожен',
          'Менеджер оформил заморозку абонемента. Проверьте даты в кабинете.',
        ],
        SUBSCRIPTION_UNFROZEN: [
          'Заморозка завершена',
          'Срок абонемента продлён на фактическое число дней заморозки.',
        ],
        SUBSCRIPTION_EXPIRED: [
          'Абонемент истёк',
          'Срок абонемента завершён. Для продления обратитесь к менеджеру.',
        ],
      }[type];
      return { title: copy[0]!, body: copy[1]!, payload: ids(['subscriptionId', 'operationId']) };
    }
    case 'ACCOUNT_CREATED': {
      const loginEmail = email(payload.loginEmail);
      return {
        title: 'Кабинет ученика создан',
        body: `Ваш логин: ${loginEmail}. Получите временный пароль у менеджера, войдите и замените его собственным в течение 72 часов.`,
        payload: { ...ids(['accountId']), loginEmail },
      };
    }
    case 'HOMEWORK_REVIEWED':
      return {
        title: 'Домашнее задание проверено',
        body: 'Учитель проверил вашу работу. Откройте домашнее задание.',
        payload: ids(['homeworkId', 'reviewId']),
      };
    case 'HOMEWORK_NEEDS_REVISION':
      return {
        title: 'Домашнее задание на доработке',
        body: 'Учитель вернул работу на доработку. Откройте домашнее задание.',
        payload: ids(['homeworkId', 'reviewId']),
      };
    case 'LESSON_RESCHEDULED':
      return {
        title: 'Урок перенесён',
        body: 'Расписание изменилось. Откройте урок, чтобы проверить новое время.',
        payload: ids(['lessonId']),
      };
    case 'LESSON_CANCELLED':
      return {
        title: 'Урок отменён',
        body: 'Урок отменён. Подробности доступны в расписании.',
        payload: ids(['lessonId']),
      };
    case 'REPORT_READY':
      return {
        title: 'Образовательный отчёт готов',
        body: 'Учитель опубликовал отчёт о вашем обучении.',
        payload: ids(['reportId']),
      };
    case 'SUBSCRIPTION_EXPIRING': {
      if (
        ![7, 3].includes(payload.daysBefore as number) ||
        typeof payload.expiresAt !== 'string' ||
        !/^\d{4}-\d\d-\d\dT/.test(payload.expiresAt) ||
        !Number.isFinite(+new Date(payload.expiresAt))
      )
        return fail(domainError('INVALID_NOTIFICATION_SOURCE', 422));
      return {
        title: 'Абонемент скоро истекает',
        body: `До окончания абонемента ${payload.daysBefore === 7 ? '7 дней' : '3 дня'}.`,
        payload: {
          ...ids(['subscriptionId']),
          daysBefore: payload.daysBefore,
          expiresAt: payload.expiresAt,
        },
      };
    }
    case 'PAYMENT_CONFIRMED':
      return {
        title: 'Оплата подтверждена',
        body: 'Руководитель подтвердил оплату и её распределение на ваш абонемент.',
        payload: ids(['paymentId', 'distributionId', 'subscriptionId']),
      };
    default:
      return fail(domainError('INVALID_NOTIFICATION_SOURCE', 422));
  }
}

export async function notificationLock(tx: Prisma.TransactionClient, studentId: string) {
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${`student-notifications:${studentId}`},0))`;
}
export async function archiveNotifications(
  tx: Prisma.TransactionClient,
  studentId: string,
  now: Date,
) {
  const cutoff = new Date(+now - NOTIFICATION_TTL_MS);
  await tx.$executeRaw`WITH ranked AS (
    SELECT id,created_at,row_number() OVER(ORDER BY created_at DESC,id DESC) AS ordinal
    FROM student_notifications WHERE student_id=${studentId}::uuid AND archived_at IS NULL
  ) UPDATE student_notifications n SET archived_at=${now} FROM ranked r WHERE n.id=r.id
    AND (r.ordinal>${NOTIFICATION_LIMIT} OR r.created_at<=${cutoff})`;
}

@Injectable()
export class NotificationService {
  // Only a committed canonical source id is accepted. Callers cannot substitute
  // another pupil, a private note or a URL in an inbox item.
  async create(tx: Prisma.TransactionClient, sourceId: string, locale?: string): Promise<void> {
    const source: StudentNotificationSource | null = await tx.studentNotificationSource.findUnique({
      where: { id: uuid(sourceId) },
    });
    if (!source) return fail(domainError('NOTIFICATION_SOURCE_NOT_FOUND', 404));
    await notificationLock(tx, source.student_id);
    const now = await at(tx);
    if (source.occurred_at > now) return fail(domainError('INVALID_NOTIFICATION_SOURCE', 422));
    const content = notificationContent(source.type, source.payload, locale);
    await tx.studentNotification.createMany({
      skipDuplicates: true,
      data: [
        {
          id: source.id,
          student_id: source.student_id,
          type: source.type,
          title: content.title,
          body: content.body,
          payload: content.payload as Prisma.InputJsonObject,
          created_at: source.occurred_at,
        },
      ],
    });
    await archiveNotifications(tx, source.student_id, now);
  }
}
@Module({ providers: [NotificationService], exports: [NotificationService] })
export class NotificationModule {}
