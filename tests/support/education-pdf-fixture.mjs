export const fixtureIds = {
  student: '10000000-0000-4000-8000-000000000001',
  other: '10000000-0000-4000-8000-000000000002',
  subject: '20000000-0000-4000-8000-000000000001',
  job: '30000000-0000-4000-8000-000000000001',
  account: '40000000-0000-4000-8000-000000000001',
};
export function educationPdfFixture() {
  return {
    schemaVersion: 1,
    studentName: 'Учебный пример: Ștefania и Родион',
    asOf: '2026-10-27T12:00:00.000Z',
    timeZone: 'Europe/Chisinau',
    periodFrom: '2026-09-01',
    periodTo: '2026-10-27',
    skills: [
      {
        subjectId: fixtureIds.subject,
        subjectName: 'Математика',
        totalSkills: 4,
        lastSnapshotAt: null,
        nextSnapshotIn: 4,
        skills: ['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING'].map((status, i) => ({
          skillId: `50000000-0000-4000-8000-00000000000${i}`,
          name: [
            'Десятичные дроби',
            'Сравнение дробей',
            'Действия с дробями',
            'Решение текстовых задач',
          ][i],
          category: 'Числа и вычисления',
          status,
          lastUpdatedAt: '2026-10-20T12:00:00Z',
          lastUpdatedByTeacherName: 'Демонстрационный учитель',
        })),
        learningGoals: [
          {
            goalId: '60000000-0000-4000-8000-000000000001',
            text: 'Объяснять ход решения своими словами',
            targetDate: '2026-11-01',
            isAchieved: false,
          },
          {
            goalId: '60000000-0000-4000-8000-000000000002',
            text: 'Уверенно сравнивать дроби с одинаковым знаменателем',
            targetDate: null,
            isAchieved: true,
          },
        ],
      },
    ],
    reports: [1, 2].map((n) => ({
      reportId: `70000000-0000-4000-8000-00000000000${n}`,
      subjectName: 'Математика',
      createdAt: `2026-10-${n === 1 ? '01' : '21'}T12:00:00.000Z`,
      periodFrom: n === 1 ? '2026-09-01' : '2026-10-01',
      periodTo: n === 1 ? '2026-09-30' : '2026-10-20',
      lessonCount: 8,
      teacherName: 'Демонстрационный учитель',
      isNew: n === 2,
      content: {
        achievements:
          'Ученик объясняет выбор действия и проверяет ответ. Уверенно сравнивает дроби и приводит примеры из повседневной жизни.',
        growthAreas:
          'Продолжить работу с многошаговыми задачами. Внимательно читать условие и отделять известные величины от искомых.',
        recommendations:
          'Обсуждать по одной задаче в день. Сначала сформулировать план словами, затем записать вычисления и самостоятельно проверить результат.',
        teacherSignature: 'Демонстрационный учитель - учебный пример, синтетические данные.',
      },
    })),
    lessons: Array.from({ length: 24 }, (_, i) => ({
      lessonId: `80000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      date: `2026-${i < 8 ? '09' : '10'}-${String(i < 8 ? i + 1 : i - 7).padStart(2, '0')}T12:00:00.000Z`,
      subjectName: 'Математика',
      teacherName: 'Демонстрационный учитель',
      status: i < 16 ? 'COMPLETED' : i % 2 === 0 ? 'NO_SHOW' : 'CANCELLED',
    })),
  };
}
