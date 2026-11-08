// Read-only check using the actual restricted runtime role, after migrations.
import { createPoolClient } from '../packages/db/dist/index.js';
import { DashboardService } from '../apps/api/dist/student/dashboard/dashboard.service.js';
const connection = createPoolClient();
if (!connection.ok) throw new Error('Runtime database configuration unavailable');
const db = connection.value;
try {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const [permissions] = await tx.$queryRaw`SELECT
      has_column_privilege(current_user,'auth_accounts','password_hash','UPDATE') AS password,
      has_column_privilege(current_user,'auth_accounts','login_id','UPDATE') AS email,
      has_column_privilege(current_user,'auth_accounts','email_verified_at','UPDATE') AS verification,
      has_column_privilege(current_user,'student_accounts','must_change_password','UPDATE') AS bootstrap,
      has_column_privilege(current_user,'students','display_name','UPDATE') AS profile,
      has_column_privilege(current_user,'students','avatar_file_id','UPDATE') AS avatar,
      has_table_privilege(current_user,'education_reports','SELECT') AS crm_reports,
      has_table_privilege(current_user,'progress_checkpoints','SELECT') AS crm_checkpoints`;
    if (!Object.values(permissions).every(Boolean))
      throw new Error('Student runtime permissions incomplete');
    // Exercise the real parameterized projection with the restricted role. The nil
    // profile cannot own school data, but PostgreSQL still resolves every operator
    // and validates source permissions. Mock-only tests cannot catch date/interval
    // parameter inference failures. The entire transaction is explicitly read-only.
    const dashboard = new DashboardService({ client: tx });
    const next = await dashboard.nextLesson('00000000-0000-4000-8000-000000000000', new Date());
    if (next.length !== 0) throw new Error('Dashboard empty-scope projection failed');
  });
  console.log('Student runtime profile/security permissions verified (read-only)');
  console.log('Student current-lesson SQL projection verified (read-only, empty own scope)');
} catch {
  throw new Error('Student runtime profile/security/dashboard SQL check failed');
} finally {
  await db.$disconnect();
}
