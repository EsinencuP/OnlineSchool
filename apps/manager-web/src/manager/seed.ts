import type {
  Lead,
  LeadSource,
  LeadStage,
  LessonView,
  ManagerState,
  ManagerSubscription,
  ManagerTask,
  PaymentView,
  StudentCard,
  StudentListItem,
  StudentStatus,
  TeacherBrief,
} from './types';

/** Deterministic UUID-shaped ids so the mock mirrors the backend id format. */
export const uid = (kind: number, n: number) =>
  `00000000-0000-4000-8${kind.toString(16).padStart(3, '0')}-${n.toString(16).padStart(12, '0')}`;

const H = 3600_000;
const D = 24 * H;

const iso = (base: number, offsetMs: number) => new Date(base + offsetMs).toISOString();

/** Start of the current hour so seeded times look like real schedule slots. */
const hourFloor = (t: number) => Math.floor(t / H) * H;

const TEACHERS: TeacherBrief[] = [
  { teacherId: uid(1, 1), name: 'Елена Морозан', subjects: ['Математика'] },
  { teacherId: uid(1, 2), name: 'Андрей Чобану', subjects: ['Физика', 'Химия'] },
  { teacherId: uid(1, 3), name: 'Мария Русу', subjects: ['Английский язык'] },
  { teacherId: uid(1, 4), name: 'Игорь Лупу', subjects: ['Информатика'] },
  { teacherId: uid(1, 5), name: 'Ольга Попа', subjects: ['История'] },
  { teacherId: uid(1, 6), name: 'Наталья Гуцу', subjects: ['Математика', 'Физика'] },
];

interface StudentSeed {
  name: string;
  status: StudentStatus;
  subject: string;
  teacher: number;
  phone: string;
  guardian: string | null;
  remaining: number;
  total: number;
  endsInDays: number;
  balance: string;
  hasAccount: boolean;
}

const STUDENTS: StudentSeed[] = [
  { name: 'Даниэла Ботнару', status: 'ACTIVE', subject: 'Математика', teacher: 0, phone: '+373 69 123 456', guardian: 'Ирина Ботнару', remaining: 6, total: 8, endsInDays: 19, balance: '1200.00', hasAccount: true },
  { name: 'Максим Чебан', status: 'ACTIVE', subject: 'Английский язык', teacher: 2, phone: '+373 78 220 114', guardian: 'Сергей Чебан', remaining: 1, total: 8, endsInDays: 3, balance: '0.00', hasAccount: true },
  { name: 'Александра Ротару', status: 'ACTIVE', subject: 'Физика', teacher: 1, phone: '+373 60 845 301', guardian: 'Татьяна Ротару', remaining: 11, total: 12, endsInDays: 40, balance: '2400.00', hasAccount: true },
  { name: 'Тимур Казаку', status: 'FROZEN', subject: 'Математика', teacher: 5, phone: '+373 69 554 210', guardian: 'Виктор Казаку', remaining: 4, total: 8, endsInDays: 31, balance: '600.00', hasAccount: true },
  { name: 'Вероника Гуцан', status: 'ACTIVE', subject: 'Информатика', teacher: 3, phone: '+373 79 003 552', guardian: null, remaining: 2, total: 8, endsInDays: 5, balance: '-450.00', hasAccount: true },
  { name: 'Никита Урсу', status: 'ACTIVE', subject: 'История', teacher: 4, phone: '+373 68 771 908', guardian: 'Людмила Урсу', remaining: 7, total: 8, endsInDays: 26, balance: '900.00', hasAccount: false },
  { name: 'Анастасия Мунтян', status: 'ACTIVE', subject: 'Английский язык', teacher: 2, phone: '+373 60 118 447', guardian: 'Олег Мунтян', remaining: 9, total: 12, endsInDays: 33, balance: '1800.00', hasAccount: true },
  { name: 'Артём Сырбу', status: 'EXPIRED', subject: 'Химия', teacher: 1, phone: '+373 69 909 016', guardian: 'Елена Сырбу', remaining: 0, total: 8, endsInDays: -4, balance: '0.00', hasAccount: true },
  { name: 'София Бужор', status: 'ACTIVE', subject: 'Математика', teacher: 0, phone: '+373 78 456 712', guardian: 'Анна Бужор', remaining: 5, total: 8, endsInDays: 14, balance: '750.00', hasAccount: true },
  { name: 'Илья Константинов', status: 'ACTIVE', subject: 'Физика', teacher: 5, phone: '+373 79 340 285', guardian: null, remaining: 3, total: 8, endsInDays: 6, balance: '300.00', hasAccount: true },
  { name: 'Полина Ника', status: 'FROZEN', subject: 'Английский язык', teacher: 2, phone: '+373 68 202 919', guardian: 'Дмитрий Ника', remaining: 6, total: 8, endsInDays: 45, balance: '1050.00', hasAccount: true },
  { name: 'Кирилл Балан', status: 'ACTIVE', subject: 'Информатика', teacher: 3, phone: '+373 60 667 031', guardian: 'Марина Балан', remaining: 10, total: 12, endsInDays: 38, balance: '2100.00', hasAccount: false },
];

interface LeadSeed {
  name: string;
  guardian: string | null;
  subject: string;
  stage: LeadStage;
  source: LeadSource;
  grade: number | null;
  createdHoursAgo: number;
  nextActionInHours: number | null;
  /** [dayOffset from today, local hour] */
  trialSlot?: [number, number];
  trialOutcome?: 'PENDING' | 'ATTENDED' | 'NO_SHOW';
  audience?: 'CHILD' | 'ADULT';
  comment?: string;
}

const LEADS: LeadSeed[] = [
  { name: 'Ева Лунгу', guardian: 'Кристина Лунгу', subject: 'Математика', stage: 'NEW', source: 'SITE', grade: 7, createdHoursAgo: 1, nextActionInHours: 1, comment: 'Подготовка к контрольной, удобно после 16:00' },
  { name: 'Марк Олару', guardian: 'Денис Олару', subject: 'Английский язык', stage: 'NEW', source: 'MESSENGER', grade: 5, createdHoursAgo: 3, nextActionInHours: -1 },
  { name: 'Виктория Пыслару', guardian: null, subject: 'Английский язык', stage: 'NEW', source: 'PHONE', grade: null, createdHoursAgo: 6, nextActionInHours: 2, audience: 'ADULT', comment: 'Разговорный английский для работы' },
  { name: 'Давид Гылкэ', guardian: 'Светлана Гылкэ', subject: 'Физика', stage: 'IN_PROGRESS', source: 'REFERRAL', grade: 9, createdHoursAgo: 28, nextActionInHours: 4 },
  { name: 'Арина Стратан', guardian: 'Павел Стратан', subject: 'Информатика', stage: 'IN_PROGRESS', source: 'SITE', grade: 8, createdHoursAgo: 50, nextActionInHours: -5 },
  { name: 'Лев Ткачук', guardian: 'Ольга Ткачук', subject: 'Математика', stage: 'IN_PROGRESS', source: 'SITE', grade: 6, createdHoursAgo: 70, nextActionInHours: 20 },
  { name: 'Алиса Морарь', guardian: 'Юлия Морарь', subject: 'История', stage: 'TRIAL', source: 'PHONE', grade: 10, createdHoursAgo: 96, nextActionInHours: 5, trialSlot: [1, 16], trialOutcome: 'PENDING' },
  { name: 'Егор Цуркан', guardian: 'Андрей Цуркан', subject: 'Математика', stage: 'TRIAL', source: 'REFERRAL', grade: 4, createdHoursAgo: 120, nextActionInHours: 2, trialSlot: [-1, 15], trialOutcome: 'ATTENDED' },
  { name: 'Ульяна Кожокару', guardian: 'Наталья Кожокару', subject: 'Химия', stage: 'TRIAL', source: 'MESSENGER', grade: 11, createdHoursAgo: 80, nextActionInHours: 26, trialSlot: [2, 17], trialOutcome: 'PENDING' },
  { name: 'Роман Попеску', guardian: 'Инна Попеску', subject: 'Английский язык', stage: 'AWAITING_PAYMENT', source: 'SITE', grade: 3, createdHoursAgo: 150, nextActionInHours: 8 },
  { name: 'Мирон Дабижа', guardian: 'Василий Дабижа', subject: 'Физика', stage: 'AWAITING_PAYMENT', source: 'REFERRAL', grade: 8, createdHoursAgo: 200, nextActionInHours: -26 },
  { name: 'Злата Чорба', guardian: 'Оксана Чорба', subject: 'Математика', stage: 'CONVERTED', source: 'SITE', grade: 5, createdHoursAgo: 260, nextActionInHours: null },
  { name: 'Глеб Рошка', guardian: 'Ирина Рошка', subject: 'Информатика', stage: 'LOST', source: 'PHONE', grade: 7, createdHoursAgo: 300, nextActionInHours: null },
];

/**
 * Closed leads of the last 30 days, so the 30-day conversion chart has real records behind it.
 * Deterministic: [name, subject, hours ago, converted?].
 */
const CLOSED_HISTORY: [string, string, number, boolean][] = [
  ['Ника Бурлаку', 'Математика', 30, true], ['Тимофей Ганя', 'Физика', 52, false], ['Мария Кироган', 'Английский язык', 75, true],
  ['Артур Лупашку', 'Информатика', 98, false], ['Дарина Мунтяну', 'Математика', 121, true], ['Платон Рябой', 'История', 146, false],
  ['Василиса Гуцу', 'Английский язык', 170, true], ['Матвей Чобану', 'Химия', 196, false], ['Ксения Попа', 'Математика', 219, false],
  ['Фёдор Дабижа', 'Физика', 243, true], ['Агата Стратан', 'Английский язык', 268, true], ['Илья Морарь', 'Информатика', 290, false],
  ['Алина Цуркан', 'Математика', 318, true], ['Степан Олару', 'История', 343, false], ['Вера Лунгу', 'Английский язык', 365, true],
  ['Савва Пыслару', 'Физика', 392, false], ['Милана Рошка', 'Математика', 414, true], ['Ян Кожокару', 'Химия', 440, false],
  ['Таисия Гылкэ', 'Английский язык', 463, false], ['Богдан Попеску', 'Информатика', 487, true], ['Ева Ткачук', 'Математика', 512, false],
  ['Лука Чорба', 'Физика', 536, true], ['Аня Бужор', 'Английский язык', 560, true], ['Дамир Урсу', 'История', 585, false],
  ['Соня Балан', 'Математика', 608, true], ['Кирилл Ника', 'Английский язык', 633, false], ['Елизавета Сырбу', 'Физика', 657, true],
  ['Марк Казаку', 'Информатика', 682, false],
];
const SOURCES: LeadSource[] = ['SITE', 'PHONE', 'REFERRAL', 'MESSENGER'];
LEADS.push(
  ...CLOSED_HISTORY.map(([name, subject, hours, won], k): LeadSeed => ({
    name,
    guardian: null,
    subject,
    stage: won ? 'CONVERTED' : 'LOST',
    source: SOURCES[k % SOURCES.length]!,
    grade: 5 + (k % 7),
    createdHoursAgo: hours,
    nextActionInHours: null,
  })),
);

const maskPhone = (p: string) => `${p.slice(0, 7)} ••• ${p.slice(-3)}`;

export function createSeed(nowDate = new Date()): ManagerState {
  const now = nowDate.getTime();
  const slot = hourFloor(now);
  const dayStart = new Date(nowDate);
  dayStart.setHours(0, 0, 0, 0);
  const day0 = dayStart.getTime();
  /** Local school-day time: days from today at a given hour. */
  const at = (days: number, hour: number) => iso(day0, days * D + hour * H);

  // --- subscriptions + students -----------------------------------------
  const subscriptions: ManagerSubscription[] = [];
  const students: StudentListItem[] = STUDENTS.map((s, i) => {
    const studentId = uid(2, i + 1);
    const sub: ManagerSubscription = {
      id: uid(3, i + 1),
      studentId,
      enrollmentId: uid(4, i + 1),
      planId: uid(5, s.total),
      status: s.status === 'FROZEN' ? 'FROZEN' : s.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
      startsAt: at(s.endsInDays - 56, 10),
      endsAt: at(s.endsInDays, 20),
      frozenUntil: s.status === 'FROZEN' ? at(9, 20) : null,
      totalLessons: s.total,
      remainingLessons: s.remaining,
      freezeDaysUsed: s.status === 'FROZEN' ? 14 : 0,
      price: s.total === 12 ? '3600.00' : '2400.00',
      currency: 'MDL',
    };
    subscriptions.push(sub);
    const balances = [{ currency: 'MDL', amount: s.balance }];
    return {
      studentId,
      fullName: s.name,
      status: s.status,
      hasAccount: s.hasAccount,
      maskedPhone: maskPhone(s.phone),
      activeSubscription:
        sub.status === 'ACTIVE' || sub.status === 'FROZEN'
          ? { id: sub.id, endsAt: sub.endsAt, remainingLessons: sub.remainingLessons, currency: 'MDL' }
          : null,
      balance: s.balance,
      balanceCurrency: 'MDL',
      balances,
      nextLessonAt: null,
      openTasksCount: 0,
      overdueTasksCount: 0,
    };
  });

  // --- lessons: current week, Mon..Sun, regular slots per active student ---
  const lessons: LessonView[] = [];
  const startOfToday = new Date(day0);
  const weekday = (startOfToday.getDay() + 6) % 7; // 0 = Monday
  const monday = startOfToday.getTime() - weekday * D;
  const SLOT_HOURS = [9, 11, 14, 15, 16, 17, 18, 19];
  let lessonN = 0;
  STUDENTS.forEach((s, i) => {
    if (s.status !== 'ACTIVE' && s.status !== 'FROZEN') return;
    const days = [i % 5, (i + 2) % 5 + (i % 2 ? 0 : 2)];
    days.forEach((day, k) => {
      const hour = SLOT_HOURS[(i + k * 3) % SLOT_HOURS.length] ?? 16;
      const startsAt = monday + day * D + hour * H;
      const teacher = TEACHERS[s.teacher]!;
      const past = startsAt + H < now;
      lessonN += 1;
      lessons.push({
        kind: 'REGULAR',
        lessonId: uid(6, lessonN),
        studentId: uid(2, i + 1),
        studentName: s.name,
        subjectName: s.subject,
        teacherId: teacher.teacherId,
        teacherName: teacher.name,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(startsAt + H).toISOString(),
        status:
          s.status === 'FROZEN'
            ? 'CANCELLED'
            : past
              ? i === 4 && k === 0
                ? 'DISPUTED'
                : 'CONDUCTED'
              : 'SCHEDULED',
        meetLink: i % 4 === 1 ? null : `https://meet.google.com/abc-${100 + i}-xyz`,
        subscriptionId: uid(3, i + 1),
        chargedLessons: past ? 1 : 0,
        pendingChangeId: null,
        requiresApproval: false,
      });
    });
  });
  // Today's guaranteed upcoming lessons so the dashboard is never empty.
  // Today's and tomorrow's lessons at fixed daytime hours so the dashboard
  // always has a realistic day, whatever time the demo is opened.
  ([[0, 10], [0, 13], [0, 17], [0, 19], [1, 11], [1, 16]] as const).forEach(([dayOffset, hour], k) => {
    const s = STUDENTS[[0, 6, 8, 2, 9, 11][k]!]!;
    const startMs = startOfToday.getTime() + dayOffset * D + hour * H;
    const idx = STUDENTS.indexOf(s);
    const teacher = TEACHERS[s.teacher]!;
    lessonN += 1;
    lessons.push({
      kind: 'REGULAR',
      lessonId: uid(6, lessonN),
      studentId: uid(2, idx + 1),
      studentName: s.name,
      subjectName: s.subject,
      teacherId: teacher.teacherId,
      teacherName: teacher.name,
      startsAt: iso(startMs, 0),
      endsAt: iso(startMs, H),
      status: startMs + H < now ? 'CONDUCTED' : 'SCHEDULED',
      meetLink: k === 1 || k === 4 ? null : `https://meet.google.com/day-${k}-now`,
      subscriptionId: uid(3, idx + 1),
      chargedLessons: startMs + H < now ? 1 : 0,
      pendingChangeId: null,
      requiresApproval: false,
    });
  });

  // --- leads ----------------------------------------------------------------
  const leads: Lead[] = LEADS.map((l, i) => {
    const leadId = uid(7, i + 1);
    const created = slot - l.createdHoursAgo * H;
    const teacher = TEACHERS[i % TEACHERS.length]!;
    const trialStart = l.trialSlot ? startOfToday.getTime() + l.trialSlot[0] * D + l.trialSlot[1] * H : null;
    const history: Lead['history'] = [{ from: null, to: 'NEW', at: iso(created, 0), byManager: false }];
    const order: LeadStage[] = ['NEW', 'IN_PROGRESS', 'TRIAL', 'AWAITING_PAYMENT', 'CONVERTED'];
    const reach = l.stage === 'LOST' ? 1 : order.indexOf(l.stage);
    for (let k = 1; k <= reach; k++)
      history.push({ from: order[k - 1]!, to: order[k]!, at: iso(created, k * 6 * H), byManager: true });
    if (l.stage === 'LOST')
      history.push({ from: 'IN_PROGRESS', to: 'LOST', at: iso(created, 30 * H), byManager: true });

    if (trialStart !== null) {
      lessonN += 1;
      lessons.push({
        kind: 'TRIAL',
        lessonId: uid(6, lessonN),
        studentId: uid(8, i + 1),
        studentName: l.name,
        subjectName: l.subject,
        teacherId: teacher.teacherId,
        teacherName: teacher.name,
        startsAt: new Date(trialStart).toISOString(),
        endsAt: new Date(trialStart + H).toISOString(),
        status: trialStart < now ? 'CONDUCTED' : 'SCHEDULED',
        meetLink: `https://meet.google.com/trial-${i}`,
        subscriptionId: null,
        chargedLessons: 0,
        pendingChangeId: null,
        requiresApproval: false,
        trialBrief: {
          leadId,
          audience: l.audience ?? 'CHILD',
          ageYears: null,
          grade: l.grade,
          level: null,
          subjectName: l.subject,
        },
      });
    }

    const phone = `+373 6${i % 10} ${100 + i * 7} ${200 + i * 3}`;
    return {
      leadId,
      stage: l.stage,
      audience: l.audience ?? 'CHILD',
      contactName: l.name,
      subjectName: l.subject,
      grade: l.grade,
      maskedPhone: maskPhone(phone),
      source: l.source,
      createdAt: iso(created, 0),
      stageChangedAt: history[history.length - 1]!.at,
      trialAt: trialStart === null ? null : new Date(trialStart).toISOString(),
      nextActionAt: l.nextActionInHours === null ? null : iso(slot, l.nextActionInHours * H),
      isOverdue: l.nextActionInHours !== null && l.nextActionInHours < 0,
      version: history.length,
      guardianName: l.guardian,
      phone,
      email: null,
      ageYears: null,
      level: null,
      comment: l.comment ?? null,
      studentId: l.stage === 'CONVERTED' ? uid(2, 9) : null,
      subjectId: uid(9, l.subject.length),
      lostReason: l.stage === 'LOST' ? 'SCHEDULE_MISMATCH' : null,
      lostComment: null,
      trial:
        trialStart === null
          ? null
          : {
              lessonId: uid(6, lessonN),
              startsAt: new Date(trialStart).toISOString(),
              endsAt: new Date(trialStart + H).toISOString(),
              teacherName: teacher.name,
              meetLink: `https://meet.google.com/trial-${i}`,
              outcome: l.trialOutcome ?? 'PENDING',
              feedbackStatus: l.trialOutcome === 'ATTENDED' ? 'SUBMITTED' : 'PENDING',
              feedbackSummary:
                l.trialOutcome === 'ATTENDED'
                  ? 'Хорошая база, нужна системная работа с текстовыми задачами. Рекомендую 2 урока в неделю.'
                  : null,
            },
      history,
      openTasks: [],
    };
  });

  // --- tasks ----------------------------------------------------------------
  const task = (
    n: number,
    type: ManagerTask['type'],
    studentName: string,
    dueInHours: number,
    payload: ManagerTask['payload'],
    extra: Partial<ManagerTask> = {},
  ): ManagerTask => ({
    taskId: uid(10, n),
    type,
    status: 'OPEN',
    version: 1,
    studentId: null,
    leadId: null,
    studentName,
    createdAt: iso(slot, (dueInHours - 24) * H),
    dueAt: iso(slot, dueInHours * H),
    isOverdue: dueInHours < 0,
    escalatedAt: null,
    approvalStatus: 'NONE',
    payload,
    ledgerPublicationId: null,
    ...extra,
  });
  const dispLesson = lessons.find((l) => l.status === 'DISPUTED');
  const tasks: ManagerTask[] = [
    task(1, 'LEAD_FOLLOWUP', 'Марк Олару', -1, { kind: 'TaskLeadPayloadDto', leadId: uid(7, 2) }, { leadId: uid(7, 2) }),
    task(2, 'LEAD_FOLLOWUP', 'Арина Стратан', -5, { kind: 'TaskLeadPayloadDto', leadId: uid(7, 5) }, { leadId: uid(7, 5), status: 'IN_PROGRESS' }),
    task(3, 'ASSIGN_TEACHER', 'Егор Цуркан', 2, { kind: 'TaskLeadPayloadDto', leadId: uid(7, 8) }, { leadId: uid(7, 8) }),
    task(4, 'RESCHEDULE_REQUEST', 'Анастасия Мунтян', 5, {
      kind: 'TaskReschedulePayloadDto',
      lessonId: lessons.find((l) => l.studentId === uid(2, 7))?.lessonId ?? uid(6, 1),
      currentStartsAt: at(2, 17),
      studentComment: 'В четверг соревнования, можно перенести на пятницу вечером?',
      preferredWindows: [{ from: at(3, 17), to: at(3, 20) }],
      preferredDate: null,
    }, { studentId: uid(2, 7) }),
    task(5, 'CHARGE_DISPUTE', 'Вероника Гуцан', -26, {
      kind: 'TaskDisputePayloadDto',
      lessonId: dispLesson?.lessonId ?? uid(6, 2),
      ledgerRef: 'LDG-2026-11-0418',
      chargedLessons: 1,
      chargedAmount: '300.00',
      currency: 'MDL',
      studentComment: 'Преподаватель подключился через 25 минут, урок фактически не состоялся.',
    }, { studentId: uid(2, 5), status: 'IN_PROGRESS', escalatedAt: iso(slot, -3 * H), approvalStatus: 'AWAITING_DIRECTOR' }),
    task(6, 'SUBSCRIPTION_EXPIRING', 'Максим Чебан', 20, { kind: 'TaskExpiringPayloadDto', subscriptionId: uid(3, 2), endsAt: at(3, 20) }, { studentId: uid(2, 2) }),
    task(7, 'SUBSCRIPTION_EXPIRING', 'Вероника Гуцан', 44, { kind: 'TaskExpiringPayloadDto', subscriptionId: uid(3, 5), endsAt: at(5, 20) }, { studentId: uid(2, 5) }),
    task(8, 'GENERAL', 'Никита Урсу', 26, { kind: 'TaskGeneralPayloadDto', text: 'Выдать доступ в личный кабинет и отправить инструкцию родителю.' }, { studentId: uid(2, 6) }),
    task(9, 'GENERAL', 'Мирон Дабижа', -26, { kind: 'TaskGeneralPayloadDto', text: 'Напомнить о счёте за первый абонемент, уточнить удобный способ оплаты.' }, { leadId: uid(7, 11) }),
    task(10, 'LEAD_FOLLOWUP', 'Глеб Рошка', -200, { kind: 'TaskLeadPayloadDto', leadId: uid(7, 13) }, { leadId: uid(7, 13), status: 'RESOLVED', isOverdue: false }),
  ];
  for (const lead of leads)
    lead.openTasks = tasks
      .filter((t) => t.leadId === lead.leadId && (t.status === 'OPEN' || t.status === 'IN_PROGRESS'))
      .filter((t): t is ManagerTask & { type: 'LEAD_FOLLOWUP' | 'ASSIGN_TEACHER' } =>
        t.type === 'LEAD_FOLLOWUP' || t.type === 'ASSIGN_TEACHER',
      )
      .map((t) => ({ taskId: t.taskId, type: t.type, dueAt: t.dueAt }));

  // --- payments ---------------------------------------------------------------
  const pay = (
    n: number,
    studentIdx: number,
    amount: string,
    status: PaymentView['status'],
    daysAgo: number,
    method: PaymentView['method'],
    purpose: PaymentView['purpose'],
  ): PaymentView => ({
    id: uid(11, n),
    studentId: uid(2, studentIdx + 1),
    studentName: STUDENTS[studentIdx]!.name,
    amount,
    currency: 'MDL',
    method,
    purpose,
    status,
    receivedAt: iso(slot, -daysAgo * D),
    externalRef: method === 'BANK_TRANSFER' ? `MAIB-${48210 + n}` : null,
    ledgerPublicationId: status === 'CONFIRMED' ? uid(12, n) : null,
    createdAt: iso(slot, -daysAgo * D + H),
    rejectionReason: status === 'REJECTED' ? 'Платёж не найден в выписке банка' : null,
  });
  const payments: PaymentView[] = [
    pay(1, 1, '2400.00', 'PENDING', 0, 'CARD', 'RENEWAL'),
    pay(2, 4, '2400.00', 'PENDING', 1, 'BANK_TRANSFER', 'RENEWAL'),
    pay(3, 9, '2400.00', 'AWAITING_APPROVAL', 1, 'CASH', 'RENEWAL'),
    pay(4, 2, '3600.00', 'CONFIRMED', 6, 'BANK_TRANSFER', 'FIRST_PAYMENT'),
    pay(5, 6, '3600.00', 'CONFIRMED', 9, 'ONLINE', 'RENEWAL'),
    pay(6, 0, '2400.00', 'CONFIRMED', 12, 'CARD', 'RENEWAL'),
    pay(7, 7, '2400.00', 'REJECTED', 4, 'BANK_TRANSFER', 'RENEWAL'),
    pay(8, 11, '3600.00', 'CONFIRMED', 15, 'CASH', 'FIRST_PAYMENT'),
  ];

  // --- denormalized student counters + cards ---------------------------------
  const cards: Record<string, StudentCard> = {};
  students.forEach((st, i) => {
    const seed = STUDENTS[i]!;
    const own = lessons
      .filter((l) => l.studentId === st.studentId && l.status === 'SCHEDULED' && l.startsAt > iso(now, 0))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    st.nextLessonAt = own[0]?.startsAt ?? null;
    const openT = tasks.filter(
      (t) => t.studentId === st.studentId && (t.status === 'OPEN' || t.status === 'IN_PROGRESS'),
    );
    st.openTasksCount = openT.length;
    st.overdueTasksCount = openT.filter((t) => t.isOverdue).length;
    cards[st.studentId] = {
      leadId: null,
      studentId: st.studentId,
      version: 1,
      fullName: st.fullName,
      status: st.status,
      hasAccount: st.hasAccount,
      contacts: {
        phone: seed.phone,
        email: `student${i + 1}@example.md`,
        guardianName: seed.guardian,
        guardianPhone: seed.guardian ? seed.phone.replace(/\d{3}$/, '777') : null,
      },
      managerNote: i % 3 === 0 ? 'Родитель просит отчёт после каждой контрольной.' : null,
      subscription: st.activeSubscription,
      balance: st.balance,
      balanceCurrency: 'MDL',
      balances: st.balances,
      upcomingLessons: own.slice(0, 3).map((l) => ({
        id: l.lessonId,
        startsAt: l.startsAt,
        subjectName: l.subjectName,
        teacherName: l.teacherName,
      })),
      openTasks: openT.map((t) => ({
        id: t.taskId,
        type: t.type,
        status: t.status,
        title: t.type,
        dueAt: t.dueAt,
      })),
      openTasksTruncated: false,
      recentPayments: payments
        .filter((p) => p.studentId === st.studentId && p.status !== 'REJECTED')
        .map((p) => ({
          id: uid(13, Number.parseInt(p.id.slice(-4), 16)),
          distributionId: uid(14, Number.parseInt(p.id.slice(-4), 16)),
          paymentId: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status as 'PENDING' | 'AWAITING_APPROVAL' | 'CONFIRMED',
          registeredAt: p.createdAt,
          confirmedAt: p.status === 'CONFIRMED' ? p.receivedAt : null,
        })),
      learning: {
        skillsMastered: 4 + ((i * 3) % 9),
        skillsTotal: 16,
        homeworkSubmitted: 6 + (i % 5),
        homeworkPending: i % 3,
        homeworkOverdue: i === 4 || i === 1 ? 2 : 0,
        lastReportAt: iso(slot, -((i % 6) + 2) * D),
        lastReportStatus: 'PUBLISHED',
      },
    };
  });

  return {
    me: {
      managerId: uid(0, 1),
      displayName: 'Кристина Делеу',
      role: 'MANAGER',
      portfolioSize: students.length,
      timezone: 'Europe/Chisinau',
      capabilities: [
        'LEADS_MANAGE',
        'STUDENTS_VIEW',
        'ACCOUNTS_CREATE',
        'PAYMENTS_REQUEST_APPROVAL',
        'SUBSCRIPTIONS_MANAGE',
        'SCHEDULE_MANAGE',
        'TASKS_PROCESS',
        'NOTIFICATIONS_SEND',
      ],
    },
    now: new Date(now).toISOString(),
    leads,
    students,
    cards,
    subscriptions,
    tasks,
    lessons: lessons.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    payments,
    teachers: TEACHERS,
  };
}
