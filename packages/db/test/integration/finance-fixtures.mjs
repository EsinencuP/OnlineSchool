import { randomUUID } from 'node:crypto';

// Synthetic values only. Table/column names come solely from this test module.
export async function insert(db, table, data, operation = true) {
  const row = {
    id: randomUUID(),
    ...(operation ? { source_operation_id: randomUUID() } : {}),
    ...data,
  };
  const names = Object.keys(row);
  if (![table, ...names].every((name) => /^[a-z_][a-z0-9_]*$/.test(name)))
    throw new Error('Invalid fixture identifier');
  const result = await db.query(
    `INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
    Object.values(row),
  );
  return result.rows[0];
}

export const at = '2026-10-01T12:00:00Z';
export const later = '2026-10-02T12:00:00Z';

export async function fundedSubscription(db, staffId, studentId, options = {}) {
  const price = options.price ?? '100.0000';
  const amount = options.amount ?? price;
  const subject = await insert(
    db,
    'subjects',
    { code: randomUUID(), name: 'Synthetic subject' },
    false,
  );
  const enrollment = await insert(db, 'student_subject_enrollments', {
    student_id: studentId,
    subject_id: subject.id,
    valid_from: at,
  });
  const condition = await insert(db, 'sale_conditions', {
    code: randomUUID(),
    version: 1,
    lesson_count: 2,
    list_price: price,
    discount_amount: '0.0000',
    price,
    lesson_unit_price: '50.0000',
    currency: 'MDL',
    valid_from: at,
  });
  const subscription = await insert(db, 'subscriptions', {
    enrollment_id: enrollment.id,
    sale_condition_id: condition.id,
    lesson_count: 2,
    full_price: price,
    initial_discount_amount: '0.0000',
    original_paid_unit_price: '50.0000',
    currency: 'MDL',
    valid_from: at,
  });
  const payment = await insert(db, 'payment_receipts', {
    amount,
    currency: 'MDL',
    registered_by_manager_id: staffId,
    registered_at: at,
    confirmed_by_director_id: staffId,
    confirmed_by_director_at: at,
    confirmation_operation_id: randomUUID(),
  });
  const distribution = await insert(db, 'payment_distributions', {
    payment_id: payment.id,
    subscription_id: subscription.id,
    amount,
    currency: 'MDL',
    approved_by_director_id: staffId,
    approved_at: at,
    approval_operation_id: randomUUID(),
  });
  return { subject, enrollment, condition, subscription, payment, distribution };
}

export async function director(db) {
  const account = await insert(
    db,
    'auth_accounts',
    { kind: 'STAFF', login_id: randomUUID() },
    false,
  );
  const staff = await insert(
    db,
    'staff_accounts',
    { account_id: account.id, full_name: 'Synthetic director' },
    false,
  );
  const role = (await db.query("SELECT id FROM roles WHERE code='DIRECTOR'")).rows[0];
  await insert(
    db,
    'role_assignments',
    { account_id: account.id, role_id: role.id, valid_from: '2000-01-01Z' },
    false,
  );
  return staff;
}

export async function lessonFixture(db, finance, staffId, options = {}) {
  const auth = await insert(
    db,
    'auth_accounts',
    { kind: 'TEACHER', login_id: randomUUID() },
    false,
  );
  const teacher = await insert(
    db,
    'teacher_accounts',
    { account_id: auth.id, full_name: 'Synthetic teacher' },
    false,
  );
  const assignment = await insert(db, 'teaching_assignments', {
    enrollment_id: finance.enrollment.id,
    teacher_id: teacher.id,
    valid_from: at,
    basis: 'Synthetic assignment',
    assigned_by_id: staffId,
  });
  const lesson = await insert(db, 'lesson_occurrences', {
    enrollment_id: finance.enrollment.id,
    teaching_assignment_id: assignment.id,
    scheduled_teacher_id: teacher.id,
    original_scheduled_at: later,
    scheduled_at: later,
    scheduled_end_at: '2026-10-02T13:00:00Z',
    status: 'CONDUCTED',
    actual_start_at: later,
    actual_teacher_at_start_id: teacher.id,
    rate_at_start_snapshot: options.rate ?? '200.0000',
    points_at_start_snapshot: options.points ?? 4,
    rate_basis_at_start: options.rateBasis ?? 'ORDINARY_POINTS',
    rate_currency_at_start: 'MDL',
  });
  const outcome = await insert(db, 'lesson_actual_outcomes', {
    lesson_occurrence_id: lesson.id,
    actual_teacher_id: teacher.id,
    actual_started_at: later,
    duration_min: 60,
    confirmed_at: '2026-10-02T13:00:00Z',
    confirmed_by_id: staffId,
    rate_snapshot: options.rate ?? '200.0000',
    points_snapshot: options.points ?? 4,
    rate_basis: options.rateBasis ?? 'ORDINARY_POINTS',
    basis: 'Synthetic actual start snapshot',
    currency: 'MDL',
    ...(options.permissionId ? { temporary_access_permission_id: options.permissionId } : {}),
  });
  return { teacher, assignment, lesson, outcome };
}
