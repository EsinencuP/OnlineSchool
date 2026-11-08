export const fileId = (n) => '74000000-0000-4000-8000-' + String(n).padStart(12, '0');
export const sessionId = (n) => '75000000-0000-4000-8000-' + String(n).padStart(12, '0');
export const english = '60000000-0000-4000-8000-000000000001';
export const math = '60000000-0000-4000-8000-000000000002';
export function localeFixture() {
  return {
    timeZone: 'America/New_York',
    displayName: 'Alias ' + 'Nume'.repeat(18),
    fullName: 'Имя в школьном реестре — не alias',
    email: 'student@example.invalid',
    subjectHub: true,
    materialRows: Array.from({ length: 35 }, (_, index) => ({
      fileId: fileId(index + 1),
      fileName:
        index === 1
          ? 'Материал'
          : 'Учительский_файл_' + 'Комментарий'.repeat(index === 0 ? 12 : 1) + '.pdf',
      fileNameIsFallback: index === 1,
      subjectId: index === 1 ? null : index % 2 ? math : english,
      subjectName: index === 1 ? 'Без предмета' : index % 2 ? 'Математика' : 'Английский язык',
      canDownload: index % 2 === 0,
      fileSizeBytes: 245000,
      mimeType: 'application/pdf',
      uploadedAt: '2026-11-01T12:00:00Z',
      sharedAt: '2026-11-07T12:00:00Z',
      sharedByTeacherName: 'Имя преподавателя — ' + 'Lung'.repeat(14),
      lessonTitle: index === 1 ? null : 'Авторское название урока',
      lessonId: '10000000-0000-4000-8000-000000000001',
    })),
    sessionRows: [
      {
        sessionId: sessionId(1),
        createdAt: '2026-11-01T12:00:00Z',
        lastActiveAt: '2026-11-07T12:00:00Z',
        userAgent: 'Chromium',
        ipAddress: '127.0.0.1',
        isCurrent: true,
      },
      {
        sessionId: sessionId(2),
        createdAt: '2026-11-01T12:00:00Z',
        lastActiveAt: '2026-11-07T12:00:00Z',
        userAgent: 'Другой браузер ' + 'Lung'.repeat(18),
        ipAddress: '',
        isCurrent: false,
      },
    ],
  };
}
