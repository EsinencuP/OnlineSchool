import type { components } from '@online-school/api-contracts';

type S = components['schemas'];

// All view data is shaped exactly like the backend OpenAPI contracts so the mock
// layer can be swapped for real `/api/v1/manager/*` calls without UI changes.
export type ManagerMe = Omit<S['ManagerMeResponseDto'], 'actorContext'>;
export type ManagerDashboard = S['ManagerDashboardDto'];
export type LeadSummary = S['LeadSummaryDto'];
export type Lead = S['LeadDto'];
export type LeadStage = Lead['stage'];
export type LeadSource = Lead['source'];
export type LeadLostReason = NonNullable<Lead['lostReason']>;
export type StudentListItem = S['StudentListItemDto'];
export type StudentCard = S['StudentCardDto'];
export type StudentStatus = StudentListItem['status'];
export type ManagerTask = S['ManagerTaskDto'];
export type TaskType = ManagerTask['type'];
export type TaskStatus = ManagerTask['status'];
export type ManagerLesson = S['ManagerLessonDto'];
export type LessonStatus = ManagerLesson['status'];
export type ManagerPayment = S['ManagerPaymentDto'];
export type PaymentStatus = ManagerPayment['status'];
export type ManagerSubscription = S['ManagerSubscriptionDto'];

/** Joined row used by the schedule/students screens (backend joins by id). */
export interface LessonView extends ManagerLesson {
  studentName: string;
  subjectName: string;
}

export interface PaymentView extends ManagerPayment {
  studentName: string;
}

export interface TeacherBrief {
  teacherId: string;
  name: string;
  subjects: string[];
}

export interface ManagerState {
  me: ManagerMe;
  now: string;
  leads: Lead[];
  students: StudentListItem[];
  cards: Record<string, StudentCard>;
  subscriptions: ManagerSubscription[];
  tasks: ManagerTask[];
  lessons: LessonView[];
  payments: PaymentView[];
  teachers: TeacherBrief[];
}
