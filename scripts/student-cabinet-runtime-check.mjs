// Read-only check using the actual restricted runtime role, after migrations.
import { createPoolClient } from '../packages/db/dist/index.js';
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
      has_column_privilege(current_user,'students','avatar_file_id','UPDATE') AS avatar`;
    if (!Object.values(permissions).every(Boolean))
      throw new Error('Student runtime permissions incomplete');
  });
  console.log('Student runtime profile/security permissions verified (read-only)');
} catch {
  throw new Error('Student runtime profile/security permission check failed');
} finally {
  await db.$disconnect();
}
