import { useLocale } from '@online-school/ui';
const messages = {
  help: [
    'Событие ведёт к исходному объекту. Отметка прочтения не выполняет действие по нему.',
    'Evenimentul duce la obiectul sursă. Marcarea ca citit nu execută o acțiune asupra lui.',
  ],
  globalUnread: ['Непрочитанных во всей ленте', 'Necitite în întregul flux'],
  total: ['Всего событий', 'Total evenimente'],
  empty: ['Событий пока нет.', 'Nu există încă evenimente.'],
  emptyPage: ['На этой странице событий нет.', 'Nu există evenimente pe această pagină.'],
  unavailable: ['Счётчик сейчас недоступен.', 'Contorul nu este disponibil acum.'],
  retryCount: ['Обновить счётчик', 'Actualizează contorul'],
  pending: ['Сохраняем отметку…', 'Salvăm marcarea…'],
  unknown: [
    'Результат отметки пока неизвестен. Обнови события перед повтором.',
    'Rezultatul marcării este încă necunoscut. Actualizează evenimentele înainte de reîncercare.',
  ],
  check: ['Проверить отметку', 'Verifică marcarea'],
  retry: ['Повторить ту же отметку', 'Reîncearcă aceeași marcare'],
  refresh: ['Обновить события', 'Actualizează evenimentele'],
  firstPage: ['К первой странице', 'La prima pagină'],
} as const;
const types: Record<string, readonly [string, string]> = {
  LESSON_SCHEDULED: ['Урок назначен', 'Lecție programată'],
  RESCHEDULE_DECLINED: ['Перенос отклонён', 'Reprogramare refuzată'],
  DISPUTE_ACCEPTED: ['Оспаривание принято', 'Contestație acceptată'],
  DISPUTE_REJECTED: ['Оспаривание отклонено', 'Contestație respinsă'],
  MANUAL_MESSAGE: ['Сообщение менеджера', 'Mesaj de la manager'],
  SUBSCRIPTION_CREATED: ['Абонемент создан', 'Abonament creat'],
  SUBSCRIPTION_RENEWED: ['Абонемент продлён', 'Abonament prelungit'],
  SUBSCRIPTION_FROZEN: ['Абонемент заморожен', 'Abonament suspendat temporar'],
  SUBSCRIPTION_UNFROZEN: ['Заморозка завершена', 'Suspendarea temporară s-a încheiat'],
  SUBSCRIPTION_EXPIRED: ['Абонемент истёк', 'Abonament expirat'],
  ACCOUNT_CREATED: ['Кабинет создан', 'Cabinet creat'],
  HOMEWORK_REVIEWED: ['ДЗ проверено', 'Temă verificată'],
  HOMEWORK_NEEDS_REVISION: ['ДЗ на доработке', 'Temă de revizuit'],
  LESSON_RESCHEDULED: ['Урок перенесён', 'Lecție reprogramată'],
  LESSON_CANCELLED: ['Урок отменён', 'Lecție anulată'],
  REPORT_READY: ['Отчёт опубликован', 'Raport publicat'],
  SUBSCRIPTION_EXPIRING: ['Срок абонемента', 'Termenul abonamentului'],
  PAYMENT_CONFIRMED: ['Подтверждение оплаты', 'Confirmarea plății'],
};
export function useNotificationCopy() {
  const { locale, t } = useLocale();
  return {
    locale,
    t,
    text: (key: keyof typeof messages) => messages[key][locale === 'ro' ? 1 : 0],
    typeLabel: (type: string) =>
      types[type]?.[locale === 'ro' ? 1 : 0] ?? (locale === 'ro' ? 'Eveniment' : 'Событие'),
  };
}
