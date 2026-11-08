import type { Prisma } from '@online-school/db';
import { domainError } from '../core/errors/domain-error.js';
import type { ManagerContactsDto } from '../core/errors/error-mapper.js';
import { projectManagerContacts } from '../core/errors/manager-contacts.js';

export { publicManagerLink } from '../core/errors/manager-contacts.js';

export async function studentManagerContacts(
  client: Pick<Prisma.TransactionClient, '$queryRaw'>,
  studentId: string,
): Promise<ManagerContactsDto> {
  const [row] = await client.$queryRaw<
    {
      whatsapp: string | null;
      telegram: string | null;
      displayName: string | null;
      phoneE164: string | null;
    }[]
  >`
    WITH current_assignment AS (
      SELECT a.manager_id FROM assigned_managers a
      WHERE a.student_id=${studentId}::uuid AND a.assigned_at<=statement_timestamp()
        AND (a.ended_at IS NULL OR a.ended_at>statement_timestamp())
      ORDER BY a.assigned_at DESC,a.id DESC LIMIT 1
    )
    SELECT s.student_whatsapp_url AS whatsapp,s.student_telegram_url AS telegram,
      s.full_name AS "displayName",s.student_phone_e164 AS "phoneE164"
    FROM current_assignment a JOIN staff_accounts s ON s.id=a.manager_id
    JOIN auth_accounts u ON u.id=s.account_id
    WHERE s.deactivated_at IS NULL AND u.disabled_at IS NULL AND u.kind='STAFF'
      AND EXISTS(SELECT 1 FROM role_assignments ra JOIN roles r ON r.id=ra.role_id WHERE ra.account_id=u.id
        AND r.code IN('MANAGER','DIRECTOR') AND ra.valid_from<=statement_timestamp()
        AND (ra.valid_to IS NULL OR ra.valid_to>statement_timestamp()))`;
  return projectManagerContacts(row);
}

export function studentAccessSuspended(contacts?: ManagerContactsDto) {
  return {
    ...domainError('ACCESS_SUSPENDED', 402),
    details: { managerContacts: contacts ?? projectManagerContacts(undefined) },
  };
}
