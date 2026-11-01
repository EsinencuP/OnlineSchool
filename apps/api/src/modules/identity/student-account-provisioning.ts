import { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../core/errors/domain-error.js';
import { databaseError } from '../../core/errors/database-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import { studentActivationSql } from '../finance/student-activation.sql.js';
import type { StudentActivationEvidence } from '../finance/student-activation.sql.js';
import type { Passwords } from './passwords.js';

type Tx = Prisma.TransactionClient;
export type StudentIdentityCommand = {
  studentId: string;
  actorAccountId: string;
  actorStaffId: string;
  loginEmail?: string;
};
export type IssuedStudentIdentity = {
  accountId: string;
  loginEmail: string;
  temporaryPassword: string;
  temporaryPasswordExpiresAt: string;
};
type Revoke = (
  tx: Tx,
  accountId: string,
  actorId: string | null,
  reason: string,
  all: boolean,
) => Promise<void>;
function failure(error: unknown): DomainError {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = JSON.stringify(error.meta ?? {});
    return domainError(
      /login_id|auth.*login/i.test(target) ? 'EMAIL_ALREADY_USED' : 'ACCOUNT_ALREADY_EXISTS',
      409,
    );
  }
  return databaseError(error);
}
async function lockStudent(tx: Tx, id: string): Promise<Result<void, DomainError>> {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM students WHERE id=${id}::uuid AND archived_at IS NULL FOR UPDATE`;
  if (!rows.length) return err(domainError('STUDENT_NOT_FOUND', 404));
  // A real write forces SERIALIZABLE waiters to retry with a new snapshot. CRM version is unchanged.
  await tx.student.update({ where: { id }, data: { updated_at: new Date() } });
  return ok(undefined);
}
export async function createStudentIdentity(
  tx: Tx,
  input: StudentIdentityCommand,
  passwords: Passwords,
): Promise<Result<IssuedStudentIdentity, DomainError>> {
  try {
    const locked = await lockStudent(tx, input.studentId);
    if (!locked.ok) return locked;
    if (
      await tx.studentAccount.findFirst({
        where: { student_id: input.studentId, deactivated_at: null },
        select: { id: true },
      })
    )
      return err(domainError('ACCOUNT_ALREADY_EXISTS', 409));
    const login = input.loginEmail!.trim().toLowerCase();
    if (await tx.authAccount.findUnique({ where: { login_id: login }, select: { id: true } }))
      return err(domainError('EMAIL_ALREADY_USED', 409));
    const at = (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
    const [evidence] = await tx.$queryRaw<StudentActivationEvidence[]>(
      studentActivationSql(input.studentId, at),
    );
    if (!evidence) return err(domainError('FIRST_PAYMENT_NOT_CONFIRMED', 409));
    const role = await tx.role.findUnique({ where: { code: 'STUDENT' }, select: { id: true } });
    if (!role) return err(domainError('IDENTITY_CONFIGURATION_INVALID', 503));
    const secret = await passwords.temporary();
    if (!secret.ok) return secret;
    const issuedAt = (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
    const expiresAt = new Date(issuedAt.getTime() + 72 * 3600000);
    const account = await tx.authAccount.create({
      data: { kind: 'STUDENT', login_id: login, password_hash: secret.value.hash },
    });
    await tx.studentAccount.create({
      data: {
        student_id: input.studentId,
        account_id: account.id,
        activation_basis: evidence.basis,
        activation_subscription_id: evidence.subscription_id,
        activation_payment_confirmation_id: evidence.payment_id,
        activation_distribution_id: evidence.distribution_id,
        activation_director_admission_id: evidence.admission_id,
        activation_confirmed_by_staff_id: evidence.director_id,
        activated_at: issuedAt,
        must_change_password: true,
        temporary_password_issued_at: issuedAt,
        temporary_password_expires_at: expiresAt,
      },
    });
    await tx.roleAssignment.create({
      data: {
        account_id: account.id,
        role_id: role.id,
        assigned_by_staff_id: input.actorStaffId,
        valid_from: issuedAt,
      },
    });
    return ok({
      accountId: account.id,
      loginEmail: login,
      temporaryPassword: secret.value.plaintext,
      temporaryPasswordExpiresAt: expiresAt.toISOString(),
    });
  } catch (error: unknown) {
    return err(failure(error));
  }
}
export async function resetStudentIdentity(
  tx: Tx,
  input: StudentIdentityCommand,
  passwords: Passwords,
  revoke: Revoke,
): Promise<Result<IssuedStudentIdentity, DomainError>> {
  try {
    const locked = await lockStudent(tx, input.studentId);
    if (!locked.ok) return locked;
    const profile = await tx.studentAccount.findFirst({
      where: { student_id: input.studentId, deactivated_at: null },
      include: { account: true },
    });
    if (!profile || profile.account.disabled_at) return err(domainError('ACCOUNT_NOT_FOUND', 404));
    const at = (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
    const count = await tx.auditEvent.count({
      where: {
        resource_type: 'Student',
        resource_id: input.studentId,
        action: 'STUDENT_PASSWORD_RESET',
        result: 'SUCCESS',
        recorded_at: { gt: new Date(at.getTime() - 24 * 3600000) },
      },
    });
    if (count >= 3) return err(domainError('RESET_LIMIT_EXCEEDED', 429));
    const secret = await passwords.temporary();
    if (!secret.ok) return secret;
    const issuedAt = (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
    const expiresAt = new Date(issuedAt.getTime() + 72 * 3600000);
    await revoke(tx, profile.account_id, input.actorAccountId, 'MANAGER_PASSWORD_RESET', true);
    await tx.webAuthnCredential.updateMany({
      where: { account_id: profile.account_id, revoked_at: null },
      data: { revoked_at: issuedAt },
    });
    await tx.mfaChallenge.updateMany({
      where: { account_id: profile.account_id, used_at: null, expires_at: { gt: issuedAt } },
      data: { used_at: issuedAt },
    });
    await tx.studentEmailChange.updateMany({
      where: { account_id: profile.account_id, used_at: null, revoked_at: null },
      data: { revoked_at: issuedAt },
    });
    await tx.authAccount.update({
      where: { id: profile.account_id },
      data: { password_hash: secret.value.hash },
    });
    await tx.studentAccount.update({
      where: { id: profile.id },
      data: {
        must_change_password: true,
        temporary_password_issued_at: issuedAt,
        temporary_password_expires_at: expiresAt,
      },
    });
    return ok({
      accountId: profile.account_id,
      loginEmail: profile.account.login_id,
      temporaryPassword: secret.value.plaintext,
      temporaryPasswordExpiresAt: expiresAt.toISOString(),
    });
  } catch (error: unknown) {
    return err(failure(error));
  }
}
