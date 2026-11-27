import type { components } from '@online-school/api-contracts';

type S = components['schemas'];

// View data mirrors the /api/v1/director/* OpenAPI contracts, so the demo store can be
// replaced by HTTP calls without touching the screens.
export type DecisionItem = S['DecisionItemDto'];
export type DecisionKind = DecisionItem['kind'];
export type Escalation = S['EscalationDto'];
export type StaffItem = S['StaffItemDto'];
export type PayrollSummary = S['PayrollSummaryDto'];
export type PayrollTeacherRow = S['PayrollTeacherRowDto'];
export type Unresolved = S['UnresolvedDto'];
export type UnresolvedItem = S['UnresolvedItemDto'];
export type UnresolvedKind = UnresolvedItem['kind'];
export type Period = S['PeriodDto'];

/** `StaffItemDto.metrics` is an untyped object in OpenAPI; shapes follow director-staff.service.ts. */
export interface ManagerMetrics {
  students: number;
  leads: number;
  openTasks: number;
  openEscalations: number;
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'OFF_SHIFT';
}
export interface TeacherMetrics {
  activeStudents: number;
  lessonsNext7Days: number;
  futureLessons: number;
}

export interface DirectorState {
  me: { displayName: string };
  now: string;
  /** Non-payment decisions. Payment decisions come live from the payments the manager sent for approval. */
  decisions: DecisionItem[];
  escalations: Escalation[];
  staff: StaffItem[];
  payroll: PayrollSummary;
  unresolved: Unresolved;
  periods: Period[];
}
