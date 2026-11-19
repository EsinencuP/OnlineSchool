import type { components } from '@online-school/api-contracts';
import { useLocale } from '@online-school/ui';
import type { IconName } from '@online-school/ui';
import { isRouteUuid, studentSubscriptionPath } from './studentSubjectRoutes.js';

type Notice = components['schemas']['NotificationItemDto'];

export const studentNotificationsPath = '/student/notifications';

const copy = {
  title: ['Уведомления', 'Notificări'],
  recent: ['Последние уведомления', 'Notificări recente'],
  about: ['Уроки, задания и сообщения менеджера.', 'Lecții, teme și mesaje de la manager.'],
  all: ['Вся лента', 'Toate notificările'],
  unread: ['Непрочитано', 'Necitite'],
  new: ['Новое', 'Nouă'],
  empty: ['Уведомлений пока нет.', 'Nu există încă notificări.'],
  emptyPage: ['На этой странице уведомлений нет.', 'Nu există notificări pe această pagină.'],
  reading: ['Сохраняем отметку…', 'Salvăm marcarea…'],
  checking: ['Проверяем отметку…', 'Verificăm marcarea…'],
  saved: ['Статус прочтения обновлён.', 'Starea de citire a fost actualizată.'],
  unknown: [
    'Результат отметки пока неизвестен. Проверьте статус перед повтором.',
    'Rezultatul marcării este încă necunoscut. Verifică starea înainte de reîncercare.',
  ],
  current: [
    'Статус проверен. Можно повторить исходную отметку.',
    'Starea a fost verificată. Poți repeta marcarea inițială.',
  ],
  check: ['Проверить отметку', 'Verifică marcarea'],
  repeat: ['Повторить исходную отметку', 'Repetă marcarea inițială'],
  mark: ['Отметить прочитанным', 'Marchează ca citită'],
  markAll: ['Прочитать все', 'Marchează toate ca citite'],
  refresh: ['Обновить ленту', 'Actualizează fluxul'],
  loading: ['Загружаем уведомления…', 'Se încarcă notificările…'],
  loadError: ['Не удалось загрузить уведомления.', 'Notificările nu au putut fi încărcate.'],
  checkError: [
    'Не удалось проверить статус. Попробуйте ещё раз.',
    'Starea nu a putut fi verificată. Încearcă din nou.',
  ],
  writeError: [
    'Не удалось сохранить отметку. Обновите ленту.',
    'Marcarea nu a putut fi salvată. Actualizează fluxul.',
  ],
  access: ['Уведомления недоступны.', 'Notificările nu sunt disponibile.'],
  missing: ['Это уведомление уже недоступно.', 'Această notificare nu mai este disponibilă.'],
  lessons: ['Расписание', 'Orar'],
  homework: ['Домашнее задание', 'Temă'],
  reports: ['Учебный отчёт', 'Raport de studiu'],
  subscription: ['Абонемент', 'Abonament'],
  manager: ['Сообщение менеджера', 'Mesaj de la manager'],
  profile: ['Кабинет', 'Cabinet'],
  openLesson: ['Открыть урок', 'Deschide lecția'],
  openHomework: ['Открыть задание', 'Deschide tema'],
  openReport: ['Открыть отчёт', 'Deschide raportul'],
  openSubscription: ['Открыть абонемент', 'Deschide abonamentul'],
} as const;

export type NotificationMessage = keyof typeof copy;
type Destination = 'lessons' | 'homework' | 'reports' | 'subscription';
type Group = Destination | 'manager' | 'profile';

const groups: Record<Notice['type'], Group> = {
  LESSON_SCHEDULED: 'lessons',
  RESCHEDULE_DECLINED: 'lessons',
  DISPUTE_ACCEPTED: 'lessons',
  DISPUTE_REJECTED: 'lessons',
  MANUAL_MESSAGE: 'manager',
  SUBSCRIPTION_CREATED: 'subscription',
  SUBSCRIPTION_RENEWED: 'subscription',
  SUBSCRIPTION_FROZEN: 'subscription',
  SUBSCRIPTION_UNFROZEN: 'subscription',
  SUBSCRIPTION_EXPIRED: 'subscription',
  ACCOUNT_CREATED: 'profile',
  HOMEWORK_REVIEWED: 'homework',
  HOMEWORK_NEEDS_REVISION: 'homework',
  LESSON_RESCHEDULED: 'lessons',
  LESSON_CANCELLED: 'lessons',
  REPORT_READY: 'reports',
  SUBSCRIPTION_EXPIRING: 'subscription',
  PAYMENT_CONFIRMED: 'subscription',
};

const visuals: Record<Group, { icon: IconName; tone: string }> = {
  lessons: { icon: 'calendar', tone: 'blue' },
  homework: { icon: 'tasks', tone: 'peach' },
  reports: { icon: 'skills', tone: 'violet' },
  subscription: { icon: 'wallet', tone: 'mint' },
  manager: { icon: 'manager', tone: 'rose' },
  profile: { icon: 'profile', tone: 'violet' },
};

const targets = {
  lessons: { key: 'lessonId', label: 'openLesson' },
  homework: { key: 'homeworkId', label: 'openHomework' },
  reports: { key: 'reportId', label: 'openReport' },
  subscription: { key: 'subscriptionId', label: 'openSubscription' },
} as const;

export function noticePresentation(item: Notice) {
  const group = groups[item.type] ?? 'profile';
  const visual = { category: group, ...visuals[group] };
  if (group === 'manager' || group === 'profile') return { ...visual, target: null };
  const { key, label } = targets[group];
  const id = item.payload?.[key];
  if (typeof id !== 'string' || !isRouteUuid(id)) return { ...visual, target: null };
  const href =
    group === 'subscription'
      ? studentSubscriptionPath + '?' + new URLSearchParams({ subscriptionId: id })
      : '/student/' + group + '/' + encodeURIComponent(id);
  return { ...visual, target: { href, label } };
}

export function useNotificationCopy() {
  const { locale } = useLocale();
  return { locale, text: (key: NotificationMessage) => copy[key][locale === 'ro' ? 1 : 0] };
}
