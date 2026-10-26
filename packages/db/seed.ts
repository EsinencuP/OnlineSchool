// Synthetic QA data only. No passwords, usable passkeys or real personal data.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createDirectClient, Prisma } from '@online-school/db';
import type { PrismaClient, StaffAccount, TeacherAccount } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { qaTarget } from './scripts/database-targets.js';

// RFC 4122 UUIDv5 mapping preserves the project's UUID PK convention.
export function qaId(label: string): string {
  const namespace = Buffer.from('7dd1f34bb4b94d948dc95bdc56c7c541', 'hex');
  const bytes = createHash('sha1')
    .update(namespace)
    .update(`online-school/qa/v1/${label}`)
    .digest();
  bytes[6] = ((bytes[6] ?? 0) & 15) | 80;
  bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const QA = {
  director: qaId('seed-director-001'),
  managers: [qaId('seed-manager-001'), qaId('seed-manager-002')],
  teachers: [qaId('seed-teacher-001'), qaId('seed-teacher-002')],
  students: [qaId('seed-student-001'), qaId('seed-student-002'), qaId('seed-student-003')],
  subject: qaId('subject-math'),
  subscription: qaId('subscription-001'),
  grant: qaId('grant-001'),
  consumption: qaId('consumption-001'),
  ledger: qaId('ledger-001'),
  lessons: [qaId('lesson-scheduled'), qaId('lesson-conducted'), qaId('lesson-cancelled')],
} as const;

const date = (value: string): Date => new Date(value);
const effective = date('2026-10-01T00:00:00Z');
const money = (value: string): Prisma.Decimal => new Prisma.Decimal(value);
const command = (label: string) => ({
  id: qaId(label),
  source_operation_id: qaId(`${label}/operation`),
});
async function once<T>(find: () => Promise<T | null>, create: () => Promise<T>): Promise<T> {
  return (await find()) ?? create();
}
export type QASeedError = { code: string };

export async function seedQA(
  client: PrismaClient,
): Promise<Result<{ profile: 'qa-v1' }, QASeedError>> {
  try {
    return await client.$transaction(
      async (tx): Promise<Result<{ profile: 'qa-v1' }, QASeedError>> => {
        await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(732941005)`;
        const employees = [
          { label: 'seed-director-001', id: QA.director, role: 'DIRECTOR' as const },
          { label: 'seed-manager-001', id: QA.managers[0], role: 'MANAGER' as const },
          { label: 'seed-manager-002', id: QA.managers[1], role: 'MANAGER' as const },
          { label: 'seed-teacher-001', id: QA.teachers[0], role: 'TEACHER' as const },
          { label: 'seed-teacher-002', id: QA.teachers[1], role: 'TEACHER' as const },
        ];
        const expectedLogins = new Map(
          employees.map((person) => [
            qaId(`${person.label}/auth`),
            `${person.label}@online-school.invalid`,
          ]),
        );
        for (const existing of await tx.authAccount.findMany({
          where: { id: { in: [...expectedLogins.keys()] } },
        })) {
          if (existing.login_id !== expectedLogins.get(existing.id))
            return err({ code: 'QA_ID_COLLISION' });
        }
        for (const code of [
          'DIRECTOR',
          'MANAGER',
          'TEACHER',
          'STUDENT',
          'TECH_OPERATOR',
        ] as const) {
          await tx.$executeRaw`INSERT INTO roles(id,code) VALUES(gen_random_uuid(),${code}::"RoleCode") ON CONFLICT(code) DO NOTHING`;
        }
        const staff: StaffAccount[] = [];
        const teachers: TeacherAccount[] = [];
        for (const person of employees) {
          const authId = qaId(`${person.label}/auth`);
          const account = await once(
            () => tx.authAccount.findUnique({ where: { id: authId } }),
            () =>
              tx.authAccount.create({
                data: {
                  id: authId,
                  kind: person.role === 'TEACHER' ? 'TEACHER' : 'STAFF',
                  login_id: `${person.label}@online-school.invalid`,
                },
              }),
          );
          if (person.role === 'TEACHER') {
            teachers.push(
              await once(
                () => tx.teacherAccount.findUnique({ where: { id: person.id } }),
                () =>
                  tx.teacherAccount.create({
                    data: {
                      id: person.id,
                      account_id: account.id,
                      full_name: `QA Synthetic ${person.label}`,
                    },
                  }),
              ),
            );
          } else {
            staff.push(
              await once(
                () => tx.staffAccount.findUnique({ where: { id: person.id } }),
                () =>
                  tx.staffAccount.create({
                    data: {
                      id: person.id,
                      account_id: account.id,
                      full_name: `QA Synthetic ${person.label}`,
                    },
                  }),
              ),
            );
            const credentialId = qaId(`${person.label}/webauthn`);
            await once(
              () => tx.webAuthnCredential.findUnique({ where: { id: credentialId } }),
              () =>
                tx.webAuthnCredential.create({
                  data: {
                    id: credentialId,
                    account_id: account.id,
                    aaguid: '00000000-0000-0000-0000-000000000000',
                    credential_id: Buffer.from(`QA_PLACEHOLDER:${authId}`),
                    public_key: Buffer.from('QA_ONLY_NOT_A_VALID_COSE_KEY'),
                    sign_count: 0n,
                    transports: ['internal'],
                    revoked_at: effective,
                  },
                }),
            );
          }
          const role = await tx.role.findUniqueOrThrow({ where: { code: person.role } });
          const assignmentId = qaId(`${person.label}/role`);
          await once(
            () => tx.roleAssignment.findUnique({ where: { id: assignmentId } }),
            () =>
              tx.roleAssignment.create({
                data: {
                  id: assignmentId,
                  account_id: account.id,
                  role_id: role.id,
                  valid_from: effective,
                },
              }),
          );
        }
        const directorId = QA.director;
        const managerId = QA.managers[0];
        const teacherId = QA.teachers[0];
        await once(
          () => tx.subject.findUnique({ where: { id: QA.subject } }),
          () =>
            tx.subject.create({
              data: { id: QA.subject, code: 'QA-MATH', name: 'Математика — QA' },
            }),
        );
        for (const [index, studentId] of QA.students.entries()) {
          await once(
            () => tx.student.findUnique({ where: { id: studentId } }),
            () =>
              tx.student.create({
                data: { id: studentId, full_name: `QA Synthetic Student ${index + 1}` },
              }),
          );
          const id = qaId(`enrollment-${index + 1}`);
          await once(
            () => tx.studentSubjectEnrollment.findUnique({ where: { id } }),
            () =>
              tx.studentSubjectEnrollment.create({
                data: {
                  ...command(`enrollment-${index + 1}`),
                  student_id: studentId,
                  subject_id: QA.subject,
                  valid_from: effective,
                },
              }),
          );
        }
        const enrollmentId = qaId('enrollment-1');
        const teachingId = qaId('teaching-001');
        await once(
          () => tx.teachingAssignment.findUnique({ where: { id: teachingId } }),
          () =>
            tx.teachingAssignment.create({
              data: {
                ...command('teaching-001'),
                enrollment_id: enrollmentId,
                teacher_id: teacherId,
                valid_from: effective,
                basis: 'Synthetic QA assignment',
                assigned_by_id: managerId,
              },
            }),
        );
        const slotId = qaId('recurring-slot-001');
        await once(
          () => tx.recurringSlot.findUnique({ where: { id: slotId } }),
          () =>
            tx.recurringSlot.create({
              data: {
                ...command('recurring-slot-001'),
                enrollment_id: enrollmentId,
                teaching_assignment_id: teachingId,
                rule: 'FREQ=WEEKLY;BYDAY=FR;BYHOUR=15;BYMINUTE=0',
                timezone: 'Europe/Chisinau',
                active_from: effective,
                active_until: date('2026-12-01T00:00:00Z'),
                duration_min: 60,
              },
            }),
        );
        const saleId = qaId('sale-001');
        await once(
          () => tx.saleCondition.findUnique({ where: { id: saleId } }),
          () =>
            tx.saleCondition.create({
              data: {
                ...command('sale-001'),
                code: 'QA-SYNTHETIC-2-LESSONS',
                version: 1,
                lesson_count: 2,
                list_price: money('100'),
                discount_amount: money('0'),
                price: money('100'),
                lesson_unit_price: money('50'),
                currency: 'MDL',
                valid_from: effective,
              },
            }),
        );
        await once(
          () => tx.subscription.findUnique({ where: { id: QA.subscription } }),
          () =>
            tx.subscription.create({
              data: {
                ...command('subscription-001'),
                enrollment_id: enrollmentId,
                sale_condition_id: saleId,
                lesson_count: 2,
                full_price: money('100'),
                initial_discount_amount: money('0'),
                original_paid_unit_price: money('50'),
                currency: 'MDL',
                valid_from: effective,
              },
            }),
        );
        const paymentId = qaId('payment-001');
        await once(
          () => tx.paymentReceipt.findUnique({ where: { id: paymentId } }),
          () =>
            tx.paymentReceipt.create({
              data: {
                ...command('payment-001'),
                amount: money('100'),
                currency: 'MDL',
                registered_by_manager_id: managerId,
                registered_at: date('2026-10-01T12:00:00Z'),
                confirmed_by_director_id: directorId,
                confirmed_by_director_at: date('2026-10-01T12:05:00Z'),
                confirmation_operation_id: qaId('payment-confirmation-001'),
                provider: 'qa-synthetic',
                external_reference: 'QA-NO-REAL-PAYMENT-001',
              },
            }),
        );
        const distributionId = qaId('distribution-001');
        await once(
          () => tx.paymentDistribution.findUnique({ where: { id: distributionId } }),
          () =>
            tx.paymentDistribution.create({
              data: {
                ...command('distribution-001'),
                payment_id: paymentId,
                subscription_id: QA.subscription,
                amount: money('100'),
                currency: 'MDL',
                approved_by_director_id: directorId,
                approved_at: date('2026-10-01T12:10:00Z'),
                approval_operation_id: qaId('distribution-approval-001'),
              },
            }),
        );
        await once(
          () => tx.entitlementGrant.findUnique({ where: { id: QA.grant } }),
          () =>
            tx.entitlementGrant.create({
              data: {
                ...command('grant-001'),
                subscription_id: QA.subscription,
                payment_distribution_id: distributionId,
                quantity: 2,
                basis: 'CONFIRMED_PAYMENT',
                granted_at: date('2026-10-01T12:15:00Z'),
                authorized_by_id: directorId,
              },
            }),
        );
        const studentAuthId = qaId('seed-student-001/auth');
        await once(
          () => tx.authAccount.findUnique({ where: { id: studentAuthId } }),
          () =>
            tx.authAccount.create({
              data: {
                id: studentAuthId,
                kind: 'STUDENT',
                login_id: 'seed-student-001@online-school.invalid',
              },
            }),
        );
        const studentRole = await tx.role.findUniqueOrThrow({ where: { code: 'STUDENT' } });
        const studentRoleId = qaId('seed-student-001/role');
        await once(
          () => tx.roleAssignment.findUnique({ where: { id: studentRoleId } }),
          () =>
            tx.roleAssignment.create({
              data: {
                id: studentRoleId,
                account_id: studentAuthId,
                role_id: studentRole.id,
                valid_from: date('2026-10-01T13:00:00Z'),
              },
            }),
        );
        const studentAccountId = qaId('seed-student-001/account');
        await once(
          () => tx.studentAccount.findUnique({ where: { id: studentAccountId } }),
          () =>
            tx.studentAccount.create({
              data: {
                id: studentAccountId,
                student_id: QA.students[0],
                account_id: studentAuthId,
                activation_basis: 'FULL_PAYMENT',
                activation_subscription_id: QA.subscription,
                activation_payment_confirmation_id: paymentId,
                activation_confirmed_by_staff_id: directorId,
                activated_at: date('2026-10-01T13:00:00Z'),
              },
            }),
        );
        const period =
          (await tx.financialPeriod.findFirst({
            where: {
              starts_at: { lte: effective },
              ends_at: { gt: date('2026-11-06T14:00:00Z') },
              closed_at: null,
            },
          })) ??
          (await tx.financialPeriod.create({
            data: {
              ...command('period-001'),
              starts_at: effective,
              ends_at: date('2026-12-01T00:00:00Z'),
            },
          }));
        const lessons = [
          {
            label: 'lesson-scheduled',
            status: 'SCHEDULED' as const,
            start: '2026-11-06T13:00:00Z',
            end: '2026-11-06T14:00:00Z',
          },
          {
            label: 'lesson-conducted',
            status: 'CONDUCTED' as const,
            start: '2026-10-02T12:00:00Z',
            end: '2026-10-02T13:00:00Z',
          },
          {
            label: 'lesson-cancelled',
            status: 'CANCELLED' as const,
            start: '2026-10-09T12:00:00Z',
            end: '2026-10-09T13:00:00Z',
          },
        ];
        for (const lesson of lessons) {
          const id = qaId(lesson.label);
          await once(
            () => tx.lessonOccurrence.findUnique({ where: { id } }),
            () =>
              tx.lessonOccurrence.create({
                data: {
                  ...command(lesson.label),
                  enrollment_id: enrollmentId,
                  teaching_assignment_id: teachingId,
                  recurring_slot_id: slotId,
                  scheduled_teacher_id: teacherId,
                  original_scheduled_at: date(lesson.start),
                  // Synthetic fixtures start at noon UTC, on the same Chisinau date.
                  occurrence_date: date(lesson.start.slice(0, 10) + 'T00:00:00Z'),
                  scheduled_at: date(lesson.start),
                  scheduled_end_at: date(lesson.end),
                  status: lesson.status,
                  ...(lesson.status === 'CONDUCTED'
                    ? {
                        actual_start_at: date(lesson.start),
                        actual_teacher_at_start_id: teacherId,
                        rate_at_start_snapshot: money('200'),
                        points_at_start_snapshot: 0,
                        rate_basis_at_start: 'ORDINARY_POINTS' as const,
                        rate_currency_at_start: 'MDL',
                      }
                    : {}),
                },
              }),
          );
        }
        const outcomeId = qaId('outcome-001');
        await once(
          () => tx.lessonActualOutcome.findUnique({ where: { id: outcomeId } }),
          () =>
            tx.lessonActualOutcome.create({
              data: {
                ...command('outcome-001'),
                lesson_occurrence_id: qaId('lesson-conducted'),
                actual_teacher_id: teacherId,
                actual_started_at: date('2026-10-02T12:00:00Z'),
                duration_min: 60,
                confirmed_at: date('2026-10-02T13:00:00Z'),
                confirmed_by_id: directorId,
                rate_snapshot: money('200'),
                points_snapshot: 0,
                rate_basis: 'ORDINARY_POINTS',
                currency: 'MDL',
                basis: 'Synthetic QA start snapshot',
              },
            }),
        );
        await once(
          () => tx.entitlementConsumption.findUnique({ where: { id: QA.consumption } }),
          () =>
            tx.entitlementConsumption.create({
              data: {
                ...command('consumption-001'),
                grant_id: QA.grant,
                subscription_id: QA.subscription,
                lesson_occurrence_id: qaId('lesson-conducted'),
                quantity: 1,
                basis: 'CONFIRMED_LESSON',
                reason: 'Synthetic QA confirmed lesson',
                authorized_by_id: directorId,
                consumed_at: date('2026-10-02T13:05:00Z'),
              },
            }),
        );
        const documentId = qaId('ledger-document-001');
        await once(
          () => tx.ledgerDocument.findUnique({ where: { id: documentId } }),
          () =>
            tx.ledgerDocument.create({
              data: {
                ...command('ledger-document-001'),
                payment_id: paymentId,
                basis: 'Synthetic QA payment receipt',
              },
            }),
        );
        const entry = await once(
          () => tx.ledgerEntry.findUnique({ where: { id: QA.ledger } }),
          () =>
            tx.ledgerEntry.create({
              data: {
                ...command('ledger-001'),
                document_id: documentId,
                financial_period_id: period.id,
                currency: 'MDL',
                effective_at: date('2026-10-01T12:05:00Z'),
              },
            }),
        );
        for (const [position, direction] of [
          [1, 'DEBIT'],
          [2, 'CREDIT'],
        ] as const) {
          const id = qaId(`ledger-line-${position}`);
          await once(
            () => tx.ledgerLine.findUnique({ where: { id } }),
            () =>
              tx.ledgerLine.create({
                data: {
                  id,
                  entry_id: QA.ledger,
                  position,
                  direction,
                  account_type: direction === 'DEBIT' ? 'CASH' : 'CUSTOMER_ADVANCE',
                  amount: money('100'),
                  currency: 'MDL',
                },
              }),
          );
        }
        const publication = qaId('ledger-publication-001');
        if (!entry.published_at)
          await tx.ledgerEntry.update({
            where: { id: QA.ledger },
            data: {
              balanced_at: date('2026-10-01T12:20:00Z'),
              published_at: date('2026-10-01T12:20:00Z'),
              published_by_id: directorId,
              publication_operation_id: publication,
              balance_snapshot: { MDL: { debit: '100.0000', credit: '100.0000' } },
            },
          });
        const auditId = qaId('audit-001');
        await once(
          () => tx.auditEvent.findUnique({ where: { id: auditId } }),
          () =>
            tx.auditEvent.create({
              data: {
                id: auditId,
                actor_kind: 'SYSTEM',
                system_actor_ref: 'qa-seed-v1',
                action: 'qa.fixture.ledger',
                resource_type: 'LedgerEntry',
                resource_id: QA.ledger,
                result: 'SUCCESS',
                request_id: publication,
                source_operation_id: publication,
                event_key: 'qa-v1:ledger',
                metadata: { synthetic: true },
              },
            }),
        );
        const outboxId = qaId('outbox-001');
        await once(
          () => tx.outboxEvent.findUnique({ where: { id: outboxId } }),
          () =>
            tx.outboxEvent.create({
              data: {
                id: outboxId,
                topic: 'qa.fixture.ledger.v1',
                aggregate_type: 'LedgerEntry',
                aggregate_id: QA.ledger,
                source_operation_id: publication,
                audit_event_id: auditId,
                event_key: 'qa-v1:ledger',
                payload: { synthetic: true, entryId: QA.ledger },
              },
            }),
        );
        return ok({ profile: 'qa-v1' });
      },
      { timeout: 30_000 },
    );
  } catch {
    return err({ code: 'QA_SEED_FAILED' });
  }
}

async function main(): Promise<void> {
  const target = qaTarget();
  if (!target.ok) {
    console.error(target.error.code);
    process.exitCode = 1;
    return;
  }
  const connection = createDirectClient({ DIRECT_URL: target.value.url });
  if (!connection.ok) {
    console.error(connection.error.code);
    process.exitCode = 1;
    return;
  }
  try {
    const result = await seedQA(connection.value);
    if (!result.ok) {
      console.error(result.error.code);
      process.exitCode = 1;
      return;
    }
    console.log('QA seed qa-v1: 1 director, 2 managers, 2 teachers, 3 students; fixtures present.');
  } finally {
    await connection.value.$disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => {
    console.error('QA_SEED_INITIALIZATION_FAILED');
    process.exitCode = 1;
  });
}
