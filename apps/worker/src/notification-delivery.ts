import type { NotificationDispatch } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import { NotificationService } from '@online-school/api/notifications';
import type { Handler } from './contracts.js';
export type NotificationEmailProvider = {
  send(
    row: NotificationDispatch,
  ): Promise<{ ok: true; reference: string } | { ok: false; code: string }>;
};
export class ResendNotificationProvider implements NotificationEmailProvider {
  async send(
    row: NotificationDispatch,
  ): Promise<{ ok: true; reference: string } | { ok: false; code: string }> {
    const key = process.env.RESEND_API_KEY,
      from = process.env.STUDENT_EMAIL_FROM;
    if (
      !key ||
      /[\r\n\s]/.test(key) ||
      !from ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from) ||
      !row.recipient_email
    )
      return { ok: false, code: 'EMAIL_NOT_CONFIGURED' };
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `manager-notification/${row.id}`,
        },
        body: JSON.stringify({
          from,
          to: [row.recipient_email],
          subject: row.subject,
          text: row.body,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return { ok: false, code: 'EMAIL_DELIVERY_UNAVAILABLE' };
      const body: unknown = await response.json();
      return body &&
        typeof body === 'object' &&
        'id' in body &&
        typeof body.id === 'string' &&
        body.id.length <= 200
        ? { ok: true, reference: body.id }
        : { ok: false, code: 'EMAIL_DELIVERY_UNAVAILABLE' };
    } catch {
      return { ok: false, code: 'EMAIL_DELIVERY_UNAVAILABLE' };
    }
  }
}
export function notificationDeliveryHandler(
  provider: NotificationEmailProvider = new ResendNotificationProvider(),
): Handler {
  return async (tx, event, now) => {
    const p = event.payload as { notificationId?: unknown };
    if (p.notificationId !== event.aggregate_id) return err({ code: 'INVALID_NOTIFICATION_EVENT' });
    const row = await tx.notificationDispatch.findUnique({ where: { id: event.aggregate_id } });
    if (!row) return err({ code: 'NOTIFICATION_NOT_FOUND' });
    if (row.status !== 'QUEUED') return ok(undefined);
    let reference: string | null = null;
    if (row.channel === 'IN_APP') {
      if (!row.source_id) return err({ code: 'INVALID_NOTIFICATION_SOURCE' });
      const account = await tx.studentAccount.findFirst({
        where: { student_id: row.student_id, deactivated_at: null, account: { disabled_at: null } },
        select: { id: true },
      });
      if (!account) {
        await tx.notificationDispatch.update({
          where: { id: row.id },
          data: { status: 'FAILED', failure_reason: 'NO_DELIVERY_CHANNEL' },
        });
        return ok(undefined);
      }
      const source = await tx.studentNotificationSource.findUnique({
        where: { id: row.source_id },
      });
      if (!source || source.student_id !== row.student_id)
        return err({ code: 'INVALID_NOTIFICATION_SOURCE' });
      if (!source.delivered_at) {
        await new NotificationService().create(tx, row.source_id, row.locale);
        await tx.studentNotificationSource.update({
          where: { id: row.source_id },
          data: { delivered_at: now },
        });
      }
    } else {
      // The committed claim fixes the first-attempt time. Never resend outside
      // the provider's 24-hour deduplication window after an ambiguous result.
      if (!row.first_attempt_at) return err({ code: 'NOTIFICATION_NOT_CLAIMED' });
      if (+now - +row.first_attempt_at > 23 * 3600000) {
        await tx.notificationDispatch.update({
          where: { id: row.id },
          data: { status: 'FAILED', failure_reason: 'DELIVERY_UNCONFIRMED' },
        });
        return ok(undefined);
      }
      const sent = await provider.send(row);
      if (!sent.ok) return err({ code: sent.code });
      reference = sent.reference;
    }
    await tx.notificationDispatch.update({
      where: { id: row.id },
      data: { status: 'SENT', sent_at: now, failure_reason: null, provider_reference: reference },
    });
    return ok(undefined);
  };
}
