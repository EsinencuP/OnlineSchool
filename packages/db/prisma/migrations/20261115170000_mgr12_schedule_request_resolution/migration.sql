-- Managers answer a teacher's schedule-change request by resolving its CRM task (PENDING -> RESOLVED).
GRANT UPDATE (status, updated_at) ON schedule_change_requests TO online_school_runtime;
