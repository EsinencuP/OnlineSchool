import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { managerScheduleFixture } from './manager-schedule-fixture.mjs';
import { rawCard } from './manager-crm-fixture.mjs';
import { match as baseMatch } from './manager-payments-fixture.mjs';
const match = (row, where) => {
  if (!where) return true;
  if (!row) return false;
  return Object.entries(where).every(([k, v]) => {
    if (k === 'AND') return (Array.isArray(v) ? v : [v]).every((w) => match(row, w));
    if (k === 'OR') return v.some((w) => match(row, w));
    if (k === 'NOT') return !match(row, v);
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      if ('some' in v) return (row[k] ?? []).some((r) => match(r, v.some));
      if ('is' in v) return match(row[k], v.is);
      if ('contains' in v)
        return v.mode === 'insensitive'
          ? String(row[k] ?? '')
              .toLowerCase()
              .includes(v.contains.toLowerCase())
          : String(row[k] ?? '').includes(v.contains);
      if ('notIn' in v) return !v.notIn.includes(row[k]);
    }
    return baseMatch(row, { [k]: v });
  });
};
const changes = (row, data) => {
  for (const [k, v] of Object.entries(data))
    if (v !== undefined)
      row[k] = v && typeof v === 'object' && 'increment' in v ? (row[k] ?? 0) + v.increment : v;
  return row;
};
export async function managerLeadsFixture() {
  let identities;
  const subjectId = randomUUID(),
    teacherId = randomUUID();
  const fx = await managerScheduleFixture({
    snapshotFields: [
      'leads',
      'leadEvents',
      'leadStudentLinks',
      'trialReports',
      'leadAuth',
      'leadProfiles',
      'leadRoles',
    ],
    reset(s) {
      s.leads = new Map();
      s.leadEvents = [];
      s.leadStudentLinks = [];
      s.trialReports = new Map();
      s.now = new Date();
      s.leadSql = [];
      s.leadAuth = new Map();
      s.leadProfiles = new Map();
      s.leadRoles = [];
      s.activationEvidence = new Map();
      s.teachers.set(teacherId, {
        id: teacherId,
        account_id: identities[3].id,
        full_name: 'Trial teacher',
        deactivated_at: null,
      });
      s.availability.push({
        id: randomUUID(),
        teacher_id: teacherId,
        starts_at: new Date(+s.now - 86400000),
        ends_at: new Date(+s.now + 30 * 86400000),
      });
    },
    configure(db, getState, accounts) {
      identities = accounts;
      const s = () => getState(),
        raw = db.$queryRaw.getMockImplementation(),
        assign = db.assignedManager.create.getMockImplementation();
      const hydrate = async (r) => {
        if (!r) return null;
        const lesson = r.trial_lesson_id
          ? await db.lessonOccurrence.findUnique({ where: { id: r.trial_lesson_id } })
          : null;
        return {
          ...r,
          subject: { id: subjectId, name: 'Math' },
          manager_assignments: r.managerId
            ? [{ manager_id: r.managerId, assigned_at: new Date('2020-01-01'), ended_at: null }]
            : [],
          student_links: s().leadStudentLinks.filter((l) => l.lead_id === r.id && !l.unlinked_at),
          tasks: [...s().tasks.values()]
            .filter((t) => t.lead_id === r.id && ['OPEN', 'IN_PROGRESS'].includes(t.status))
            .sort((a, b) => +a.due_at - +b.due_at),
          trial_lesson: lesson
            ? {
                ...lesson,
                outcome_reports: [...s().trialReports.values()]
                  .filter((p) => p.lesson_occurrence_id === lesson.id)
                  .sort((a, b) => b.version - a.version)
                  .slice(0, 1),
              }
            : null,
          trial_lessons: [...s().lessons.values()].filter((l) => l.trial_lead_id === r.id),
          stage_events: s().leadEvents.filter((e) => e.lead_id === r.id),
        };
      };
      const rows = async (where) =>
        (await Promise.all([...s().leads.values()].map(hydrate))).filter((r) => match(r, where));
      db.lead = {
        findFirst: jest.fn(async ({ where }) => (await rows(where))[0] ?? null),
        findUnique: jest.fn(async ({ where }) => hydrate(s().leads.get(where.id))),
        findMany: jest.fn(async ({ where, take }) =>
          (await rows(where))
            .sort((a, b) => +b.created_at - +a.created_at || b.id.localeCompare(a.id))
            .slice(0, take),
        ),
        count: jest.fn(async ({ where }) => (await rows(where)).length),
        create: jest.fn(async ({ data }) => {
          const r = {
            id: randomUUID(),
            stage: 'NEW',
            version: 1,
            created_at: s().now,
            updated_at: s().now,
            archived_at: null,
            phone: null,
            email: null,
            guardian_name: null,
            grade: null,
            age_years: null,
            level: null,
            comment: null,
            lost_reason: null,
            lost_comment: null,
            trial_lesson_id: null,
            converted_at: null,
            ...data,
          };
          s().leads.set(r.id, r);
          return hydrate(r);
        }),
        update: jest.fn(async ({ where, data }) => hydrate(changes(s().leads.get(where.id), data))),
      };
      db.leadStageEvent = {
        create: jest.fn(async ({ data }) => {
          const row = { id: randomUUID(), ...data };
          s().leadEvents.push(row);
          return row;
        }),
      };
      db.leadStudentLink = {
        create: jest.fn(async ({ data }) => {
          const row = { id: randomUUID(), linked_at: s().now, unlinked_at: null, ...data };
          s().leadStudentLinks.push(row);
          return row;
        }),
      };
      db.assignedManager.create.mockImplementation(async (q) => {
        if (q.data.lead_id) {
          s().leads.get(q.data.lead_id).managerId = q.data.manager_id;
          return { id: randomUUID(), ...q.data };
        }
        return assign(q);
      });
      const managerFind = db.assignedManager.findFirst.getMockImplementation();
      db.assignedManager.findFirst = jest.fn(async ({ where }) => {
        if (!where.lead_id) return managerFind({ where });
        const r = s().leads.get(where.lead_id);
        return r?.managerId ? { manager_id: r.managerId } : null;
      });
      db.subject = {
        findFirst: jest.fn(async ({ where }) =>
          where.id === subjectId ? { id: subjectId, name: 'Math', archived_at: null } : null,
        ),
        findUnique: jest.fn(async ({ where }) =>
          where.id === subjectId ? { id: subjectId, name: 'Math', archived_at: null } : null,
        ),
      };
      db.studentSubjectEnrollment.findFirst = jest.fn(
        async ({ where }) => [...s().enrollments.values()].find((r) => match(r, where)) ?? null,
      );
      db.studentSubjectEnrollment.create = jest.fn(async ({ data }) => {
        const r = { id: randomUUID(), valid_to: null, status: 'ACTIVE', ...data };
        s().enrollments.set(r.id, r);
        return r;
      });
      db.teachingAssignment.findFirst = jest.fn(
        async ({ where }) => [...s().assignments.values()].find((r) => match(r, where)) ?? null,
      );
      db.teachingAssignment.create = jest.fn(async ({ data }) => {
        const r = { id: randomUUID(), valid_to: null, google_meet_link: null, ...data };
        s().assignments.set(r.id, r);
        return r;
      });
      db.teacherAccount.findFirst = jest.fn(
        async ({ where }) =>
          [...s().teachers.values()].find(
            (r) => !where.account_id || r.account_id === where.account_id,
          ) ?? null,
      );
      db.lessonOutcomeReport = {
        findFirst: jest.fn(
          async ({ where }) =>
            [...s().trialReports.values()]
              .filter((r) => match(r, where))
              .sort((a, b) => b.version - a.version)[0] ?? null,
        ),
        findUnique: jest.fn(async ({ where }) => s().trialReports.get(where.id) ?? null),
        create: jest.fn(async ({ data }) => {
          const r = { id: randomUUID(), ...data };
          s().trialReports.set(r.id, r);
          return r;
        }),
      };
      db.auditEvent.findUnique = jest.fn(
        async ({ where }) => s().audit.find((a) => a.event_key === where.event_key) ?? null,
      );
      const task = (r) =>
        r
          ? {
              ...r,
              student: r.student_id
                ? {
                    ...s().students.get(r.student_id),
                    manager_assignments: [
                      {
                        manager_id: s().students.get(r.student_id)?.managerId,
                        assigned_at: new Date('2020-01-01'),
                        ended_at: null,
                      },
                    ],
                  }
                : null,
              lead: r.lead_id
                ? {
                    ...s().leads.get(r.lead_id),
                    manager_assignments: [
                      {
                        manager_id: s().leads.get(r.lead_id)?.managerId,
                        assigned_at: new Date('2020-01-01'),
                        ended_at: null,
                      },
                    ],
                  }
                : null,
              lesson: null,
            }
          : null;
      db.crmTask = {
        createMany: jest.fn(async ({ data }) => {
          for (const d of data)
            if (![...s().tasks.values()].some((t) => t.idempotency_key === d.idempotency_key)) {
              const id = randomUUID();
              s().tasks.set(id, {
                id,
                student_id: null,
                lead_id: null,
                lesson_id: null,
                status: 'OPEN',
                version: 1,
                created_at: s().now,
                resolved_at: null,
                escalated_at: null,
                decision: null,
                ledger_publication_id: null,
                ...d,
              });
            }
          return { count: data.length };
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          let count = 0;
          for (const t of s().tasks.values())
            if (match(task(t), where)) {
              changes(t, data);
              count++;
            }
          return { count };
        }),
        findFirst: jest.fn(async ({ where }) =>
          task([...s().tasks.values()].find((t) => match(task(t), where))),
        ),
        findUnique: jest.fn(async ({ where }) =>
          task([...s().tasks.values()].find((t) => match(task(t), where))),
        ),
        findMany: jest.fn(async ({ where, take }) =>
          [...s().tasks.values()]
            .map(task)
            .filter((t) => match(t, where))
            .sort((a, b) => +a.due_at - +b.due_at || a.id.localeCompare(b.id))
            .slice(0, take),
        ),
      };
      const studentUpdate = db.student.update?.getMockImplementation();
      db.student.update = jest.fn(async (q) =>
        studentUpdate ? studentUpdate(q) : changes(s().students.get(q.where.id), q.data),
      );
      db.student.updateMany = jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const row of s().students.values())
          if (
            match(
              {
                ...row,
                manager_assignments: [
                  {
                    manager_id: row.managerId,
                    assigned_at: new Date('2020-01-01'),
                    ended_at: null,
                  },
                ],
              },
              where,
            )
          ) {
            changes(row, data);
            count++;
          }
        return { count };
      });
      const accountFind = db.studentAccount.findFirst.getMockImplementation();
      db.studentAccount.findFirst = jest.fn(async (q) => {
        if (!q.where.student_id) return accountFind(q);
        const row = [...s().leadProfiles.values()].find((p) => p.student_id === q.where.student_id);
        return row
          ? {
              ...row,
              account: s().leadAuth.get(row.account_id),
              student: s().students.get(row.student_id),
            }
          : null;
      });
      db.studentAccount.create = jest.fn(async ({ data }) => {
        const row = {
          id: randomUUID(),
          deactivated_at: null,
          timezone: 'Europe/Chisinau',
          ...data,
        };
        s().leadProfiles.set(row.id, row);
        return row;
      });
      db.authAccount = {
        findUnique: jest.fn(async ({ where }) =>
          where.id
            ? (s().leadAuth.get(where.id) ?? accounts.find((a) => a.id === where.id) ?? null)
            : ([...s().leadAuth.values()].find((a) => a.login_id === where.login_id) ?? null),
        ),
        create: jest.fn(async ({ data }) => {
          const row = { id: randomUUID(), disabled_at: null, ...data };
          s().leadAuth.set(row.id, row);
          return row;
        }),
      };
      db.role = {
        findUnique: jest.fn(async () => ({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })),
      };
      db.roleAssignment = {
        create: jest.fn(async ({ data }) => {
          s().leadRoles.push(data);
          return data;
        }),
      };
      const distribution = db.paymentDistribution.findFirst?.getMockImplementation();
      db.paymentDistribution.findFirst = jest.fn(async (q) =>
        q.where.subscription_ref
          ? ([...s().funding.values()].find(
              (d) =>
                s().enrollments.get(s().financial.get(d.subscription_id)?.enrollment_id)
                  ?.student_id === q.where.subscription_ref.enrollment_ref.student_id,
            ) ?? null)
          : (distribution?.(q) ?? null),
      );
      db.$queryRaw.mockImplementation(async (parts, ...values) => {
        const text = parts.text ?? parts.join('?'),
          params = parts.text ? parts.values : values;
        if (text.includes('INSERT INTO auth_rate_limits')) return [{ attempts: 1 }];
        if (text.includes('AS subscription_id')) {
          const id = params.find((v) => s().students.has(v));
          const evidence = s().activationEvidence.get(id);
          return evidence ? [evidence] : [];
        }
        if (text.includes('SELECT id FROM students') && text.includes('FOR UPDATE'))
          return s().students.has(params[0]) ? [{ id: params[0] }] : [];
        if (text.includes(' AS card')) {
          const id = params.find((v) => s().students.has(v)),
            manager = params.find((v) => accounts.some((a) => a.staffId === v)),
            row = s().students.get(id);
          return row?.managerId === manager ? [{ card: rawCard(row) }] : [];
        }
        if (text.includes('SELECT x.id FROM')) {
          s().leadSql.push(parts);
          const manager = params.find((v) => accounts.some((a) => a.staffId === v));
          const phone = params.find((v) => typeof v === 'string' && /^\d{6,20}$/.test(v)),
            email = params.find((v) => typeof v === 'string' && v.includes('@'));
          const own = [...s().leads.values(), ...s().students.values()].filter(
            (r) => r.managerId === manager,
          );
          const found = own.find(
            (r) =>
              (phone && r.phone?.replace(/\D/g, '') === phone) ||
              (email && r.email?.trim().toLowerCase() === email),
          );
          return found ? [{ id: found.id }] : [];
        }
        if (text.includes('FROM leads WHERE id=')) return [{ id: params[0] }];
        if (text.includes('AS "conversion30dBp"')) {
          s().leadSql.push(parts);
          const manager = params.find((v) => accounts.some((a) => a.staffId === v)),
            own = [...s().leads.values()].filter((l) => l.managerId === manager);
          return [
            {
              countsByStage: {
                NEW: own.filter((l) => l.stage === 'NEW').length,
                IN_PROGRESS: own.filter((l) => l.stage === 'CONTACTED').length,
                TRIAL: own.filter((l) => ['TRIAL_DONE', 'TRIAL_SCHEDULED'].includes(l.stage))
                  .length,
                AWAITING_PAYMENT: own.filter((l) => l.stage === 'AWAITING_PAYMENT').length,
              },
              createdToday: own.length,
              trialsToday: 0,
              overdueFollowups: 0,
              conversion30dBp: 0,
            },
          ];
        }
        return raw(parts, ...values);
      });
    },
  });
  return { ...fx, subjectId, teacherId };
}
