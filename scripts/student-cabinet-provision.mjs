// Owner-approved, additive TEST data. Runs only in a short-lived protected Vercel build.
import { createHash } from 'node:crypto';
import { createDirectClient } from '../packages/db/dist/index.js';
import {
  DirectorLedgerPublicationPolicy,
  LedgerPublicationService,
} from '../apps/api/dist/modules/finance/ledger-publication.service.js';

const marker = 'OWNER-DEMO-NO-REAL-PAYMENT';
const email = 'themrack26@gmail.com';
const until = Number(process.env.STUDENT_TEST_PROVISION_UNTIL);
const approved =
  process.env.VERCEL_PROJECT_ID === 'prj_XusYmdwL1Y0478T09RNKmBQMldgZ' &&
  process.env.STUDENT_TEST_APPROVED_DATA === `${marker}:120-MDL:6-LESSONS` &&
  Number.isSafeInteger(until) &&
  until > Date.now() &&
  until <= Date.now() + 30 * 60_000;
const id = (label) => {
  const b = createHash('sha256')
    .update(`owner-demo-stu12:${email}:${label}`)
    .digest()
    .subarray(0, 16);
  b[6] = (b[6] & 15) | 80;
  b[8] = (b[8] & 63) | 128;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const op = (label) => id(`operation:${label}`);
let step = 'guard';
if (!approved) console.log('Student TEST provisioning skipped: no live scoped owner approval');
else {
  const hash = process.env.STUDENT_TEST_PASSWORD_HASH;
  if (!/^\$scrypt\$v=1\$N=131072,r=8,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/.test(hash ?? ''))
    throw new Error('TEST password hash missing');
  const connection = createDirectClient();
  if (!connection.ok) throw new Error('TEST connection unavailable');
  const db = connection.value;
  try {
    const result = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(120061230)`;
        const existing = await tx.authAccount.findUnique({ where: { login_id: email } });
        if (existing) {
          const profile = await tx.studentAccount.findFirst({
            where: { account_id: existing.id, student_id: id('student'), deactivated_at: null },
          });
          if (existing.id !== id('account') || !profile) throw new Error('TEST_LOGIN_COLLISION');
          return {
            status: 'already-provisioned',
            studentId: id('student'),
            homeworkId: id('delivery'),
          };
        }
        step = 'director';
        const directorId = 'b8395155-fab4-45aa-bf26-ba95f6f1abb8';
        const policy = new DirectorLedgerPublicationPolicy();
        if (!(await policy.authorize(tx, directorId)).ok) throw new Error('DIRECTOR_UNAVAILABLE');
        const [{ now }] = await tx.$queryRaw`SELECT clock_timestamp() AS now`;
        const later = (days) => new Date(now.getTime() + days * 86400_000);
        const source = (label) => ({ id: id(label), source_operation_id: op(label) });
        step = 'identities';
        await tx.student.create({
          data: { id: id('student'), full_name: '[TEST] Кабинет владельца', email },
        });
        await tx.authAccount.create({
          data: { id: id('account'), kind: 'STUDENT', login_id: email, password_hash: hash },
        });
        await tx.authAccount.create({
          data: {
            id: id('teacher-account'),
            kind: 'TEACHER',
            login_id: 'owner-demo-stu12-teacher@online-school.invalid',
          },
        });
        for (const [code, account] of [
          ['STUDENT', 'account'],
          ['TEACHER', 'teacher-account'],
        ]) {
          const role = await tx.role.findUniqueOrThrow({ where: { code } });
          await tx.roleAssignment.create({
            data: {
              id: id(`role-${code}`),
              account_id: id(account),
              role_id: role.id,
              assigned_by_staff_id: directorId,
              valid_from: now,
            },
          });
        }
        await tx.teacherAccount.create({
          data: {
            id: id('teacher'),
            account_id: id('teacher-account'),
            full_name: '[TEST] Преподаватель',
          },
        });
        await tx.assignedManager.create({
          data: {
            id: id('manager'),
            student_id: id('student'),
            manager_id: directorId,
            assigned_at: now,
          },
        });
        await tx.subject.create({
          data: { id: id('subject'), code: 'OWNER-DEMO-STU12', name: '[TEST] Английский язык' },
        });
        await tx.studentSubjectEnrollment.create({
          data: {
            ...source('enrollment'),
            student_id: id('student'),
            subject_id: id('subject'),
            valid_from: now,
          },
        });
        await tx.teachingAssignment.create({
          data: {
            ...source('teaching'),
            enrollment_id: id('enrollment'),
            teacher_id: id('teacher'),
            valid_from: now,
            basis: marker,
            assigned_by_id: directorId,
          },
        });
        step = 'subscription';
        await tx.saleCondition.create({
          data: {
            ...source('sale'),
            code: '[TEST] STU12 — 6 занятий',
            version: 1,
            lesson_count: 6,
            list_price: '120',
            discount_amount: '0',
            price: '120',
            lesson_unit_price: '20',
            currency: 'MDL',
            valid_from: now,
          },
        });
        await tx.subscription.create({
          data: {
            ...source('subscription'),
            enrollment_id: id('enrollment'),
            sale_condition_id: id('sale'),
            lesson_count: 6,
            full_price: '120',
            initial_discount_amount: '0',
            original_paid_unit_price: '20',
            currency: 'MDL',
            valid_from: now,
            valid_to: later(30),
          },
        });
        step = 'payment';
        await tx.paymentReceipt.create({
          data: {
            ...source('payment'),
            student_id: id('student'),
            amount: '120',
            currency: 'MDL',
            registered_by_manager_id: directorId,
            registered_at: now,
            confirmed_by_director_id: directorId,
            confirmed_by_director_at: now,
            confirmation_operation_id: op('confirm-payment'),
            provider: 'owner-demo',
            external_reference: `${marker}-STU12`,
          },
        });
        await tx.paymentDistribution.create({
          data: {
            ...source('distribution'),
            payment_id: id('payment'),
            subscription_id: id('subscription'),
            amount: '120',
            currency: 'MDL',
            approved_by_director_id: directorId,
            approved_at: now,
            approval_operation_id: op('approve-distribution'),
          },
        });
        step = 'ledger';
        let period = await tx.financialPeriod.findFirst({
          where: { starts_at: { lte: now }, ends_at: { gt: now } },
        });
        if (period?.closed_at) throw new Error('FINANCIAL_PERIOD_CLOSED');
        if (!period) {
          const start = new Date(now);
          start.setUTCHours(0, 0, 0, 0);
          period = await tx.financialPeriod.create({
            data: {
              ...source('period'),
              starts_at: start,
              ends_at: new Date(start.getTime() + 86400_000),
            },
          });
        }
        const publisher = new LedgerPublicationService(policy);
        for (const [kind, debit, credit] of [
          ['payment', 'CASH', 'UNALLOCATED_FUNDS'],
          ['distribution', 'UNALLOCATED_FUNDS', 'CUSTOMER_ADVANCE'],
        ]) {
          await tx.ledgerDocument.create({
            data: { ...source(`${kind}-document`), [`${kind}_id`]: id(kind), basis: marker },
          });
          await tx.ledgerEntry.create({
            data: {
              ...source(`${kind}-entry`),
              document_id: id(`${kind}-document`),
              financial_period_id: period.id,
              currency: 'MDL',
              effective_at: now,
            },
          });
          for (const [index, account_type, direction] of [
            [1, debit, 'DEBIT'],
            [2, credit, 'CREDIT'],
          ])
            await tx.ledgerLine.create({
              data: {
                id: id(`${kind}-line-${index}`),
                entry_id: id(`${kind}-entry`),
                position: index,
                account_type,
                direction,
                amount: '120',
                currency: 'MDL',
              },
            });
          const published = await publisher.publishInTransaction(tx, {
            entryId: id(`${kind}-entry`),
            actorStaffId: directorId,
            operationId: op(`${kind}-publication`),
          });
          if (!published.ok) throw new Error(`PUBLICATION_${published.error.code}`);
        }
        step = 'access';
        await tx.entitlementGrant.create({
          data: {
            ...source('grant'),
            subscription_id: id('subscription'),
            payment_distribution_id: id('distribution'),
            quantity: 6,
            basis: 'CONFIRMED_PAYMENT',
            granted_at: now,
            authorized_by_id: directorId,
          },
        });
        await tx.studentAccount.create({
          data: {
            id: id('profile'),
            student_id: id('student'),
            account_id: id('account'),
            activation_basis: 'FULL_PAYMENT',
            activation_subscription_id: id('subscription'),
            activation_payment_confirmation_id: id('payment'),
            activation_confirmed_by_staff_id: directorId,
            activated_at: now,
            must_change_password: true,
            timezone: 'Europe/Chisinau',
          },
        });
        step = 'education';
        for (const [index, days] of [
          [1, 1],
          [2, 3],
          [3, 6],
        ]) {
          const at = later(days);
          await tx.lessonOccurrence.create({
            data: {
              ...source(`lesson-${index}`),
              enrollment_id: id('enrollment'),
              teaching_assignment_id: id('teaching'),
              scheduled_teacher_id: id('teacher'),
              original_scheduled_at: at,
              scheduled_at: at,
              scheduled_end_at: new Date(at.getTime() + 50 * 60_000),
            },
          });
        }
        await tx.homeworkAssignment.create({
          data: {
            ...source('homework'),
            subject_id: id('subject'),
            issued_by: id('teacher'),
            title: '[TEST] Проверка домашнего задания',
            content: {
              text: 'Напишите несколько предложений о себе. Сохраните черновик, приложите тестовый файл и отправьте работу.',
            },
            due_at: later(7),
          },
        });
        await tx.homeworkDelivery.create({
          data: {
            ...source('delivery'),
            assignment_id: id('homework'),
            enrollment_id: id('enrollment'),
            issued_by: id('teacher'),
            issued_at: now,
            due_at: later(7),
          },
        });
        const labels = ['Знакомство', 'Чтение', 'Разговорная практика', 'Письмо'];
        const levels = ['INTRODUCING', 'PRACTICING', 'APPLYING'];
        for (let i = 0; i < 4; i++) {
          await tx.skillEntry.create({
            data: {
              ...source(`skill-${i}`),
              subject_id: id('subject'),
              student_id: id('student'),
              code: `TEST-${i + 1}`,
              label: labels[i],
              category: '[TEST] Основы',
            },
          });
          if (i < 3)
            await tx.skillAssessment.create({
              data: {
                ...source(`assessment-${i}`),
                skill_id: id(`skill-${i}`),
                enrollment_id: id('enrollment'),
                assessed_by: id('teacher'),
                assessed_at: now,
                level: levels[i],
                version: 1,
                basis: marker,
                public_comment: '[TEST] Демонстрационная оценка навыка',
              },
            });
        }
        await tx.learningGoal.create({
          data: {
            id: id('goal'),
            enrollment_id: id('enrollment'),
            text: '[TEST] Проверить карту навыков',
            target_date: later(30),
            created_by: id('teacher'),
            updated_by: id('teacher'),
          },
        });
        step = 'audit';
        for (const [action, resourceType, label] of [
          ['finance.payment.confirmed', 'PaymentReceipt', 'payment'],
          ['finance.distribution.approved', 'PaymentDistribution', 'distribution'],
          ['owner.student-test.provisioned', 'Student', 'student'],
        ]) {
          await tx.auditEvent.create({
            data: {
              id: id(`audit-${label}`),
              actor_kind: 'SYSTEM',
              system_actor_ref: 'owner-approved-student-demo',
              action,
              resource_type: resourceType,
              resource_id: id(label),
              result: 'SUCCESS',
              request_id: id('request'),
              source_operation_id: op(label),
              event_key: `${marker}:${label}`,
              metadata: {
                ownerApproved: true,
                noRealPayment: true,
                amount: '120',
                currency: 'MDL',
                lessons: 6,
              },
            },
          });
        }
        await tx.outboxEvent.create({
          data: {
            id: id('payment-event'),
            topic: 'finance.payment.confirmed.v1',
            aggregate_type: 'PaymentReceipt',
            aggregate_id: id('payment'),
            source_operation_id: op('payment'),
            audit_event_id: id('audit-payment'),
            event_key: `${marker}:payment`,
            payload: {
              schemaVersion: 1,
              resourceId: id('payment'),
              studentId: id('student'),
              noRealPayment: true,
            },
          },
        });
        return {
          status: 'created',
          studentId: id('student'),
          homeworkId: id('delivery'),
          lessons: 3,
          rights: 6,
          demoAmount: '120 MDL',
          noRealPayment: true,
        };
      },
      { isolationLevel: 'Serializable', timeout: 60_000 },
    );
    console.log('STUDENT_TEST_PROVISION_RESULT ' + JSON.stringify(result));
  } catch (error) {
    // No Prisma stack/query arguments: those may include credentials or the password hash.
    console.error(
      'STUDENT_TEST_PROVISION_FAILED ' +
        JSON.stringify({
          step,
          code: /^P\d{4}$/.test(error?.code ?? '') ? error.code : 'GUARD_OR_DATABASE_ERROR',
          constraint: error?.meta?.database_error?.match(/constraint[ :"']+([a-z0-9_]+)/i)?.[1],
        }),
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
