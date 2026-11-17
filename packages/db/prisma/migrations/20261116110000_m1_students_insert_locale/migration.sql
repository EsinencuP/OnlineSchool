BEGIN;
-- Creating a student (manager or lead trial flow) sends the column default explicitly;
-- the runtime role could only UPDATE notification_locale, so every insert failed.
GRANT INSERT(notification_locale) ON students TO online_school_runtime;
COMMIT;
