export const MANAGER_TASK_TYPES = [
  'RESCHEDULE_REQUEST',
  'CHARGE_DISPUTE',
  'SUBSCRIPTION_EXPIRING',
  'GENERAL',
] as const;
export type ManagerTaskType = (typeof MANAGER_TASK_TYPES)[number];
export const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const;
export type ManagerTaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STORAGE_TYPES = [
  'RESCHEDULE_REQUEST',
  'ATTENDANCE_DISPUTE',
  'SUBSCRIPTION_EXPIRING',
  'MANUAL',
] as const;
export const TYPE_STORAGE = {
  RESCHEDULE_REQUEST: 'RESCHEDULE_REQUEST',
  CHARGE_DISPUTE: 'ATTENDANCE_DISPUTE',
  SUBSCRIPTION_EXPIRING: 'SUBSCRIPTION_EXPIRING',
  GENERAL: 'MANUAL',
} as const;
export type TaskPayload =
  | {
      kind: 'RESCHEDULE_REQUEST';
      lessonId: string;
      currentStartsAt: string;
      studentComment: string | null;
      preferredWindows: { from: string; to: string }[];
      preferredDate: string | null;
    }
  | {
      kind: 'CHARGE_DISPUTE';
      lessonId: string;
      ledgerRef: string | null;
      chargedLessons: number;
      chargedAmount: string | null;
      currency: string | null;
      studentComment: string;
    }
  | { kind: 'SUBSCRIPTION_EXPIRING'; subscriptionId: string; endsAt: string }
  | { kind: 'GENERAL'; text: string };
export type TaskQuery = {
  status?: ManagerTaskStatus[];
  type?: ManagerTaskType[];
  overdue?: boolean;
  studentId?: string;
  dueBefore?: string;
  cursor?: string;
  limit: number;
};
export type ResolveTaskReschedule = {
  decision: 'APPROVE' | 'DECLINE';
  newStartsAt?: string;
  newTeacherId?: string;
  reason?: string;
  overrideLateRule?: boolean;
  version: number;
};
export type ResolveTaskDispute = {
  decision: 'ACCEPT' | 'REJECT' | 'ESCALATE';
  reason: string;
  refundAmount?: string;
  refundLessons?: number;
  version: number;
};
export type TaskView = {
  taskId: string;
  type: ManagerTaskType;
  status: ManagerTaskStatus;
  version: number;
  studentId: string;
  studentName: string;
  createdAt: string;
  dueAt: string;
  isOverdue: boolean;
  escalatedAt: string | null;
  approvalStatus:
    'NONE' | 'AWAITING_DIRECTOR' | 'MANUAL_FINANCE_REVIEW' | 'AWAITING_SCHEDULE_APPROVAL';
  payload: TaskPayload;
  ledgerPublicationId: string | null;
};
export type TaskDetail = TaskView & { resolution: Record<string, unknown> | null };
export type TaskPage = { items: TaskView[]; nextCursor: string | null };
