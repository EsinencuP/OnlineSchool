import { randomUUID } from 'node:crypto';
import { Prisma } from '../../packages/db/dist/index.js';
import { managerTasksFixture } from './manager-tasks-fixture.mjs';
import { rawItem } from './manager-crm-fixture.mjs';
import { receiptStatus } from '../../apps/api/dist/modules/finance/manager-payments/receipt-read.spec.js';
import { effectiveMeetLink } from '../../apps/api/dist/modules/schedule/meet-link.js';
const clone = (v) =>
  v instanceof Date
    ? new Date(v)
    : Prisma.Decimal.isDecimal(v)
      ? new Prisma.Decimal(v)
      : v instanceof Map
        ? new Map([...v].map(([k, x]) => [k, clone(x)]))
        : v instanceof Set
          ? new Set(v)
          : Array.isArray(v)
            ? v.map(clone)
            : v && typeof v === 'object'
              ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]))
              : v;
const sort = (a, b, field) => +a[field] - +b[field] || a.id.localeCompare(b.id);
export async function managerDashboardFixture() {
  const fx = await managerTasksFixture(),
    f = fx.f,
    db = f.client,
    captured = [],
    calls = [];
  let snapshot = null,
    readCount = 0,
    readOnly = false,
    hook = null;
  const current = () => snapshot ?? f.state;
  const owner = (s, student, manager) => s.students.get(student)?.managerId === manager;
  const rootFor = (s, id) => {
    const p = [...s.periods.values()].find((p) => p.financial_subscription_id === id);
    return p ? s.roots.get(p.manager_subscription_id) : null;
  };
  const studentStatus = (s, row, now) => {
    if (row.archived_at) return 'ARCHIVED';
    const subs = [...s.financial.values()]
        .filter(
          (sub) =>
            s.enrollments.get(sub.enrollment_id)?.student_id === row.id && sub.valid_from <= now,
        )
        .sort(
          (a, b) =>
            Number(a.valid_to === null || a.valid_to > now) -
              Number(b.valid_to === null || b.valid_to > now) ||
            +a.valid_from - +b.valid_from ||
            b.id.localeCompare(a.id),
        )
        .reverse(),
      sub = subs[0];
    if (!sub) return 'LEAD';
    const root = rootFor(s, sub.id);
    return (root?.ends_at ?? sub.valid_to) <= now
      ? 'EXPIRED'
      : sub.frozen_from <= now && sub.frozen_until > now
        ? 'FROZEN'
        : 'ACTIVE';
  };
  const pending = (s, manager, now) => {
    const money = new Map();
    let count = 0;
    for (const p of s.receipts.values()) {
      if (!owner(s, p.student_id, manager) || p.rejected_at || p.created_at > now) continue;
      const memberships = s.memberships ?? [],
        active = (m) =>
          m.status === 'ACTIVE' && m.valid_from <= now && (!m.valid_to || m.valid_to > now),
        own = memberships.find((m) => m.student_id === p.student_id && active(m));
      if (
        own &&
        memberships.some(
          (m) =>
            m.household_id === own.household_id &&
            m.student_id &&
            active(m) &&
            !owner(s, m.student_id, manager),
        )
      )
        continue;
      const distributions = [...s.funding.values()].filter((d) => d.payment_id === p.id);
      if (
        distributions.some(
          (d) =>
            !owner(
              s,
              s.enrollments.get(s.financial.get(d.subscription_id)?.enrollment_id)?.student_id,
              manager,
            ),
        )
      )
        continue;
      const rootDoc = [...s.documents.values()].find((d) => d.payment_id === p.id),
        entry = [...s.entries.values()].find((e) => e.document_id === rootDoc?.id),
        status = receiptStatus({
          ...p,
          t03_ledgerdocument_payment_id: rootDoc
            ? { t03_ledgerentry_document_id: entry ?? null }
            : null,
        });
      let amount = new Prisma.Decimal(p.amount);
      if (status === 'CONFIRMED') {
        const ids = new Set(
          [...s.documents.values()]
            .filter(
              (d) => d.payment_id === p.id || distributions.some((x) => x.id === d.distribution_id),
            )
            .map((d) => d.id),
        );
        let changed = true;
        while (changed) {
          changed = false;
          for (const d of s.documents.values())
            if (ids.has(d.correction_of_document_id) && !ids.has(d.id)) {
              ids.add(d.id);
              changed = true;
            }
        }
        const entries = [...s.entries.values()]
          .filter(
            (e) =>
              ids.has(e.document_id) &&
              e.published_at &&
              e.published_at <= now &&
              e.effective_at <= now,
          )
          .map((e) => e.id);
        amount = s.lines
          .filter(
            (l) =>
              entries.includes(l.entry_id) &&
              l.account_type === 'UNALLOCATED_FUNDS' &&
              l.currency === p.currency,
          )
          .reduce(
            (n, l) => n.add(new Prisma.Decimal(l.amount).mul(l.direction === 'CREDIT' ? 1 : -1)),
            new Prisma.Decimal(0),
          );
      }
      if (amount.gt(0)) {
        count++;
        money.set(p.currency, (money.get(p.currency) ?? new Prisma.Decimal(0)).add(amount));
      }
    }
    return {
      count,
      totals: [...money]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, amount]) => ({ currency, amount: amount.toFixed(4) })),
    };
  };
  const raw = db.$queryRaw.getMockImplementation(),
    exec = db.$executeRaw.getMockImplementation(),
    transaction = db.$transaction.getMockImplementation(),
    profile = db.staffAccount.findFirst.getMockImplementation();
  db.$executeRaw.mockImplementation(async (parts, ...values) => {
    if (snapshot) {
      const text = parts.text ?? Prisma.sql(parts, ...values).text;
      calls.push({ text });
      readCount++;
      if (text !== 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        throw Error('read-only contract violated');
      readOnly = true;
      return 0;
    }
    return exec(parts, ...values);
  });
  db.staffAccount.findFirst.mockImplementation(async (q) => {
    if (snapshot) {
      readCount++;
      calls.push({ profile: true });
      if (f.state.failProfile) return null;
      if (f.state.inactiveSnapshot) return { deactivated_at: snapshot.now };
    }
    return profile(q);
  });
  db.$transaction.mockImplementation((fn, opts) => {
    if (!opts || opts.isolationLevel === 'Serializable') return transaction(fn, opts);
    return transaction(async (tx) => {
      snapshot = clone(f.state);
      readCount = 0;
      readOnly = false;
      try {
        return await fn(tx);
      } finally {
        captured.push({ readCount, readOnly, options: opts });
        snapshot = null;
      }
    }, opts);
  });
  db.$queryRaw.mockImplementation(async (parts, ...args) => {
    const query = parts.text ? parts : Prisma.sql(parts, ...args),
      text = query.text,
      values = query.values,
      s = current();
    if (snapshot) {
      if (!readOnly) throw Error('query before READ ONLY');
      readCount++;
      calls.push({ text, values });
    }
    if (text.includes('transaction_timestamp() AS now')) return [{ now: s.now }];
    const manager = f.accounts.find((a) => values.includes(a.staffId))?.staffId;
    if (text.includes('mgr09:') || text.includes('WITH RECURSIVE portfolio AS')) {
      if (!manager) throw Error('dashboard query missing portfolio parameter');
      if (f.state.failDashboardSql) throw Error('private database note phone email');
      const now = s.now,
        dates = values.filter((v) => v instanceof Date),
        until = new Date(Math.max(...dates.map(Number))),
        students = [...s.students.values()].filter((st) => st.managerId === manager);
      let result;
      const overview = {};
      if (text.includes('mgr09:students')) {
        result = { active: 0, frozen: 0, leads: 0 };
        for (const st of students) {
          const status = studentStatus(s, st, now);
          if (status === 'ACTIVE') result.active++;
          if (status === 'FROZEN') result.frozen++;
          if (status === 'LEAD') result.leads++;
        }
        hook?.();
        hook = null;
      }
      if (text.includes('mgr09:students')) overview.students = result;
      if (text.includes('mgr09:lessons'))
        result = {
          items: [...s.lessons.values()]
            .filter(
              (l) =>
                owner(s, s.enrollments.get(l.enrollment_id)?.student_id, manager) &&
                l.status === 'SCHEDULED' &&
                l.scheduled_at >= now &&
                l.scheduled_at <= until,
            )
            .sort((a, b) => sort(a, b, 'scheduled_at'))
            .slice(0, 10)
            .map((l) => ({
              lessonId: l.id,
              studentId: s.enrollments.get(l.enrollment_id).student_id,
              studentName: s.students.get(s.enrollments.get(l.enrollment_id).student_id).full_name,
              startsAt: l.scheduled_at.toISOString(),
              teacherName: s.teachers.get(l.scheduled_teacher_id).full_name,
              hasMeetLink: !!effectiveMeetLink(
                l.meet_link_overridden,
                l.google_meet_link,
                s.assignments.get(l.teaching_assignment_id).google_meet_link,
              ),
            })),
        };
      if (text.includes('mgr09:lessons')) overview.upcomingLessons = result.items;
      if (text.includes('mgr09:tasks')) {
        const tasks = [...s.tasks.values()]
          .filter(
            (t) =>
              owner(s, t.student_id, manager) &&
              [
                'MANUAL',
                'ATTENDANCE_DISPUTE',
                'RESCHEDULE_REQUEST',
                'SUBSCRIPTION_EXPIRING',
              ].includes(t.type) &&
              ['OPEN', 'IN_PROGRESS'].includes(t.status) &&
              t.due_at < now &&
              (!t.lesson_id ||
                s.enrollments.get(s.lessons.get(t.lesson_id)?.enrollment_id)?.student_id ===
                  t.student_id) &&
              (!['ATTENDANCE_DISPUTE', 'RESCHEDULE_REQUEST'].includes(t.type) || t.lesson_id) &&
              (t.type !== 'SUBSCRIPTION_EXPIRING' ||
                s.enrollments.get(s.roots.get(t.payload?.subscriptionId)?.enrollment_id)
                  ?.student_id === t.student_id),
          )
          .sort((a, b) => sort(a, b, 'due_at'));
        result = {
          count: tasks.length,
          top: tasks.slice(0, 5).map((t) => ({
            taskId: t.id,
            type: { MANUAL: 'GENERAL', ATTENDANCE_DISPUTE: 'CHARGE_DISPUTE' }[t.type] ?? t.type,
            studentName: s.students.get(t.student_id).full_name,
            dueAt: t.due_at.toISOString(),
          })),
        };
      }
      if (text.includes('mgr09:tasks')) overview.overdueTasks = result;
      if (text.includes('mgr09:subscriptions'))
        result = {
          items: [...s.roots.values()]
            .filter(
              (r) =>
                owner(s, s.enrollments.get(r.enrollment_id)?.student_id, manager) &&
                r.status === 'ACTIVE' &&
                r.ends_at > now &&
                r.ends_at <= until,
            )
            .sort((a, b) => sort(a, b, 'ends_at'))
            .slice(0, 10)
            .map((r) => {
              const subs = [...s.periods.values()]
                  .filter((p) => p.manager_subscription_id === r.id)
                  .map((p) => p.financial_subscription_id),
                grants = [...s.grants.values()].filter(
                  (g) => subs.includes(g.subscription_id) && g.granted_at <= now,
                );
              return {
                subscriptionId: r.id,
                studentId: s.enrollments.get(r.enrollment_id).student_id,
                studentName: s.students.get(s.enrollments.get(r.enrollment_id).student_id)
                  .full_name,
                endsAt: r.ends_at.toISOString(),
                remainingLessons:
                  grants.reduce((n, g) => n + g.quantity, 0) -
                  [...s.consumptions.values()]
                    .filter(
                      (c) =>
                        grants.some((g) => g.id === c.grant_id) &&
                        c.consumed_at <= now &&
                        (!c.cancelled_at || c.cancelled_at > now),
                    )
                    .reduce((n, c) => n + c.quantity, 0) +
                  [...s.adjustments.values()]
                    .filter((a) => grants.some((g) => g.id === a.grant_id) && a.effective_at <= now)
                    .reduce((n, a) => n + (a.delta_quantity ?? 0), 0),
              };
            }),
        };
      if (text.includes('WITH RECURSIVE portfolio AS')) result = pending(s, manager, now);
      return [text.includes('mgr09:overview') ? overview : result];
    }
    // MGR02 list reads use the same relational data, without claiming SQL execution.
    if (text.includes('AS cursor_valid,') && text.includes('WITH facts AS')) {
      const statuses = ['ACTIVE', 'LEAD', 'FROZEN', 'EXPIRED', 'ARCHIVED'],
        filter = values.find((v) => statuses.includes(v));
      return [
        {
          cursor_valid: true,
          items: [...s.students.values()]
            .filter(
              (st) =>
                st.managerId === manager && (!filter || studentStatus(s, st, s.now) === filter),
            )
            .map((st) => ({ ...rawItem(st), status: studentStatus(s, st, s.now) })),
        },
      ];
    }
    return raw(parts, ...args);
  });
  const receipt = (student, amount = '0.1001', extra = {}) => {
    const r = {
      id: randomUUID(),
      student_id: student.id,
      amount: new Prisma.Decimal(amount).toFixed(4),
      currency: 'MDL',
      created_at: f.state.now,
      registered_at: f.state.now,
      rejected_at: null,
      approval_requested_at: null,
      confirmed_by_director_at: null,
      confirmed_by_director_id: null,
      ...extra,
    };
    f.state.receipts.set(r.id, r);
    return r;
  };
  const post = (p, amount, distribution = null) => {
    const id = randomUUID(),
      entry = randomUUID();
    f.state.documents.set(id, {
      id,
      ...(distribution ? { distribution_id: distribution.id } : { payment_id: p.id }),
    });
    f.state.entries.set(entry, {
      id: entry,
      document_id: id,
      published_at: f.state.now,
      effective_at: f.state.now,
    });
    f.state.lines.push({
      entry_id: entry,
      account_type: 'UNALLOCATED_FUNDS',
      direction: distribution ? 'DEBIT' : 'CREDIT',
      amount,
      currency: p.currency,
    });
    return { id, entry };
  };
  return {
    ...fx,
    captured,
    calls,
    receipt,
    post,
    afterStudents: (fn) => {
      hook = fn;
    },
  };
}
