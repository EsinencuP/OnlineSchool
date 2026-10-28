-- Commit enum values in a separate migration before using them in the unique index.
ALTER TYPE "CrmTaskType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_DISPUTE';
ALTER TYPE "CrmTaskStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
