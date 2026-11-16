-- Teacher cabinet: the runtime role may record skill assessments. Rows stay append-only and are
-- validated (assigned teacher, subject, revision chain, confirmed evidence lesson) by stu08_record_skill();
-- the audit row is written by that SECURITY DEFINER trigger.
GRANT INSERT ON skill_assessments TO online_school_runtime;
