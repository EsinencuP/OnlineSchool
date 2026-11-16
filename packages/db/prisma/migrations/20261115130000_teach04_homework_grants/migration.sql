-- Teacher cabinet: the runtime role may issue homework and record reviews.
-- Rows stay append-only (immutability triggers) and validated by the existing education/review guards.
GRANT INSERT ON homework_assignments, homework_deliveries, submission_reviews TO online_school_runtime;
