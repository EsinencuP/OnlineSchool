export const reportId = (index) => '80000000-0000-4000-8000-' + String(index).padStart(12, '0');
export const oldReport = reportId(25);
export const english = '60000000-0000-4000-8000-000000000001';
export function reportFixture() {
  return {
    reportRows: Array.from({ length: 35 }, (_, index) => ({
      reportId: reportId(index + 1),
      subjectName: index === 24 ? 'Отчёт старше первой страницы' : 'Предмет ' + (index + 1),
      createdAt: new Date(Date.UTC(2026, 9, 31 - index, 12)).toISOString(),
      periodFrom: '2026-09-01',
      periodTo: '2026-09-30',
      lessonCount: 8,
      teacherName: 'Преподаватель ' + 'ДлиннаяФамилия'.repeat(9),
      isNew: true,
      content: {
        achievements: '  Достижения\nСтрока с пробелами  ',
        growthAreas: '<script>globalThis.BAD_REPORT = true</script>',
        recommendations: 'Практика чтения. ' + 'ПодробныйКомментарий'.repeat(22),
        teacherSignature: 'Подтверждено преподавателем',
        privateNotes: 'PRIVATE_TEACHER_NOTE',
      },
    })),
  };
}
