-- Manager CRM cards read the latest educational report through their existing portfolio scope.
-- Earlier dashboard grants covered homework/skills but omitted these two report tables.
BEGIN;
GRANT SELECT ON education_reports,progress_checkpoints TO online_school_runtime;
COMMIT;
