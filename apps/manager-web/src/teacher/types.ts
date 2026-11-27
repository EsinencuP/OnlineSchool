import type { components } from '@online-school/api-contracts';

type S = components['schemas'];

// Shapes follow /api/v1/teacher/* contracts.
export type TeacherMe = Omit<S['TeacherMeResponseDto'], 'actorContext'> & {
  subjects: string[];
  seniorityMonths: number;
};
export type TeacherLesson = S['TeacherTodayLessonDto'];
export type TeacherLessonStatus = TeacherLesson['status'];
export type JournalItem = S['TeacherJournalItemDto'];
export type LessonReport = S['TeacherLessonReportDto'];
export type Enrollment = S['TeacherEnrollmentDto'];
export type HomeworkItem = S['TeacherHomeworkItemDto'] & {
  enrollmentId: string;
  description: string;
  answer: string | null;
  reviews: S['TeacherHomeworkReviewDto'][];
};
export type Checkpoint = S['TeacherCheckpointItemDto'];
export type TeacherSkill = S['TeacherSkillDto'] & { internalComment: string | null };
export type SkillStatus = TeacherSkill['status'];
export type Goal = S['TeacherGoalDto'] & { enrollmentId: string };
export type Material = S['TeacherMaterialDto'] & { grantedTo: string[] };
export type ScheduleRequest = S['TeacherScheduleRequestDto'] & { kind: RequestKind; emergency: boolean };
export type TeacherNotification = S['TeacherNotificationDto'];
export type PayrollLine = S['PayrollLineDto'];
export type PayrollTotal = S['PayrollTotalDto'];
export type ReportContent = S['EducationalReportContentDto'];

export type RequestKind = 'SINGLE_CANCEL' | 'PERMANENT_CHANGE' | 'ABSENCE';

/** Weekly availability template (SCH-02); local hours in the teacher timezone. */
export interface AvailabilityWindow {
  id: string;
  weekday: number;
  from: number;
  to: number;
}

export interface TeacherState {
  me: TeacherMe;
  now: string;
  lessons: TeacherLesson[];
  reports: Record<string, LessonReport>;
  enrollments: Enrollment[];
  skills: Record<string, TeacherSkill[]>;
  goals: Goal[];
  homework: HomeworkItem[];
  checkpoints: Checkpoint[];
  publishedReports: Record<string, ReportContent>;
  materials: Material[];
  availability: AvailabilityWindow[];
  limits: { perDay: number; perWeek: number; breakMin: number };
  requests: ScheduleRequest[];
  notifications: TeacherNotification[];
  payroll: { month: string; lines: PayrollLine[] };
  /** Previous months, oldest first — each item is one GET /teacher/payroll?month=YYYY-MM response. */
  payrollHistory: { month: string; lines: PayrollLine[] }[];
}
