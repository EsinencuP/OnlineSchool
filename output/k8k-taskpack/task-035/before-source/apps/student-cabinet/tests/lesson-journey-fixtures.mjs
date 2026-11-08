// Synthetic, local-only projections for TASK-029. No database or provider calls.
const lessonId = (n) => '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
const english = '60000000-0000-4000-8000-000000000001';
const math = '60000000-0000-4000-8000-000000000002';
const instant = (state, days) =>
  new Date(
    Date.parse(state.journeyAsOf ?? new Date().toISOString()) + days * 86400_000,
  ).toISOString();
export function journeyHistory(state) {
  if (!state.lessonJourney) return [];
  return Array.from({ length: 23 }, (_, i) => ({
    lessonId: lessonId(i + 3),
    subjectId: i % 2 ? math : english,
    subjectName: i % 2 ? 'Математика' : 'Английский язык',
    scheduledAt: instant(state, -i - 1),
    durationMinutes: i === 0 ? 55 : 50,
    teacherName:
      state.journeyTeacher ??
      (i === 0 ? 'Фактический преподаватель' : 'Александр Константинопольский'),
    attendanceStatus: i === 3 ? 'NO_SHOW' : i === 4 ? 'CANCELLED' : 'COMPLETED',
    lessonDeducted: i !== 2,
    balanceBefore: i === 1 || i === 2 ? null : i === 0 ? '9007199254740993' : '6',
    balanceAfter: i === 1 || i === 2 ? null : i === 0 ? '9007199254740992' : '5',
    canDispute:
      i !== 2 &&
      !(state.lessonRequests ?? []).some(
        (task) => task.lessonId === lessonId(i + 3) && task.type === 'ATTENDANCE_DISPUTE',
      ),
  }));
}
export function journeyLessons(state) {
  const future = Array.from({ length: state.calendarOverflow ? 65 : 2 }, (_, i) => ({
    lessonId: lessonId(i === 0 ? 1 : i + 100),
    scheduledAt: instant(state, i / 100 + 2),
    originalScheduledAt: instant(state, i / 100 + 1),
    meetAsOf: instant(state, 0),
    durationMinutes: 50,
    subjectId: i % 2 ? math : english,
    subjectName: i % 2 ? 'Математика' : 'Английский язык',
    teacherName: state.journeyTeacher ?? 'Назначенный преподаватель',
    status: i === 1 ? 'STAR_PENDING' : 'SCHEDULED',
    canJoin: false,
    meetLink: null,
    canRequestReschedule: i !== 1,
  }));
  if (state.calendarOverflow) return future;
  return [
    ...future,
    ...journeyHistory(state).map((item) => ({
      lessonId: item.lessonId,
      scheduledAt: item.scheduledAt,
      originalScheduledAt: item.scheduledAt,
      meetAsOf: instant(state, 0),
      durationMinutes: 50,
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      teacherName: 'Назначенный преподаватель',
      status: item.attendanceStatus,
      canJoin: false,
      meetLink: null,
      canRequestReschedule: false,
    })),
  ];
}
