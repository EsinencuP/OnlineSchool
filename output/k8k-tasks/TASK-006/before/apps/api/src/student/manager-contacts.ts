import type { Prisma } from '@online-school/db';
export function publicManagerLink(value: unknown, kind: 'whatsapp' | 'telegram'): string {
  if (typeof value !== 'string') return '';
  const pattern =
    kind === 'whatsapp'
      ? /^https:\/\/wa\.me\/[1-9]\d{6,14}\/?$/
      : /^https:\/\/t\.me\/[a-zA-Z0-9_]{5,32}\/?$/;
  return pattern.test(value) ? value : '';
}
export async function studentManagerContacts(
  client: Pick<Prisma.TransactionClient, '$queryRaw'>,
  studentId: string,
) {
  const [row] = await client.$queryRaw<
    { whatsapp: string | null; telegram: string | null }[]
  >`SELECT s.student_whatsapp_url AS whatsapp,s.student_telegram_url AS telegram
    FROM assigned_managers a JOIN staff_accounts s ON s.id=a.manager_id JOIN auth_accounts u ON u.id=s.account_id
    WHERE a.student_id=${studentId}::uuid AND a.assigned_at<=statement_timestamp()
      AND (a.ended_at IS NULL OR a.ended_at>statement_timestamp()) AND s.deactivated_at IS NULL AND u.disabled_at IS NULL
      AND EXISTS(SELECT 1 FROM role_assignments ra JOIN roles r ON r.id=ra.role_id WHERE ra.account_id=u.id
        AND r.code IN('MANAGER','DIRECTOR') AND ra.valid_from<=statement_timestamp() AND (ra.valid_to IS NULL OR ra.valid_to>statement_timestamp()))
    ORDER BY a.assigned_at DESC,a.id DESC LIMIT 1`;
  return {
    whatsapp: publicManagerLink(row?.whatsapp, 'whatsapp'),
    telegram: publicManagerLink(row?.telegram, 'telegram'),
  };
}
