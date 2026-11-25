import type { components } from '@online-school/api-contracts';

type S = components['schemas'];

// Shapes follow /api/v1/student/* contracts exactly.
export type StudentMe = Omit<S['StudentMeResponseDto'], 'managerContacts'> & {
  managerContacts: S['ManagerContactsDto'];
  grade: number;
};
export type StudentDashboard = S['DashboardResponseDto'];
export type LessonCard = S['LessonCardDto'];
export type LessonStatus = LessonCard['status'];
export type LessonHistoryItem = S['LessonHistoryItemDto'];
export type HomeworkItem = S['HomeworkItemDto'];
export type HomeworkStatus = HomeworkItem['status'];
export type MaterialItem = S['MaterialItemDto'];
export type Skill = S['SkillDto'] & { subjectName: string };
export type SkillStatus = Skill['status'];
export type EducationalReport = S['EducationalReportDto'];
export type NotificationItem = S['NotificationItemDto'];
export type SubjectAccess = S['StudentSubjectDto'];
export type SubscriptionDetails = S['SubscriptionDetailsDto'] & { subjectName: string; teacherName: string };
export type LedgerEntry = S['StudentSubscriptionLedgerEntryDto'] & { subjectName: string };

/** Goals are agreed with the teacher (rule 9.10) and shown read-only to the student. */
export type StudentGoal = S['TeacherGoalDto'] & { subjectName: string; progress: number };

export interface RescheduleRequest {
  lessonId: string;
  createdAt: string;
  preferredDate: string;
  comment: string;
  status: 'SENT';
}

export interface StudentState {
  me: StudentMe;
  now: string;
  subjects: SubjectAccess[];
  subscriptions: SubscriptionDetails[];
  ledger: LedgerEntry[];
  lessons: LessonCard[];
  history: LessonHistoryItem[];
  homework: HomeworkItem[];
  materials: MaterialItem[];
  skills: Skill[];
  goals: StudentGoal[];
  reports: EducationalReport[];
  notifications: NotificationItem[];
  rescheduleRequests: RescheduleRequest[];
  disputes: string[];
  pdfExport: 'IDLE' | 'PREPARING' | 'READY';
}
