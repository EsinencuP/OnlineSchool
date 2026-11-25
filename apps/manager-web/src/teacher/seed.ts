import type {
  AvailabilityWindow,
  Checkpoint,
  Enrollment,
  Goal,
  HomeworkItem,
  LessonReport,
  Material,
  PayrollLine,
  ScheduleRequest,
  TeacherLesson,
  TeacherNotification,
  TeacherSkill,
  TeacherState,
} from './types';

const H = 3600_000;
const D = 24 * H;
const id = (kind: number, n: number) =>
  `00000000-0000-4000-a${kind.toString(16).padStart(3, '0')}-${n.toString(16).padStart(12, '0')}`;

interface StudentSeed {
  name: string;
  grade: number;
  /** [weekday 0 = Monday, hour] regular weekly slots. */
  slots: [number, number][];
  confirmed: number;
  frozen?: boolean;
  sinceDays: number;
}

const STUDENTS: StudentSeed[] = [
  { name: 'Даниэла Ботнару', grade: 9, slots: [[1, 15], [3, 15]], confirmed: 12, sinceDays: 70 },
  { name: 'София Бужор', grade: 8, slots: [[0, 16], [2, 16]], confirmed: 8, sinceDays: 50 },
  { name: 'Егор Цуркан', grade: 4, slots: [[1, 17], [4, 17]], confirmed: 4, sinceDays: 20 },
  { name: 'Марк Олару', grade: 7, slots: [[0, 18], [3, 18]], confirmed: 6, sinceDays: 35 },
  { name: 'Ева Лунгу', grade: 7, slots: [[2, 14], [4, 15]], confirmed: 2, sinceDays: 9 },
  { name: 'Тимур Казаку', grade: 10, slots: [[2, 19]], confirmed: 9, frozen: true, sinceDays: 90 },
];

const SKILL_LIBRARY: [string, string][] = [
  ['Линейные уравнения', 'Алгебра'],
  ['Квадратные уравнения', 'Алгебра'],
  ['Теорема Виета', 'Алгебра'],
  ['Системы уравнений', 'Алгебра'],
  ['Неравенства', 'Алгебра'],
  ['Подобие треугольников', 'Геометрия'],
  ['Теорема Пифагора', 'Геометрия'],
  ['Окружность и углы', 'Геометрия'],
];
const STATUS_BY_LEVEL = ['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING'] as const;

export const RATE_TABLE = [
  { maxPoints: 4, rate: '200.00' },
  { maxPoints: 9, rate: '220.00' },
  { maxPoints: 10, rate: '250.00' },
];

export function createTeacherSeed(nowDate = new Date()): TeacherState {
  const now = nowDate.getTime();
  const dayStart = new Date(nowDate);
  dayStart.setHours(0, 0, 0, 0);
  const day0 = dayStart.getTime();
  const weekday = (dayStart.getDay() + 6) % 7;
  const monday = day0 - weekday * D;
  const iso = (t: number) => new Date(t).toISOString();
  const at = (days: number, hour: number) => iso(day0 + days * D + hour * H);

  const enrollments: Enrollment[] = STUDENTS.map((s, i) => ({
    enrollmentId: id(1, i + 1),
    studentId: id(2, i + 1),
    studentName: s.name,
    subjectId: id(3, 1),
    subjectName: 'Математика',
    assignedFrom: at(-s.sinceDays, 9),
    confirmedLessons: s.confirmed,
    nextLessonAt: null,
  }));

  // ---- lessons: previous, current and next week from weekly slots ----
  const lessons: TeacherLesson[] = [];
  const reports: Record<string, LessonReport> = {};
  let n = 0;
  for (let w = -1; w <= 1; w++) {
    STUDENTS.forEach((s, i) => {
      for (const [wd, hour] of s.slots) {
        const startsAt = monday + (w * 7 + wd) * D + hour * H;
        const endsAt = startsAt + H;
        n += 1;
        const lessonId = id(4, n);
        const past = endsAt <= now;
        // Two recent lessons are left without a report to show the 24 h rule.
        const unreported = past && now - endsAt < 3 * D && (i === 1 || i === 3);
        const status: TeacherLesson['status'] = s.frozen ? 'CANCELLED' : past ? (unreported ? 'SCHEDULED' : 'CONDUCTED') : 'SCHEDULED';
        lessons.push({
          lessonId,
          startsAt: iso(startsAt),
          endsAt: iso(endsAt),
          status,
          kind: 'REGULAR',
          studentId: id(2, i + 1),
          studentName: s.name,
          subjectCode: 'MATH',
          subjectName: 'Математика',
          joinOpensAt: iso(startsAt - 10 * 60_000),
          meetLinkState: i === 4 ? 'MISSING' : 'PRESENT',
          outcomeRecorded: status === 'CONDUCTED',
        });
        if (status === 'CONDUCTED') {
          reports[lessonId] = {
            reportId: id(5, n),
            version: 1,
            result: 'CONDUCTED',
            studentNoShow: false,
            actualStartedAt: iso(startsAt),
            durationMin: 60,
            note: 'Тема урока по плану, домашнее задание выдано.',
            reportedAt: iso(endsAt + 2 * H),
            current: true,
          };
        }
      }
    });
  }
  // A trial lesson tomorrow (diagnostics happen only in a trial, rule 9.14).
  n += 1;
  lessons.push({
    lessonId: id(4, n),
    startsAt: at(1, 12),
    endsAt: at(1, 13),
    status: 'SCHEDULED',
    kind: 'TRIAL',
    studentId: id(2, 50),
    studentName: 'Алиса Морарь',
    subjectCode: 'MATH',
    subjectName: 'Математика',
    joinOpensAt: iso(day0 + D + 12 * H - 10 * 60_000),
    meetLinkState: 'PRESENT',
    outcomeRecorded: false,
  });
  lessons.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const e of enrollments)
    e.nextLessonAt = lessons.find((l) => l.studentId === e.studentId && l.status === 'SCHEDULED' && l.startsAt > iso(now))?.startsAt ?? null;

  // ---- skills per enrollment ----
  const skills: Record<string, TeacherSkill[]> = {};
  enrollments.forEach((e, i) => {
    skills[e.enrollmentId] = SKILL_LIBRARY.map(([name, category], k) => {
      const level = Math.max(0, Math.min(3, Math.round((STUDENTS[i]!.confirmed / 4) - k * 0.45 + (k > 4 ? 1 : 0))));
      const status = STATUS_BY_LEVEL[level]!;
      return {
        skillId: id(6, k + 1),
        name,
        category,
        personal: false,
        status,
        assessedAt: status === 'NOT_STUDIED' ? null : at(-(k + 2) * 2, 16),
        assessedByName: status === 'NOT_STUDIED' ? null : 'Елена Морозан',
        publicComment: null,
        internalComment: null,
      };
    });
  });
  skills[id(1, 1)]!.push({
    skillId: id(6, 90),
    name: 'Аккуратность в вычислениях',
    category: 'Индивидуальные',
    personal: true,
    status: 'PRACTICING',
    assessedAt: at(-2, 16),
    assessedByName: 'Елена Морозан',
    publicComment: 'Стала реже терять знак — продолжаем проверку подстановкой.',
    internalComment: 'Спешит на контрольных, обсудить с родителем через менеджера.',
  });

  const goals: Goal[] = [
    { goalId: id(7, 1), enrollmentId: id(1, 1), text: 'Решать квадратные уравнения без ошибок к контрольной', targetDate: at(14, 0), status: 'ACTIVE', skillId: id(6, 2), createdAt: at(-20, 0), updatedAt: at(-2, 0) },
    { goalId: id(7, 2), enrollmentId: id(1, 1), text: 'Подготовиться к экзамену по алгебре на 8+', targetDate: at(120, 0), status: 'ACTIVE', skillId: null, createdAt: at(-40, 0), updatedAt: at(-9, 0) },
    { goalId: id(7, 3), enrollmentId: id(1, 2), text: 'Уверенно решать задачи на подобие', targetDate: at(30, 0), status: 'ACTIVE', skillId: id(6, 6), createdAt: at(-25, 0), updatedAt: at(-5, 0) },
    { goalId: id(7, 4), enrollmentId: id(1, 3), text: 'Таблица умножения без пауз', targetDate: null, status: 'ACHIEVED', skillId: null, createdAt: at(-18, 0), updatedAt: at(-4, 0) },
  ];

  // ---- homework ----
  const hw = (k: number, si: number, title: string, state: HomeworkItem['state'], issuedDays: number, dueDays: number | null, answer: string | null, reviews: HomeworkItem['reviews'] = []): HomeworkItem => {
    const dueAt = dueDays === null ? null : at(dueDays, 21);
    const submitted = answer !== null;
    return {
      deliveryId: id(8, k),
      enrollmentId: id(1, si + 1),
      title,
      description: 'Решить задания из карточки, показать ход решения.',
      issuedAt: at(issuedDays, 16),
      dueAt,
      state,
      studentId: id(2, si + 1),
      studentName: STUDENTS[si]!.name,
      subjectName: 'Математика',
      submissionCount: submitted ? reviews.length + 1 : 0,
      latestSubmittedAt: submitted ? at(issuedDays + 1, 19) : null,
      isLate: !submitted && dueAt !== null && dueAt < iso(now),
      answer,
      reviews,
    };
  };
  const homework: HomeworkItem[] = [
    hw(1, 0, 'Квадратные уравнения через дискриминант', 'NOT_SUBMITTED', -2, 2, null),
    hw(2, 1, 'Подобие: задачи 14–20', 'AWAITING_REVIEW', -3, 1, 'Задача 14: k = 3/2, AB = 9 см. Задача 15: …'),
    hw(3, 3, 'Проценты и пропорции', 'AWAITING_REVIEW', -4, -1, 'Ответы: 1) 240 2) 18% 3) 1,2 кг…'),
    hw(4, 2, 'Умножение многозначных чисел', 'NEEDS_REVISION', -6, -2, 'Столбиком: 345 × 12 = 4130…', [
      { reviewId: id(9, 1), result: 'NEEDS_REVISION', comment: 'Проверь перенос разряда во втором примере.', reviewedAt: at(-3, 18) },
    ]),
    hw(5, 0, 'Теорема Виета', 'REVIEWED', -9, -6, 'x1 + x2 = 7, x1·x2 = 12 …', [
      { reviewId: id(9, 2), result: 'ACCEPTED', comment: 'Отлично, всё верно.', reviewedAt: at(-6, 18) },
    ]),
    hw(6, 4, 'Входная диагностика: дроби', 'NOT_SUBMITTED', -5, -1, null),
  ];

  const checkpoints: Checkpoint[] = [
    { checkpointId: id(10, 1), type: 'LESSON_4', confirmedLessonCount: 12, triggeredAt: at(-2, 17), state: 'PENDING', completedAt: null, enrollmentId: id(1, 1), studentId: id(2, 1), studentName: STUDENTS[0]!.name, subjectName: 'Математика' },
    { checkpointId: id(10, 2), type: 'LESSON_8', confirmedLessonCount: 8, triggeredAt: at(-3, 17), state: 'PENDING', completedAt: null, enrollmentId: id(1, 2), studentId: id(2, 2), studentName: STUDENTS[1]!.name, subjectName: 'Математика' },
    { checkpointId: id(10, 3), type: 'LESSON_4', confirmedLessonCount: 4, triggeredAt: at(-4, 18), state: 'COMPLETED', completedAt: at(-3, 10), enrollmentId: id(1, 3), studentId: id(2, 3), studentName: STUDENTS[2]!.name, subjectName: 'Математика' },
  ];

  const materials: Material[] = [
    { fileId: id(11, 1), fileName: 'Квадратные уравнения — карточка.pdf', sizeBytes: 482_000, mimeType: 'application/pdf', status: 'VERIFIED', createdAt: at(-3, 12), activeGrants: 2, grantedTo: [id(2, 1), id(2, 4)] },
    { fileId: id(11, 2), fileName: 'Конспект: теорема Виета.pdf', sizeBytes: 310_000, mimeType: 'application/pdf', status: 'VERIFIED', createdAt: at(-10, 12), activeGrants: 1, grantedTo: [id(2, 1)] },
    { fileId: id(11, 3), fileName: 'Тренажёр — системы уравнений.xlsx', sizeBytes: 92_000, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', status: 'VERIFIED', createdAt: at(-6, 12), activeGrants: 1, grantedTo: [id(2, 1)] },
    { fileId: id(11, 4), fileName: 'Подобие треугольников — задачи.pdf', sizeBytes: 640_000, mimeType: 'application/pdf', status: 'VERIFIED', createdAt: at(-14, 12), activeGrants: 1, grantedTo: [id(2, 2)] },
    { fileId: id(11, 5), fileName: 'Диагностика 7 класс.docx', sizeBytes: 51_000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', status: 'PENDING', createdAt: at(0, 9), activeGrants: 0, grantedTo: [] },
  ];

  const availability: AvailabilityWindow[] = [
    ...[0, 1, 2, 3, 4].map((wd) => ({ id: id(12, wd + 1), weekday: wd, from: 14, to: 20 })),
    { id: id(12, 6), weekday: 5, from: 10, to: 14 },
  ];

  const nextMonLesson = lessons.find((l) => l.startsAt > at(5, 0) && l.status === 'SCHEDULED');
  const requests: ScheduleRequest[] = [
    {
      requestId: id(13, 1),
      kind: 'SINGLE_CANCEL',
      emergency: false,
      status: 'PENDING',
      createdAt: at(-1, 11),
      reason: 'Методическая конференция, прошу перенести урок',
      requestedStartAt: null,
      requestedEndAt: null,
      lessonId: nextMonLesson?.lessonId ?? null,
      slotId: null,
      lessonStartsAt: nextMonLesson?.startsAt ?? null,
      studentName: nextMonLesson?.studentName ?? 'София Бужор',
      subjectName: 'Математика',
    },
    {
      requestId: id(13, 2),
      kind: 'PERMANENT_CHANGE',
      emergency: false,
      status: 'RESOLVED',
      createdAt: at(-20, 11),
      reason: 'Сдвинуть пятничный слот на час позже со следующего понедельника',
      requestedStartAt: at(-13, 17),
      requestedEndAt: at(-13, 18),
      lessonId: null,
      slotId: id(14, 1),
      lessonStartsAt: null,
      studentName: 'Егор Цуркан',
      subjectName: 'Математика',
    },
  ];

  const note = (k: number, type: TeacherNotification['type'], si: number, hoursAgo: number, read: boolean, targetKind: TeacherNotification['targetKind'], lessonAt: string | null = null): TeacherNotification => ({
    key: id(15, k),
    type,
    occurredAt: iso(now - hoursAgo * H),
    read,
    studentName: STUDENTS[si]?.name ?? 'Алиса Морарь',
    subjectName: 'Математика',
    lessonAt,
    targetKind,
    targetId: id(16, k),
  });
  const notifications: TeacherNotification[] = [
    note(1, 'HOMEWORK_SUBMITTED', 1, 3, false, 'HOMEWORK'),
    note(2, 'LESSON_SCHEDULED', 99, 6, false, 'LESSON', at(1, 12)),
    note(3, 'CHECKPOINT_DUE', 1, 20, false, 'CHECKPOINT'),
    note(4, 'HOMEWORK_SUBMITTED', 3, 26, true, 'HOMEWORK'),
    note(5, 'SCHEDULE_REQUEST_RESOLVED', 2, 300, true, 'SCHEDULE_REQUEST'),
    note(6, 'LESSON_RESCHEDULED', 0, 400, true, 'LESSON', at(-1, 15)),
  ];

  // ---- payroll: conducted lessons of the current month ----
  const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
  const lines: PayrollLine[] = lessons
    .filter((l) => l.status === 'CONDUCTED' && new Date(l.startsAt).getTime() >= monthStart)
    .map((l) => ({
      outcomeId: id(17, Number.parseInt(l.lessonId.slice(-6), 16)),
      lessonStartedAt: l.startsAt,
      durationMin: 60,
      studentName: l.studentName,
      subjectName: l.subjectName,
      rate: '220.00',
      points: 9,
      rateBasis: '9 очков (стаж 6 + ученики 3) → 220 лей, снимок на начало урока',
      currency: 'MDL',
      amount: '220.00',
      paid: now - new Date(l.startsAt).getTime() > 7 * D ? '220.00' : '0.00',
      status: now - new Date(l.startsAt).getTime() > 7 * D ? 'PAID' : 'ACCRUED',
      accruedAt: iso(new Date(l.endsAt).getTime() + 3 * H),
      lastPaidAt: now - new Date(l.startsAt).getTime() > 7 * D ? at(-3, 12) : null,
    }));

  return {
    me: {
      teacherId: id(0, 1),
      displayName: 'Елена Морозан',
      role: 'TEACHER',
      activeStudentCount: STUDENTS.length,
      timezone: 'Europe/Chisinau',
      subjects: ['Математика'],
      seniorityMonths: 14,
    },
    now: iso(now),
    lessons,
    reports,
    enrollments,
    skills,
    goals,
    homework,
    checkpoints,
    publishedReports: {},
    materials,
    availability,
    limits: { perDay: 6, perWeek: 24, breakMin: 10 },
    requests,
    notifications,
    payroll: { month: `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`, lines },
  };
}
