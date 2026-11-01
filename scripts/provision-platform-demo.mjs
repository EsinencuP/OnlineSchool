// Additive owner-requested demonstration. Never reset data, send email, or fabricate lesson attendance.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createDirectClient } from '../packages/db/dist/index.js';
import {
  accounts,
  pupils,
  marker,
  namespace,
  demoId as id,
  operation as op,
  demoSetupInput,
} from './platform-demo-plan.mjs';

const source = (key) => ({ id: id(key), source_operation_id: op(key) });
const eventKey = (phase) => `${namespace}:${phase}`;
let step = 'guard';
async function transaction(db, work, timeout) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: 'Serializable', timeout });
    } catch (error) {
      if (error?.code !== 'P2034' || attempt === 3) throw error;
    }
  }
}
function need(result, label) {
  if (!result.ok) throw new Error(`PLATFORM_DEMO_${label}_${result.error.code}`);
  return result.value;
}
async function record(tx, phase, metadata) {
  const audit = await tx.auditEvent.create({
    data: {
      id: id(`audit:${phase}`),
      actor_kind: 'SYSTEM',
      system_actor_ref: namespace,
      action: 'owner.demo.provisioned',
      resource_type: 'DemoDataset',
      resource_id: id('dataset'),
      result: 'SUCCESS',
      request_id: id('request'),
      source_operation_id: op(phase),
      event_key: eventKey(phase),
      metadata: { marker, synthetic: true, ...metadata },
    },
  });
  await tx.outboxEvent.create({
    data: {
      id: id(`outbox:${phase}`),
      topic: 'owner.demo.provisioned.v1',
      aggregate_type: 'DemoDataset',
      aggregate_id: id('dataset'),
      audit_event_id: audit.id,
      source_operation_id: op(phase),
      event_key: eventKey(phase),
      payload: { schemaVersion: 1, phase, marker },
    },
  });
}
async function identity(tx, row, directorId, now) {
  // Deliberately create only new namespaced accounts; never reset an existing password.
  if (await tx.authAccount.findUnique({ where: { login_id: row.login } }))
    throw new Error('PLATFORM_DEMO_LOGIN_COLLISION');
  const kind = row.role === 'TEACHER' ? 'TEACHER' : row.role === 'STUDENT' ? 'STUDENT' : 'STAFF';
  await tx.authAccount.create({
    data: { id: id(`account:${row.key}`), kind, login_id: row.login, password_hash: row.hash },
  });
  const role = await tx.role.findUniqueOrThrow({ where: { code: row.role } });
  await tx.roleAssignment.create({
    data: {
      id: id(`role:${row.key}`),
      account_id: id(`account:${row.key}`),
      role_id: role.id,
      assigned_by_staff_id: directorId,
      valid_from: now,
    },
  });
  if (kind === 'STUDENT') return;
  const data = {
    id: id(`profile:${row.key}`),
    account_id: id(`account:${row.key}`),
    full_name: `[ДЕМО] ${row.name}`,
    email: row.login,
  };
  await (kind === 'TEACHER' ? tx.teacherAccount : tx.staffAccount).create({ data });
}
export async function provisionBase(tx, rows) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(120061251)`;
  const completed = await tx.auditEvent.findUnique({ where: { event_key: eventKey('base') } });
  if (completed) return { status: 'already-provisioned', at: completed.recorded_at };
  const [{ now }] = await tx.$queryRaw`SELECT clock_timestamp() AS now`;
  const director = await tx.staffAccount.findFirst({
    where: {
      deactivated_at: null,
      account: {
        disabled_at: null,
        role_assignments: {
          some: {
            role: { code: 'DIRECTOR' },
            valid_from: { lte: now },
            OR: [{ valid_to: null }, { valid_to: { gt: now } }],
          },
        },
      },
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!director) throw new Error('PLATFORM_DEMO_DIRECTOR_UNAVAILABLE');
  step = 'identities';
  for (const account of accounts.filter((a) => a.role !== 'STUDENT'))
    await identity(
      tx,
      { ...account, hash: rows.find((r) => r.key === account.key).hash },
      director.id,
      now,
    );
  // Reserve nothing in AuthAccount for pupils: their credentials are installed only AFTER paid rights exist.
  for (const pupil of pupils) {
    const account = accounts.find((a) => a.key === pupil.key);
    if (await tx.authAccount.findUnique({ where: { login_id: account.login } }))
      throw new Error('PLATFORM_DEMO_LOGIN_COLLISION');
  }
  const { addSchoolDays } =
    await import('../apps/api/dist/modules/finance/manager-subscriptions/time.js');
  const later = (days) => addSchoolDays(now, days, 'Europe/Chisinau');
  step = 'crm';
  for (const pupil of [...pupils, { key: 'oleg' }]) {
    const name = accounts.find((a) => a.key === pupil.key)?.name ?? 'Олег Бондарь';
    await tx.student.create({
      data: {
        id: id(`student:${pupil.key}`),
        full_name: `[ДЕМО] ${name}`,
        display_name: `[ДЕМО] ${name}`,
        manager_note: `${marker}. ${pupil.key === 'oleg' ? 'Свободный ученик: подобрать преподавателя, аккаунта и абонемента пока нет.' : 'Учебный пример; не реальные персональные данные и не реальные деньги.'}`,
      },
    });
    await tx.assignedManager.create({
      data: {
        id: id(`portfolio:${pupil.key}`),
        student_id: id(`student:${pupil.key}`),
        manager_id: id('profile:tamara'),
        assigned_at: now,
      },
    });
  }
  for (const pupil of pupils) {
    await tx.subject.create({
      data: {
        id: id(`subject:${pupil.code}`),
        code: `DEMO-${pupil.code}`,
        name: `[ДЕМО] ${pupil.subject}`,
      },
    });
    await tx.studentSubjectEnrollment.create({
      data: {
        ...source(`enrollment:${pupil.key}`),
        student_id: id(`student:${pupil.key}`),
        subject_id: id(`subject:${pupil.code}`),
        valid_from: now,
      },
    });
    await tx.teachingAssignment.create({
      data: {
        ...source(`teaching:${pupil.key}`),
        enrollment_id: id(`enrollment:${pupil.key}`),
        teacher_id: id(`profile:${pupil.teacher}`),
        assigned_by_id: id('profile:tamara'),
        valid_from: now,
        basis: marker,
      },
    });
    await tx.homeworkAssignment.create({
      data: {
        ...source(`homework:${pupil.key}`),
        subject_id: id(`subject:${pupil.code}`),
        issued_by: id(`profile:${pupil.teacher}`),
        title: `[ДЕМО] ${pupil.subject}: самостоятельная работа`,
        content: { text: pupil.homework },
        due_at: later(pupil.dueDays),
      },
    });
    await tx.homeworkDelivery.create({
      data: {
        ...source(`delivery:${pupil.key}`),
        assignment_id: id(`homework:${pupil.key}`),
        enrollment_id: id(`enrollment:${pupil.key}`),
        issued_by: id(`profile:${pupil.teacher}`),
        issued_at: now,
        due_at: later(pupil.dueDays),
      },
    });
  }
  // Availability is explicit; future bookings still pass normal assignment/resource/rights checks.
  const { localDay, schoolMidnight } =
    await import('../apps/api/dist/modules/finance/manager-subscriptions/time.js');
  const midnight = schoolMidnight(localDay(now, 'Europe/Chisinau'), 'Europe/Chisinau');
  for (const teacher of ['andrei', 'elena']) {
    await tx.teacherEngagement.create({
      data: {
        ...source(`engagement:${teacher}`),
        teacher_id: id(`profile:${teacher}`),
        starts_at: now,
        recorded_by_id: id('profile:pasha'),
        basis: marker,
      },
    });
    for (let day = 1; day <= 9; day++) {
      const start = addSchoolDays(midnight, day, 'Europe/Chisinau');
      await tx.teacherAvailability.create({
        data: {
          ...source(`availability:${teacher}:${day}`),
          teacher_id: id(`profile:${teacher}`),
          starts_at: new Date(+start + 9 * 3600000),
          ends_at: new Date(+start + 20 * 3600000),
          timezone: 'Europe/Chisinau',
        },
      });
    }
  }
  step = 'lead';
  await tx.lead.create({
    data: {
      id: id('lead'),
      full_name: '[ДЕМО] Ева Кожокару',
      email: 'trial.demo@example.invalid',
      audience: 'CHILD',
      guardian_name: '[ДЕМО] Марина Кожокару',
      subject_id: id('subject:EN'),
      age_years: 12,
      source: 'OTHER',
      stage: 'NEW',
      stage_changed_at: now,
      comment: `${marker}. Заявка на бесплатный пробный урок английского (50 минут); связаться и согласовать время. Внешние сообщения не отправлять.`,
    },
  });
  await tx.assignedManager.create({
    data: {
      id: id('portfolio:lead'),
      lead_id: id('lead'),
      manager_id: id('profile:tamara'),
      assigned_at: now,
    },
  });
  const { stageEvent, leadTask, recordLead } =
    await import('../apps/api/dist/modules/manager/leads/events.js');
  await stageEvent(tx, id('lead'), null, 'NEW', true, now, marker);
  for (const type of ['LEAD_FOLLOWUP', 'ASSIGN_TEACHER'])
    await leadTask(
      tx,
      id('lead'),
      id('profile:tamara'),
      type,
      new Date(+now + 120 * 60000),
      `${namespace}:${type}`,
    );
  await recordLead(
    tx,
    { accountId: id('account:tamara'), requestId: id('request'), operationId: op('lead') },
    id('lead'),
    'LEAD_CREATED',
    { source: 'OTHER', demo: true },
  );
  step = 'tasks';
  for (const task of [
    {
      key: 'free',
      pupil: 'oleg',
      title: '[ДЕМО] Подобрать преподавателя свободному ученику',
      text: 'Обсудить цели Олега и подобрать преподавателя. Аккаунт создавать после первой распределённой оплаты.',
      due: later(1),
      status: 'OPEN',
    },
    {
      key: 'homework',
      pupil: 'sofia',
      title: '[ДЕМО] Напомнить Софии о домашнем задании',
      text: 'Проверить работу по английскому и отправить напоминание в кабинет ученика.',
      due: new Date(+now - 3600000),
      status: 'OPEN',
    },
  ])
    await tx.crmTask.create({
      data: {
        id: id(`task:${task.key}`),
        student_id: id(`student:${task.pupil}`),
        assigned_manager_id: id('profile:tamara'),
        type: 'MANUAL',
        title: task.title,
        due_at: task.due,
        status: task.status,
        payload: { kind: 'GENERAL', text: `${marker}. ${task.text}` },
        idempotency_key: `${namespace}:task:${task.key}`,
      },
    });
  await record(tx, 'base', {
    students: 5,
    teachers: 2,
    managerId: id('profile:tamara'),
    leadId: id('lead'),
    homework: 4,
    paid: false,
  });
  return { status: 'provisioned', at: now };
}

export async function provisionPaid(tx, rows, services) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(120061251)`;
  if (await tx.auditEvent.findUnique({ where: { event_key: eventKey('paid') } }))
    return { status: 'already-provisioned' };
  const base = await tx.auditEvent.findUniqueOrThrow({ where: { event_key: eventKey('base') } });
  const [{ now }] = await tx.$queryRaw`SELECT clock_timestamp() AS now`;
  const { addSchoolDays, localDay, schoolMidnight } =
    await import('../apps/api/dist/modules/finance/manager-subscriptions/time.js');
  const midnight = schoolMidnight(localDay(base.recorded_at, 'Europe/Chisinau'), 'Europe/Chisinau');
  const ctx = (key, role = 'MANAGER') => ({
    tx,
    actor: {
      accountId: id(`account:${role === 'MANAGER' ? 'tamara' : 'pasha'}`),
      sessionId: id('maintenance-context'),
      kind: 'STAFF',
      roles: [role],
      role,
      mfaCompleted: false,
      recoveryOnly: false,
      lastActiveAt: now,
      expiresAt: new Date(+now + 3600000),
    },
    operationId: op(key),
    requestId: id('request'),
  });
  step = 'period';
  let period = await tx.financialPeriod.findFirst({
    where: { starts_at: { lte: now }, ends_at: { gt: now } },
  });
  if (period?.closed_at) throw new Error('PLATFORM_DEMO_FINANCIAL_PERIOD_CLOSED');
  if (!period) {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(+start + 86400000);
    if (
      await tx.financialPeriod.findFirst({
        where: { starts_at: { lt: end }, ends_at: { gt: start } },
      })
    )
      throw new Error('PLATFORM_DEMO_FINANCIAL_PERIOD_OVERLAP');
    period = await tx.financialPeriod.create({
      data: { ...source('period'), starts_at: start, ends_at: end },
    });
  }
  for (const pupil of pupils) {
    step = `finance-${pupil.key}`;
    await tx.saleCondition.create({
      data: {
        ...source(`plan:${pupil.key}`),
        code: `[ДЕМО] ${pupil.subject} — ${pupil.quantity} занятий`,
        version: 1,
        lesson_count: pupil.quantity,
        duration_days: pupil.days,
        list_price: pupil.price,
        discount_amount: '0.0000',
        price: pupil.price,
        lesson_unit_price: pupil.unit,
        currency: 'MDL',
        valid_from: now,
      },
    });
    const subscription = await services.payments.subscription(ctx(`subscription:${pupil.key}`), {
      enrollmentId: id(`enrollment:${pupil.key}`),
      saleConditionId: id(`plan:${pupil.key}`),
    });
    const receipt = await services.payments.register(
      ctx(`receipt:${pupil.key}`),
      {
        studentId: id(`student:${pupil.key}`),
        amount: pupil.price,
        currency: 'MDL',
        provider: 'owner-demo-no-real-money',
        externalReference: `${namespace}:${pupil.key}`,
      },
      {
        purpose: 'FIRST_PAYMENT',
        method: 'BANK_TRANSFER',
        received_at: now,
        manager_note: `${marker}. Только демонстрация; реальных денег не получено.`,
      },
    );
    const confirmed = await services.payments.confirm(
      ctx(`confirm:${pupil.key}`, 'DIRECTOR'),
      receipt.id,
      {},
    );
    const distribution = await services.payments.propose(
      ctx(`distribution:${pupil.key}`),
      receipt.id,
      { subscriptionId: subscription.id, amount: pupil.price },
    );
    await services.payments.approve(ctx(`approve:${pupil.key}`, 'DIRECTOR'), distribution.id, {});
    const managed = need(
      await services.lifecycle.create(
        ctx(`activate:${pupil.key}`),
        {
          accountId: id('account:tamara'),
          managerId: id('profile:tamara'),
          requestId: id('request'),
        },
        id(`student:${pupil.key}`),
        { planId: id(`plan:${pupil.key}`), distributionId: distribution.id },
      ),
      'SUBSCRIPTION',
    );
    step = `account-${pupil.key}`;
    const account = accounts.find((a) => a.key === pupil.key);
    await identity(
      tx,
      { ...account, hash: rows.find((r) => r.key === pupil.key).hash },
      id('profile:pasha'),
      now,
    );
    // Trusted demo baseline: usable password after published allocation/full rights, no fake MFA or email delivery.
    await tx.studentAccount.create({
      data: {
        id: id(`profile:${pupil.key}`),
        student_id: id(`student:${pupil.key}`),
        account_id: id(`account:${pupil.key}`),
        activation_basis: 'FULL_PAYMENT',
        must_change_password: false,
        activation_subscription_id: subscription.id,
        activation_payment_confirmation_id: confirmed.id,
        activation_distribution_id: distribution.id,
        activation_confirmed_by_staff_id: id('profile:pasha'),
        activated_at: await services.now(tx),
        timezone: 'Europe/Chisinau',
      },
    });
    step = `schedule-${pupil.key}`;
    for (const [index, day] of pupil.offsets.entries()) {
      const start = new Date(
        +addSchoolDays(midnight, day, 'Europe/Chisinau') + pupil.hour * 3600000,
      );
      need(
        await services.schedule.create(
          ctx(`lesson:${pupil.key}:${index}`),
          id(`student:${pupil.key}`),
          {
            teacherId: id(`profile:${pupil.teacher}`),
            startsAt: start.toISOString(),
            durationMinutes: 60,
            subscriptionId: managed.id,
          },
        ),
        'LESSON',
      );
    }
  }
  step = 'notifications';
  for (const [key, pupil, body] of [
    [
      'welcome',
      'anna',
      '[ДЕМО] Анна, добро пожаловать! В расписании уже есть математика. Откройте домашние задания и попробуйте сохранить черновик.',
    ],
    [
      'homework-reminder',
      'sofia',
      '[ДЕМО] София, напоминание: домашнее задание по английскому ждёт выполнения. Откройте раздел «Домашние задания» и отправьте пять предложений о любимой книге.',
    ],
  ])
    need(
      await services.notifications.enqueue(tx, {
        studentId: id(`student:${pupil}`),
        managerId: id('profile:tamara'),
        channel: 'IN_APP',
        templateCode: 'MANUAL_MESSAGE',
        variables: { body },
        subject: '[ДЕМО] Сообщение от Тамары',
        dedupeKey: `${namespace}:${key}`,
        operationId: op(`notice:${key}`),
        actorId: id('account:tamara'),
        requestId: id('request'),
      }),
      'NOTIFICATION',
    );
  await record(tx, 'paid', {
    noRealMoney: true,
    amount: '8500.0000',
    currency: 'MDL',
    lessonsGranted: 22,
    lessonsScheduled: 12,
    studentAccounts: 4,
    manualInAppMessages: 2,
  });
  return {
    status: 'provisioned',
    studentAccounts: 4,
    lessonsScheduled: 12,
    manualInAppMessages: 2,
  };
}
async function main() {
  const input = demoSetupInput(process.env);
  if (!input) return;
  const connection = createDirectClient();
  if (!connection.ok) throw new Error('PLATFORM_DEMO_DATABASE_UNAVAILABLE');
  let app;
  try {
    const base = await transaction(connection.value, (tx) => provisionBase(tx, input.rows), 60000);
    console.log(JSON.stringify({ platformDemo: { phase: 'base', ...base } }));
    if (input.paid) {
      const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
      requireApi('reflect-metadata');
      const { NestFactory } = requireApi('@nestjs/core');
      const { AppModule } = await import('../apps/api/dist/app.module.js');
      const { PaymentsService } =
        await import('../apps/api/dist/modules/finance/payments.service.js');
      const { ManagerSubscriptionLifecycle } =
        await import('../apps/api/dist/modules/finance/manager-subscriptions/lifecycle.service.js');
      const { ManagerScheduleWorkflow } =
        await import('../apps/api/dist/modules/schedule/manager/workflow.service.js');
      const { NotificationOutboxPublisher } =
        await import('../apps/api/dist/modules/notifications/notification-outbox.publisher.js');
      const { at } = await import('../apps/api/dist/modules/finance/finance-common.js');
      app = await NestFactory.createApplicationContext(AppModule, {
        logger: false,
        abortOnError: false,
      });
      const services = {
        payments: app.get(PaymentsService),
        lifecycle: app.get(ManagerSubscriptionLifecycle),
        schedule: app.get(ManagerScheduleWorkflow),
        notifications: new NotificationOutboxPublisher(),
        now: at,
      };
      const paid = await transaction(
        connection.value,
        (tx) => provisionPaid(tx, input.rows, services),
        120000,
      );
      console.log(JSON.stringify({ platformDemo: { phase: 'paid', ...paid } }));
    }
    // A second call must return before identity/data writes, preserving any subsequent owner edits.
    const repeat = await connection.value.$transaction((tx) => provisionBase(tx, input.rows), {
      isolationLevel: 'Serializable',
      timeout: 10000,
    });
    if (repeat.status !== 'already-provisioned')
      throw new Error('PLATFORM_DEMO_IDEMPOTENCE_FAILED');
    if (input.paid) {
      const repeatPaid = await connection.value.$transaction(
        (tx) => provisionPaid(tx, input.rows, null),
        { isolationLevel: 'Serializable', timeout: 10000 },
      );
      if (repeatPaid.status !== 'already-provisioned')
        throw new Error('PLATFORM_DEMO_IDEMPOTENCE_FAILED');
    }
    console.log('PLATFORM_DEMO_IDEMPOTENCE_OK');
  } finally {
    if (app) await app.close();
    await connection.value.$disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch((error) => {
    // Only known codes/step names, never connection strings, hashes, input data, or Prisma details.
    console.error(
      JSON.stringify({
        code: /^PLATFORM_DEMO_[A-Z_]+$/.test(error?.message ?? '')
          ? error.message
          : (error?.domain?.code ?? 'PLATFORM_DEMO_FAILED'),
        step,
        ...(/^P\d{4}$/.test(error?.code ?? '') ? { prismaCode: error.code } : {}),
      }),
    );
    process.exitCode = 1;
  });
