import type {
  EducationalReport,
  HomeworkItem,
  LedgerEntry,
  LessonCard,
  LessonHistoryItem,
  MaterialItem,
  NotificationItem,
  Skill,
  StudentGoal,
  StudentState,
  SubjectAccess,
  SubscriptionDetails,
} from './types';

const H = 3600_000;
const D = 24 * H;
const id = (kind: number, n: number) =>
  `00000000-0000-4000-9${kind.toString(16).padStart(3, '0')}-${n.toString(16).padStart(12, '0')}`;

interface SubjectSeed {
  key: 'math' | 'eng' | 'phys';
  subjectId: string;
  name: string;
  teacher: string;
  /** Local weekdays (0 = Monday) and hour of the regular slot. */
  slots: [number, number][];
  total: number;
  remaining: number;
  validInDays: number;
  frozenDays?: number;
}

const SUBJECTS: SubjectSeed[] = [
  { key: 'math', subjectId: id(1, 1), name: 'Математика', teacher: 'Елена Морозан', slots: [[1, 15], [3, 15]], total: 8, remaining: 6, validInDays: 19 },
  { key: 'eng', subjectId: id(1, 2), name: 'Английский язык', teacher: 'Мария Русу', slots: [[2, 17]], total: 8, remaining: 2, validInDays: 6 },
  { key: 'phys', subjectId: id(1, 3), name: 'Физика', teacher: 'Андрей Чобану', slots: [[4, 16]], total: 8, remaining: 5, validInDays: 40, frozenDays: 9 },
];

export function createStudentSeed(nowDate = new Date()): StudentState {
  const now = nowDate.getTime();
  const dayStart = new Date(nowDate);
  dayStart.setHours(0, 0, 0, 0);
  const day0 = dayStart.getTime();
  const at = (days: number, hour: number, min = 0) => new Date(day0 + days * D + hour * H + min * 60_000).toISOString();
  const weekday = (dayStart.getDay() + 6) % 7;
  const iso = (t: number) => new Date(t).toISOString();

  // ---- upcoming lessons (next 14 days), physics is frozen so it has none ----
  const lessons: LessonCard[] = [];
  let n = 0;
  for (let d = 0; d < 14; d++) {
    const wd = (weekday + d) % 7;
    for (const s of SUBJECTS) {
      if (s.frozenDays) continue;
      for (const [slotDay, hour] of s.slots) {
        if (slotDay !== wd) continue;
        const startsAt = day0 + d * D + hour * H;
        if (startsAt + H <= now) continue;
        n += 1;
        lessons.push({
          lessonId: id(2, n),
          scheduledAt: iso(startsAt),
          durationMinutes: 60,
          teacherName: s.teacher,
          subjectName: s.name,
          subjectId: s.subjectId,
          status: 'SCHEDULED',
          canJoin: false,
          meetLink: `https://meet.google.com/${s.key}-dbt-2k`,
          canRequestReschedule: false,
        });
      }
    }
  }
  // A lesson that starts soon, so the "join" state is visible during the day.
  const hour = nowDate.getHours();
  const soon = hour >= 8 && hour < 20 ? Math.ceil((now + 8 * 60_000) / 60_000) * 60_000 : day0 + D + 11 * H;
  lessons.push({
    lessonId: id(2, 99),
    scheduledAt: iso(soon),
    durationMinutes: 60,
    teacherName: 'Елена Морозан',
    subjectName: 'Математика',
    subjectId: SUBJECTS[0]!.subjectId,
    originalScheduledAt: at(-1, 15),
    status: 'SCHEDULED',
    canJoin: false,
    meetLink: 'https://meet.google.com/math-dbt-2k',
    canRequestReschedule: false,
  });
  lessons.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  // ---- history ----
  const history: LessonHistoryItem[] = [];
  const histSeed: [number, number, number, LessonHistoryItem['attendanceStatus']][] = [
    [0, -2, 15, 'COMPLETED'],
    [1, -3, 17, 'COMPLETED'],
    [0, -5, 15, 'COMPLETED'],
    [2, -6, 16, 'COMPLETED'],
    [0, -7, 15, 'NO_SHOW'],
    [1, -10, 17, 'CANCELLED'],
    [0, -9, 15, 'COMPLETED'],
    [2, -13, 16, 'COMPLETED'],
    [0, -12, 15, 'COMPLETED'],
    [1, -17, 17, 'COMPLETED'],
    [0, -40, 15, 'COMPLETED'],
  ];
  const balance: Record<number, number> = { 0: 6, 1: 2, 2: 5 };
  histSeed.forEach(([si, d, h, st], i) => {
    const s = SUBJECTS[si]!;
    const deducted = st !== 'CANCELLED';
    const before = balance[si]! + (deducted ? 1 : 0);
    const item: LessonHistoryItem = {
      lessonId: id(3, i + 1),
      scheduledAt: at(d, h),
      durationMinutes: 60,
      teacherName: s.teacher,
      subjectName: s.name,
      attendanceStatus: st,
      lessonDeducted: deducted,
      balanceBefore: String(before),
      balanceAfter: String(deducted ? before - 1 : before),
      canDispute: deducted && d >= -30,
    };
    if (deducted) balance[si] = before;
    history.push(item);
  });

  // ---- access per subject (DEV-13: rights per subject) ----
  const subjects: SubjectAccess[] = SUBJECTS.map((s, i) => ({
    subjectId: s.subjectId,
    subjectName: s.name,
    enrollmentIds: [id(4, i + 1)],
    displayStatus: s.frozenDays ? 'FROZEN' : 'ACTIVE',
    reasonCode: s.frozenDays ? 'FROZEN' : 'PAID_RIGHTS',
    liveAccess: !s.frozenDays,
    capabilities: { canViewHomework: true, canViewMaterials: true, canOpenSubscription: true, canOpenLessons: !s.frozenDays },
    subscriptions: [
      {
        subscriptionId: id(5, i + 1),
        managerSubscriptionId: null,
        enrollmentId: id(4, i + 1),
        displayStatus: s.frozenDays ? 'FROZEN' : 'ACTIVE',
        reasonCode: s.frozenDays ? 'FROZEN' : 'PAID_RIGHTS',
        validUntil: at(s.validInDays, 20),
        frozenUntil: s.frozenDays ? at(s.frozenDays, 20) : null,
        paidLessonsRemaining: s.remaining,
        liveAccess: !s.frozenDays,
        temporaryAdmission: null,
      },
    ],
  }));

  const subscriptions: SubscriptionDetails[] = SUBJECTS.map((s, i) => ({
    subjectName: s.name,
    teacherName: s.teacher,
    subscriptionId: id(5, i + 1),
    planName: `${s.total} занятий · 60 мин`,
    lessonsTotal: s.total,
    lessonsRemaining: s.remaining,
    validFrom: at(s.validInDays - 56, 10),
    validUntil: at(s.validInDays, 20),
    isFrozen: Boolean(s.frozenDays),
    frozenFrom: s.frozenDays ? at(-5, 0) : null,
    frozenUntil: s.frozenDays ? at(s.frozenDays, 20) : null,
    status: s.frozenDays ? 'FROZEN' : 'ACTIVE',
  }));

  const ledger: LedgerEntry[] = [
    ...history
      .filter((h) => h.lessonDeducted)
      .map((h, i) => ({
        entryId: id(6, i + 1),
        entryDate: h.scheduledAt,
        type: 'DEDUCTION' as const,
        balanceBefore: h.balanceBefore,
        balanceAfter: h.balanceAfter,
        description: h.attendanceStatus === 'NO_SHOW' ? 'Урок списан: ученик не подключился' : 'Проведённый урок',
        lessonId: h.lessonId,
        subjectName: h.subjectName,
      })),
    { entryId: id(6, 50), entryDate: at(-5, 9), type: 'FREEZE' as const, balanceBefore: '5', balanceAfter: '5', description: 'Заморозка по заявлению семьи на 14 дней', lessonId: null, subjectName: 'Физика' },
    { entryId: id(6, 51), entryDate: at(-37, 12), type: 'CREDIT' as const, balanceBefore: '0', balanceAfter: '8', description: 'Новый абонемент: 8 занятий', lessonId: null, subjectName: 'Математика' },
    { entryId: id(6, 52), entryDate: at(-50, 12), type: 'CREDIT' as const, balanceBefore: '0', balanceAfter: '8', description: 'Новый абонемент: 8 занятий', lessonId: null, subjectName: 'Английский язык' },
  ].sort((a, b) => b.entryDate.localeCompare(a.entryDate));

  // ---- homework ----
  const hw = (
    k: number,
    subject: number,
    title: string,
    description: string,
    status: HomeworkItem['status'],
    assignedDays: number,
    dueDays: number | null,
    versions: HomeworkItem['versions'] = [],
    draft: string | null = null,
  ): HomeworkItem => {
    const s = SUBJECTS[subject]!;
    const dueAt = dueDays === null ? null : at(dueDays, 21);
    return {
      homeworkId: id(7, k),
      assignedAt: at(assignedDays, 16),
      dueAt,
      subjectName: s.name,
      teacherName: s.teacher,
      title,
      description,
      status,
      isLate: status === 'NOT_SUBMITTED' && dueAt !== null && dueAt < iso(now),
      draftContent: draft,
      latestVersion: versions.at(-1) ?? null,
      versions,
      attachments:
        k === 1
          ? [{ fileId: id(8, 1), fileName: 'Квадратные уравнения — карточка.pdf', fileSizeBytes: 482_000, mimeType: 'application/pdf' }]
          : [],
    };
  };
  const homework: HomeworkItem[] = [
    hw(1, 0, 'Квадратные уравнения через дискриминант', 'Решите № 3–10 из карточки. Для каждого уравнения запишите дискриминант и проверьте корни подстановкой.', 'NOT_SUBMITTED', -2, 2),
    hw(2, 0, 'Системы уравнений: способ подстановки', 'Решите 5 систем из учебника, стр. 112. Покажите ход решения.', 'NOT_SUBMITTED', -5, -1, [], 'Система 1: из первого уравнения y = 3 − x…'),
    hw(3, 1, 'Essay: A place I would like to visit', 'Напишите эссе на 150–180 слов. Используйте минимум 5 слов из урока 12.', 'NEEDS_REVISION', -6, 1, [
      { versionNumber: 1, content: 'I would like to visit Japan because it is very beautiful country…', submittedAt: at(-4, 19), teacherComment: 'Хорошая структура! Проверь артикли (a beautiful country) и добавь вывод в последнем абзаце.', teacherStatus: 'NEEDS_REVISION', attachments: [] },
    ]),
    hw(4, 1, 'Present Perfect vs Past Simple', 'Упражнения 4–7 в рабочей тетради.', 'SUBMITTED', -3, 2, [
      { versionNumber: 1, content: 'Ex. 4: 1 have seen, 2 went, 3 has lived…', submittedAt: at(-1, 18), teacherComment: null, teacherStatus: null, attachments: [] },
    ]),
    hw(5, 0, 'Теорема Виета', 'Найдите сумму и произведение корней без решения уравнения (8 заданий).', 'REVIEWED', -9, -6, [
      { versionNumber: 1, content: 'x1 + x2 = 7, x1·x2 = 12 …', submittedAt: at(-7, 20), teacherComment: 'Отлично, всё верно. Задание 7 можно решить короче — разберём на уроке.', teacherStatus: 'REVIEWED', attachments: [] },
    ]),
    hw(6, 2, 'Законы Ньютона: задачи 1–6', 'Самостоятельная работа на время заморозки: задачи 1–6, ответы сверить с конца сборника.', 'NOT_SUBMITTED', -6, 8),
  ];

  // ---- materials ----
  const mat = (k: number, subject: number, fileName: string, mimeType: string, size: number, days: number, lessonTitle: string | null): MaterialItem => ({
    fileId: id(8, k),
    fileName,
    fileSizeBytes: size,
    mimeType,
    subjectName: SUBJECTS[subject]!.name,
    subjectId: SUBJECTS[subject]!.subjectId,
    uploadedAt: at(days - 1, 12),
    sharedAt: at(days, 16),
    sharedByTeacherName: SUBJECTS[subject]!.teacher,
    lessonTitle,
    canDownload: true,
  });
  const materials: MaterialItem[] = [
    mat(1, 0, 'Квадратные уравнения — карточка.pdf', 'application/pdf', 482_000, -2, 'Дискриминант'),
    mat(2, 0, 'Конспект: теорема Виета.pdf', 'application/pdf', 310_000, -9, 'Теорема Виета'),
    mat(3, 0, 'Тренажёр — системы уравнений.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 92_000, -5, null),
    mat(4, 1, 'Irregular verbs — list.pdf', 'application/pdf', 210_000, -10, 'Past Simple'),
    mat(5, 1, 'Essay structure — template.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 48_000, -6, 'Writing'),
    mat(6, 2, 'Законы Ньютона — сборник задач.pdf', 'application/pdf', 1_240_000, -6, 'Динамика'),
  ];

  // ---- skills (rule 9.1) ----
  const sk = (k: number, subject: number, name: string, category: string, status: Skill['status'], days: number): Skill => ({
    skillId: id(9, k),
    name,
    category,
    status,
    lastUpdatedAt: at(days, 16),
    lastUpdatedByTeacherName: SUBJECTS[subject]!.teacher,
    subjectName: SUBJECTS[subject]!.name,
  });
  const skills: Skill[] = [
    sk(1, 0, 'Линейные уравнения', 'Алгебра', 'APPLYING', -30),
    sk(2, 0, 'Квадратные уравнения', 'Алгебра', 'PRACTICING', -2),
    sk(3, 0, 'Теорема Виета', 'Алгебра', 'PRACTICING', -9),
    sk(4, 0, 'Системы уравнений', 'Алгебра', 'FAMILIARIZING', -5),
    sk(5, 0, 'Неравенства', 'Алгебра', 'NOT_STUDIED', -30),
    sk(6, 0, 'Подобие треугольников', 'Геометрия', 'APPLYING', -20),
    sk(7, 0, 'Теорема Пифагора', 'Геометрия', 'APPLYING', -25),
    sk(8, 0, 'Окружность и углы', 'Геометрия', 'FAMILIARIZING', -12),
    sk(9, 1, 'Present Perfect', 'Grammar', 'PRACTICING', -3),
    sk(10, 1, 'Past Simple', 'Grammar', 'APPLYING', -17),
    sk(11, 1, 'Эссе и структура текста', 'Writing', 'FAMILIARIZING', -6),
    sk(12, 1, 'Аудирование B1', 'Listening', 'PRACTICING', -10),
    sk(13, 2, 'Кинематика', 'Механика', 'APPLYING', -20),
    sk(14, 2, 'Законы Ньютона', 'Механика', 'FAMILIARIZING', -6),
    sk(15, 2, 'Работа и энергия', 'Механика', 'NOT_STUDIED', -20),
  ];

  const goals: StudentGoal[] = [
    { goalId: id(10, 1), text: 'Решать квадратные уравнения без ошибок к контрольной', targetDate: at(14, 0), status: 'ACTIVE', skillId: id(9, 2), createdAt: at(-20, 0), updatedAt: at(-2, 0), subjectName: 'Математика', progress: 65 },
    { goalId: id(10, 2), text: 'Подготовиться к экзамену по алгебре на 8+', targetDate: at(120, 0), status: 'ACTIVE', skillId: null, createdAt: at(-40, 0), updatedAt: at(-9, 0), subjectName: 'Математика', progress: 40 },
    { goalId: id(10, 3), text: 'Писать эссе 180 слов за 30 минут', targetDate: at(30, 0), status: 'ACTIVE', skillId: id(9, 11), createdAt: at(-15, 0), updatedAt: at(-6, 0), subjectName: 'Английский язык', progress: 30 },
    { goalId: id(10, 4), text: 'Уверенно использовать Past Simple в речи', targetDate: null, status: 'ACHIEVED', skillId: id(9, 10), createdAt: at(-60, 0), updatedAt: at(-17, 0), subjectName: 'Английский язык', progress: 100 },
  ];

  const reports: EducationalReport[] = [
    {
      reportId: id(11, 1),
      subjectName: 'Математика',
      createdAt: at(-1, 18),
      periodFrom: at(-40, 0),
      periodTo: at(-2, 0),
      lessonCount: 8,
      teacherName: 'Елена Морозан',
      isNew: true,
      content: {
        achievements: 'Уверенно решает линейные уравнения и задачи на подобие. Освоила теорему Пифагора на уровне применения.',
        growthAreas: 'Квадратные уравнения: иногда теряет знак при вычислении дискриминанта. Системы — только начали.',
        recommendations: 'Каждый день 2–3 уравнения из тренажёра, проверка подстановкой. Следующий блок — системы и неравенства.',
        teacherSignature: 'Е. Морозан',
      },
    },
    {
      reportId: id(11, 2),
      subjectName: 'Английский язык',
      createdAt: at(-30, 18),
      periodFrom: at(-75, 0),
      periodTo: at(-31, 0),
      lessonCount: 8,
      teacherName: 'Мария Русу',
      isNew: false,
      content: {
        achievements: 'Past Simple — уверенно в речи и письме. Расширила словарь по теме «Путешествия».',
        growthAreas: 'Структура эссе, связки между абзацами.',
        recommendations: 'Одно короткое эссе в неделю по шаблону, читать адаптированные тексты уровня B1.',
        teacherSignature: 'М. Русу',
      },
    },
  ];

  const note = (k: number, type: NotificationItem['type'], title: string, body: string, hoursAgo: number, isRead: boolean): NotificationItem => ({
    notificationId: id(12, k),
    type,
    title,
    body,
    isRead,
    createdAt: iso(now - hoursAgo * H),
    payload: {},
  });
  const notifications: NotificationItem[] = [
    note(1, 'REPORT_READY', 'Готов образовательный отчёт', 'Математика: отчёт за 8 занятий от Елены Морозан.', 5, false),
    note(2, 'HOMEWORK_NEEDS_REVISION', 'Эссе нужно доработать', 'Мария Русу оставила комментарий к вашему эссе.', 30, false),
    note(3, 'SUBSCRIPTION_EXPIRING', 'Абонемент заканчивается', 'Английский язык: осталось 2 занятия. Менеджер свяжется с вами по продлению.', 48, false),
    note(4, 'SUBSCRIPTION_FROZEN', 'Абонемент заморожен', 'Физика: заморозка на 14 дней. Материалы и задания остаются доступны.', 120, true),
    note(5, 'HOMEWORK_REVIEWED', 'Задание проверено', 'Теорема Виета — проверено, отличная работа.', 150, true),
    note(6, 'LESSON_RESCHEDULED', 'Урок перенесён', 'Математика перенесена по согласованию с менеджером.', 200, true),
  ];

  return {
    me: {
      id: id(0, 1),
      userId: id(0, 2),
      displayName: 'Даниэла Ботнару',
      timeZone: 'Europe/Chisinau',
      email: 'student1@example.md',
      avatarUrl: null,
      hasActiveAccess: true,
      mustChangePassword: false,
      createdAt: at(-90, 10),
      grade: 9,
      managerContacts: { whatsapp: '', telegram: '', displayName: 'Кристина Делеу', phoneE164: null },
    },
    now: iso(now),
    subjects,
    subscriptions,
    ledger,
    lessons,
    history,
    homework,
    materials,
    skills,
    goals,
    reports,
    notifications,
    rescheduleRequests: [],
    disputes: [],
    pdfExport: 'IDLE',
  };
}
