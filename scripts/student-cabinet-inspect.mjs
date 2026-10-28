// One-off read-only deployment inspection. No HTTP endpoint and no credential output.
import { createDirectClient } from '../packages/db/dist/index.js';
const until = Number(process.env.STUDENT_CABINET_INSPECT_UNTIL);
if (
  process.env.VERCEL_PROJECT_ID !== 'prj_XusYmdwL1Y0478T09RNKmBQMldgZ' ||
  !Number.isSafeInteger(until) ||
  until <= Date.now() ||
  until > Date.now() + 30 * 60_000
) {
  console.log('Student cabinet inspection skipped: no live scoped request');
} else {
  const connection = createDirectClient();
  if (!connection.ok) throw new Error('Cabinet inspection connection unavailable');
  const db = connection.value;
  try {
    const result = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const [counts] = await tx.$queryRaw`SELECT
        (SELECT count(*)::int FROM students) AS students,
        (SELECT count(*)::int FROM student_accounts WHERE deactivated_at IS NULL) AS active_student_accounts,
        (SELECT count(*)::int FROM subscriptions) AS subscriptions,
        (SELECT count(*)::int FROM payment_receipts) AS payment_receipts,
        (SELECT count(*)::int FROM teacher_accounts WHERE deactivated_at IS NULL) AS teachers,
        (SELECT count(*)::int FROM lesson_occurrences) AS lessons,
        (SELECT count(*)::int FROM homework_deliveries) AS homework,
        (SELECT count(*)::int FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied_migrations`;
        const email = process.env.STUDENT_TEST_EMAIL?.trim().toLowerCase();
        const matches = email
          ? await tx.authAccount.findMany({
              where: { login_id: { in: [email, email.replace('@', '+student@')] } },
              select: { id: true, kind: true, login_id: true, disabled_at: true },
            })
          : [];
        const directors =
          await tx.$queryRaw`SELECT s.id,s.account_id FROM staff_accounts s JOIN auth_accounts u ON u.id=s.account_id
        WHERE s.deactivated_at IS NULL AND u.disabled_at IS NULL AND EXISTS(SELECT 1 FROM role_assignments ra JOIN roles r ON r.id=ra.role_id
        WHERE ra.account_id=u.id AND r.code='DIRECTOR' AND ra.valid_from<=now() AND (ra.valid_to IS NULL OR ra.valid_to>now()))`;
        return {
          counts,
          testLoginMatches: matches.map((m) => ({
            accountId: m.id,
            kind: m.kind,
            disabled: !!m.disabled_at,
            requestedEmail: m.login_id === email,
          })),
          directorIds: directors,
        };
      },
      { timeout: 20_000 },
    );
    console.log('STUDENT_CABINET_READONLY_INSPECTION ' + JSON.stringify(result));
  } finally {
    await db.$disconnect();
  }
}
