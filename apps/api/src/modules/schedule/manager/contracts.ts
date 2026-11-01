import type { LessonStatus } from '@online-school/db';
export type ChangeInitiator = 'STUDENT' | 'TEACHER' | 'ACADEMY';
export type ScheduleQuery = {
  from: string;
  to: string;
  studentId?: string;
  teacherId?: string;
  status?: LessonStatus;
};
export type CreateManagedLesson = {
  teacherId: string;
  startsAt: string;
  durationMinutes: number;
  subscriptionId?: string;
  meetLink?: string;
};
export type RescheduleManagedLesson = {
  newStartsAt: string;
  newTeacherId?: string;
  reason: string;
  overrideLateRule?: boolean;
  initiator?: ChangeInitiator;
};
export type CancelManagedLesson = {
  reason: string;
  chargeable: boolean;
  initiator?: ChangeInitiator;
  overrideLateRule?: boolean;
};
export type ManagedLessonView = {
  lessonId: string;
  studentId: string;
  teacherId: string;
  teacherName: string;
  startsAt: string;
  endsAt: string;
  status: LessonStatus;
  meetLink: string | null;
  subscriptionId: string | null;
  chargedLessons: number;
  pendingChangeId: string | null;
  requiresApproval: boolean;
};
export type DeductLesson = {
  studentId: string;
  lessonId: string;
  subscriptionId: string;
  reason: string;
};
export type ChangeApprovalReview = {
  id: string;
  lessonId: string;
  studentId: string;
  action: 'RESCHEDULE' | 'CANCEL';
  initiator: ChangeInitiator;
  reason: string;
  oldStartsAt: string;
  newStartsAt: string | null;
  oldTeacherId: string;
  newTeacherId: string | null;
  chargeable: boolean | null;
  status: 'PENDING' | 'APPROVED' | 'APPLIED' | 'STALE';
};
