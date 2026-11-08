import type { NotificationType } from './notifications.dto.js';
import { notificationContent } from '../../modules/notifications/notification.service.js';
import {
  MANAGER_TEMPLATE_CODES,
  renderNotification,
} from '../../modules/notifications/templates.js';
import type { ManagerTemplateCode } from '../../modules/notifications/templates.js';

type Catalog = { code: unknown; params: unknown; kind: unknown };
const ro: Record<Exclude<NotificationType, 'MANUAL_MESSAGE'>, readonly [string, string]> = {
  LESSON_SCHEDULED: ['Lecție programată', 'Noua lecție este disponibilă în orar.'],
  RESCHEDULE_DECLINED: [
    'Reprogramare refuzată',
    'Cererea de reprogramare a fost refuzată. Pentru detalii, contactează managerul.',
  ],
  DISPUTE_ACCEPTED: [
    'Contestație acceptată',
    'Deducerea inițială a fost anulată integral. Drepturile la lecții și avansul abonamentului au fost restabilite. Aceasta nu este o plată către familie.',
  ],
  DISPUTE_REJECTED: [
    'Contestație respinsă',
    'Contestația deducerii a fost respinsă. Pentru detalii, contactează managerul.',
  ],
  SUBSCRIPTION_CREATED: [
    'Abonament creat',
    'Abonamentul a fost creat. Verifică datele în cabinet.',
  ],
  SUBSCRIPTION_RENEWED: [
    'Abonament prelungit',
    'Abonamentul a fost prelungit. Verifică noua perioadă în cabinet.',
  ],
  SUBSCRIPTION_FROZEN: [
    'Abonament suspendat temporar',
    'Suspendarea temporară a fost înregistrată. Verifică datele în cabinet.',
  ],
  SUBSCRIPTION_UNFROZEN: [
    'Suspendarea temporară s-a încheiat',
    'Suspendarea temporară s-a încheiat. Verifică noua perioadă în cabinet.',
  ],
  SUBSCRIPTION_EXPIRED: ['Abonament expirat', 'Pentru prelungire, contactează managerul.'],
  ACCOUNT_CREATED: ['Cabinetul elevului a fost creat', ''],
  HOMEWORK_REVIEWED: [
    'Tema a fost verificată',
    'Profesorul a verificat tema. Deschide tema pentru detalii.',
  ],
  HOMEWORK_NEEDS_REVISION: [
    'Tema necesită revizuire',
    'Profesorul a returnat tema pentru revizuire. Deschide tema.',
  ],
  LESSON_RESCHEDULED: [
    'Lecție reprogramată',
    'Orarul s-a schimbat. Deschide lecția pentru a verifica ora nouă.',
  ],
  LESSON_CANCELLED: [
    'Lecție anulată',
    'Lecția a fost anulată. Detaliile sunt disponibile în orar.',
  ],
  REPORT_READY: [
    'Raportul educațional este gata',
    'Profesorul a publicat raportul despre învățare.',
  ],
  SUBSCRIPTION_EXPIRING: ['Abonamentul expiră în curând', ''],
  PAYMENT_CONFIRMED: [
    'Plată confirmată',
    'Directorul a confirmat plata și alocarea ei către abonament.',
  ],
};
// Read projection only. Never infer a catalog key or missing params from inbox text.
export function projectNotificationText(
  type: NotificationType,
  catalog: unknown,
  locale: 'ru' | 'ro',
): { title: string; body: string } | null {
  if (
    type === 'MANUAL_MESSAGE' ||
    !catalog ||
    typeof catalog !== 'object' ||
    Array.isArray(catalog)
  )
    return null;
  const { code, params, kind } = catalog as Catalog;
  if (
    code !== type ||
    !params ||
    typeof params !== 'object' ||
    Array.isArray(params) ||
    !['source', 'dispatch'].includes(String(kind))
  )
    return null;
  try {
    const variables = params as Record<string, string>;
    let base: { title: string; body: string };
    if (kind === 'dispatch') {
      if (!MANAGER_TEMPLATE_CODES.includes(type as ManagerTemplateCode)) return null;
      const result = renderNotification(type as ManagerTemplateCode, variables, 'ru');
      if (!result.ok) return null;
      base = result.value;
    } else base = notificationContent(type, params);
    if (locale === 'ru') return { title: base.title, body: base.body };
    const copy = ro[type];
    let body = copy[1];
    if (type === 'ACCOUNT_CREATED')
      body =
        kind === 'dispatch'
          ? `Datele de conectare: ${variables.loginEmail}. Urmează instrucțiunile managerului.`
          : `Datele de conectare: ${variables.loginEmail}. Cere parola temporară managerului, intră în cabinet și schimb-o în termen de 72 de ore.`;
    if (type === 'SUBSCRIPTION_EXPIRING')
      body = `Până la expirarea abonamentului au rămas ${(params as Record<string, unknown>).daysBefore} zile.`;
    if (type === 'PAYMENT_CONFIRMED' && variables.receiptOnly === 'true')
      body = 'Directorul a confirmat încasarea. Verifică alocarea și accesul la lecții în cabinet.';
    return { title: copy[0], body };
  } catch {
    return null;
  }
}
