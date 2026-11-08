import { anchors } from './k8k-subscriptions/data.mjs';
export const id = (n) => '73000000-0000-4000-8000-' + String(n).padStart(12, '0');
export const oldReport = '80000000-0000-4000-8000-000000000025';
export function bellFixture() {
  const definitions = [
    [
      'REPORT_READY',
      { reportId: oldReport },
      'Образовательный отчёт готов',
      'Учитель опубликовал отчёт о вашем обучении.',
    ],
    [
      'HOMEWORK_NEEDS_REVISION',
      { homeworkId: '20000000-0000-4000-8000-000000000001', reviewId: id(90) },
      'Домашнее задание на доработке',
      'Учитель вернул работу на доработку.',
    ],
    [
      'LESSON_RESCHEDULED',
      { lessonId: '10000000-0000-4000-8000-000000000001' },
      'Урок перенесён',
      'Откройте урок, чтобы проверить новое время.',
    ],
    [
      'SUBSCRIPTION_EXPIRING',
      { subscriptionId: anchors.math, daysBefore: 3, expiresAt: '2026-11-11T12:00:00Z' },
      'Абонемент скоро истекает',
      'До окончания абонемента 3 дня.',
    ],
    [
      'MANUAL_MESSAGE',
      { body: 'Salut! Это сообщение менеджера остаётся исходным.' },
      'Личное сообщение менеджера',
      'Salut! Это сообщение менеджера остаётся исходным.',
    ],
    [
      'REPORT_READY',
      { reportId: oldReport },
      'Исторический готовый текст',
      '  Готовый текст без template key/params\n  не переводится.',
    ],
  ];
  const notificationRows = Array.from({ length: 12 }, (_, index) => {
    const [type, payload, title, body] = definitions[index % 6];
    return {
      notificationId: id(index + 1),
      type,
      payload,
      title,
      body,
      index,
      createdAt: new Date(Date.UTC(2026, 10, 7, 12, 0, 0) - index * 60000).toISOString(),
      isRead: index >= 5 && index < 10,
      catalog: index === 5 ? null : { code: type, params: payload, kind: 'source' },
    };
  });
  return { notificationRows, subscriptionScenario: 'partial' };
}
export function bellProjection(row, locale) {
  const { catalog, index, ...item } = row;
  void index;
  if (locale !== 'ro' || !catalog || catalog.code !== item.type || item.type === 'MANUAL_MESSAGE')
    return item;
  const copy = {
    REPORT_READY: [
      'Raportul educațional este gata',
      'Profesorul a publicat raportul despre învățare.',
    ],
    HOMEWORK_NEEDS_REVISION: [
      'Tema necesită revizuire',
      'Profesorul a returnat tema pentru revizuire.',
    ],
    LESSON_RESCHEDULED: [
      'Lecție reprogramată',
      'Orarul s-a schimbat. Deschide lecția pentru a verifica ora nouă.',
    ],
    SUBSCRIPTION_EXPIRING: [
      'Abonamentul expiră în curând',
      'Până la expirarea abonamentului au rămas 3 zile.',
    ],
  }[item.type];
  return copy ? { ...item, title: copy[0], body: copy[1] } : item;
}
