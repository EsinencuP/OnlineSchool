export const english = '60000000-0000-4000-8000-000000000001';
export const math = '60000000-0000-4000-8000-000000000002';
export const historical = '60000000-0000-4000-8000-000000000003';
export const skill = '30000000-0000-4000-8000-000000000002';
const uuid = (n) => '31000000-0000-4000-8000-' + String(n).padStart(12, '0');
export function skillFixture() {
  const skillMaps = [
    {
      subjectId: english,
      subjectName: 'Английский язык',
      totalSkills: 4,
      skills: ['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING'].map((status, index) => ({
        skillId: index === 1 ? skill : uuid(index + 1),
        name: [
          'Новый навык',
          'Навык с очень длинным названием ' + 'ДлинноеНазвание'.repeat(12),
          'Разговорная речь',
          'Чтение',
        ][index],
        category: index === 0 ? '' : 'Практика языка',
        status,
        lastUpdatedAt: '2026-10-02T21:30:00Z',
        lastUpdatedByTeacherName: index === 0 ? '' : 'Елена Преподаватель',
      })),
      learningGoals: [
        {
          goalId: uuid(20),
          text: 'Рассказать о любимой книге',
          targetDate: null,
          isAchieved: false,
        },
        {
          goalId: uuid(21),
          text: 'Обсудить путешествие',
          targetDate: '2026-12-01',
          isAchieved: true,
        },
      ],
      lastSnapshotAt: '2026-10-28T12:00:00Z',
      nextSnapshotIn: 2,
    },
    {
      subjectId: math,
      subjectName: 'Математика',
      totalSkills: 0,
      skills: [],
      learningGoals: [],
      lastSnapshotAt: null,
      nextSnapshotIn: null,
    },
    {
      subjectId: historical,
      subjectName: 'Исторический предмет',
      totalSkills: 1,
      skills: [
        {
          skillId: uuid(30),
          name: 'Навык прошлого курса',
          category: '',
          status: 'PRACTICING',
          lastUpdatedAt: '2025-10-02T12:00:00Z',
          lastUpdatedByTeacherName: 'Прошлый преподаватель',
        },
      ],
      learningGoals: [],
      lastSnapshotAt: null,
      nextSnapshotIn: 4,
    },
  ];
  const skillSnapshots = Array.from({ length: 23 }, (_, index) => ({
    subjectId: english,
    snapshotId: uuid(100 + index),
    subjectName: 'Английский язык',
    createdAt: new Date(Date.UTC(2026, 9, 28 - index, 12)).toISOString(),
    lessonNumber: 4 * (23 - index),
    teacherSummary: index === 0 ? 'Срез подтверждён преподавателем' : null,
    skills: [
      {
        skillName: 'Старое название навыка',
        status: 'FAMILIARIZING',
        teacherComment: 'Публичный комментарий на момент среза',
      },
    ],
  }));
  skillSnapshots.splice(1, 0, {
    subjectId: historical,
    snapshotId: uuid(199),
    subjectName: 'Исторический предмет',
    createdAt: '2025-10-01T12:00:00Z',
    lessonNumber: 4,
    teacherSummary: null,
    skills: [],
  });
  const skillAudit = Array.from({ length: 23 }, (_, index) => ({
    auditId: uuid(200 + index),
    skillId: skill,
    skillName: 'Название при проверке',
    changedAt: new Date(Date.UTC(2026, 9, 28 - index, 12)).toISOString(),
    fromStatus: index === 0 ? 'APPLYING' : index === 1 ? 'PRACTICING' : 'NOT_STUDIED',
    toStatus: index === 0 ? 'PRACTICING' : index === 1 ? 'NOT_STUDIED' : 'FAMILIARIZING',
    teacherName: 'Елена Преподаватель',
    comment: index === 0 ? 'Возвращаемся к практике' : index === 1 ? 'Начинаем снова' : null,
    basis: 'PRIVATE_BASIS_NEVER_VISIBLE',
    privateNotes: 'PRIVATE_NOTES_NEVER_VISIBLE',
  }));
  return { skillMaps, skillSnapshots, skillAudit };
}
