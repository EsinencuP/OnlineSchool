BEGIN;
-- CreateEnum
CREATE TYPE "ReportedLessonResult" AS ENUM ('CONDUCTED', 'NOT_CONDUCTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ScheduleRequestStatus" AS ENUM ('PENDING', 'RESOLVED');

-- AlterTable
ALTER TABLE "lesson_actual_outcomes" ADD COLUMN     "report_id" UUID;

-- AlterTable
ALTER TABLE "lesson_occurrences" ADD COLUMN     "confirmed_report_id" UUID,
ADD COLUMN     "occurrence_date" DATE;

-- AlterTable
ALTER TABLE "recurring_slots" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "lesson_outcome_reports" (
    "id" UUID NOT NULL,
    "lesson_occurrence_id" UUID NOT NULL,
    "reported_by_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "lesson_version" INTEGER NOT NULL,
    "result" "ReportedLessonResult" NOT NULL,
    "actual_started_at" TIMESTAMPTZ(3),
    "duration_min" INTEGER,
    "note" TEXT NOT NULL,
    "reported_at" TIMESTAMPTZ(3) NOT NULL,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_outcome_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_change_requests" (
    "id" UUID NOT NULL,
    "lesson_occurrence_id" UUID,
    "recurring_slot_id" UUID,
    "teacher_id" UUID NOT NULL,
    "requested_start_at" TIMESTAMPTZ(3),
    "requested_end_at" TIMESTAMPTZ(3),
    "reason" TEXT NOT NULL,
    "status" "ScheduleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_change_events" (
    "id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "old_values" JSONB NOT NULL,
    "new_values" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "server_recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_change_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_outcome_reports_source_operation_id_key" ON "lesson_outcome_reports"("source_operation_id");

-- CreateIndex
CREATE INDEX "lesson_outcome_reports_reported_by_id_idx" ON "lesson_outcome_reports"("reported_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_outcome_report_version" ON "lesson_outcome_reports"("lesson_occurrence_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_change_requests_source_operation_id_key" ON "schedule_change_requests"("source_operation_id");

-- CreateIndex
CREATE INDEX "schedule_change_requests_lesson_occurrence_id_idx" ON "schedule_change_requests"("lesson_occurrence_id");

-- CreateIndex
CREATE INDEX "schedule_change_requests_recurring_slot_id_idx" ON "schedule_change_requests"("recurring_slot_id");

-- CreateIndex
CREATE INDEX "schedule_change_requests_teacher_id_status_idx" ON "schedule_change_requests"("teacher_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "slot_change_events_source_operation_id_key" ON "slot_change_events"("source_operation_id");

-- CreateIndex
CREATE INDEX "slot_change_events_slot_id_idx" ON "slot_change_events"("slot_id");

-- CreateIndex
CREATE INDEX "slot_change_events_author_id_idx" ON "slot_change_events"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_actual_outcomes_report_id_key" ON "lesson_actual_outcomes"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_occurrences_confirmed_report_id_key" ON "lesson_occurrences"("confirmed_report_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_slot_occurrence_day" ON "lesson_occurrences"("recurring_slot_id", "occurrence_date");

-- AddForeignKey
ALTER TABLE "lesson_occurrences" ADD CONSTRAINT "fk_lesson_confirmed_report" FOREIGN KEY ("confirmed_report_id") REFERENCES "lesson_outcome_reports"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_actual_outcomes" ADD CONSTRAINT "fk_outcome_report" FOREIGN KEY ("report_id") REFERENCES "lesson_outcome_reports"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_outcome_reports" ADD CONSTRAINT "fk_report_lesson" FOREIGN KEY ("lesson_occurrence_id") REFERENCES "lesson_occurrences"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lesson_outcome_reports" ADD CONSTRAINT "fk_report_teacher" FOREIGN KEY ("reported_by_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "fk_schedule_request_lesson" FOREIGN KEY ("lesson_occurrence_id") REFERENCES "lesson_occurrences"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "fk_schedule_request_slot" FOREIGN KEY ("recurring_slot_id") REFERENCES "recurring_slots"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "fk_schedule_request_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teacher_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "slot_change_events" ADD CONSTRAINT "fk_slot_change_slot" FOREIGN KEY ("slot_id") REFERENCES "recurring_slots"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "slot_change_events" ADD CONSTRAINT "fk_slot_change_author" FOREIGN KEY ("author_id") REFERENCES "auth_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Stable local calendar-day key survives rescheduling and template time changes.
UPDATE lesson_occurrences l SET occurrence_date=(l.original_scheduled_at AT TIME ZONE s.timezone)::date
FROM recurring_slots s WHERE l.recurring_slot_id=s.id AND l.occurrence_date IS NULL;
ALTER TABLE lesson_occurrences ADD CONSTRAINT ck_occurrence_day_scope CHECK ((recurring_slot_id IS NULL)=(occurrence_date IS NULL));
ALTER TABLE recurring_slots ADD CONSTRAINT ck_slot_version CHECK(version>0);
ALTER TABLE lesson_outcome_reports ADD CONSTRAINT ck_report_payload CHECK(version>0 AND lesson_version>0 AND length(trim(note))>0 AND
 ((result='CONDUCTED' AND actual_started_at IS NOT NULL AND duration_min BETWEEN 1 AND 480) OR
  (result<>'CONDUCTED' AND actual_started_at IS NULL AND duration_min IS NULL)));
ALTER TABLE schedule_change_requests ADD CONSTRAINT ck_schedule_request_target CHECK(num_nonnulls(lesson_occurrence_id,recurring_slot_id)=1 AND length(trim(reason))>0 AND ((requested_start_at IS NULL AND requested_end_at IS NULL) OR (requested_start_at IS NOT NULL AND requested_end_at>requested_start_at)));
CREATE TRIGGER trg_t09_report_immutable BEFORE UPDATE OR DELETE ON lesson_outcome_reports FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
CREATE TRIGGER trg_t09_slot_history BEFORE UPDATE OR DELETE ON slot_change_events FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
ALTER TABLE teacher_availabilities ADD CONSTRAINT no_overlapping_availability EXCLUDE USING gist(teacher_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (cancelled_at IS NULL);
CREATE FUNCTION t09_guard_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lesson lesson_occurrences; report lesson_outcome_reports;
BEGIN
 IF TG_TABLE_NAME='lesson_occurrences' THEN
  IF ROW(NEW.id,NEW.enrollment_id,NEW.recurring_slot_id,NEW.original_scheduled_at,NEW.occurrence_date,NEW.source_operation_id) IS DISTINCT FROM ROW(OLD.id,OLD.enrollment_id,OLD.recurring_slot_id,OLD.original_scheduled_at,OLD.occurrence_date,OLD.source_operation_id) THEN
   RAISE EXCEPTION 'Lesson original identity is immutable' USING ERRCODE='23514',CONSTRAINT='ck_lesson_original_identity'; END IF;
  IF OLD.confirmed_report_id IS NOT NULL AND NEW.confirmed_report_id IS DISTINCT FROM OLD.confirmed_report_id THEN RAISE EXCEPTION 'Confirmed report is immutable' USING ERRCODE='23514'; END IF;
  IF NEW.confirmed_report_id IS NOT NULL THEN
   SELECT * INTO report FROM lesson_outcome_reports WHERE id=NEW.confirmed_report_id;
   IF report.lesson_occurrence_id IS DISTINCT FROM NEW.id OR report.lesson_version<>NEW.version THEN RAISE EXCEPTION 'Report lesson/version mismatch' USING ERRCODE='23514'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='lesson_outcome_reports' THEN
  SELECT * INTO lesson FROM lesson_occurrences WHERE id=NEW.lesson_occurrence_id;
  IF lesson.scheduled_teacher_id IS DISTINCT FROM NEW.reported_by_id OR lesson.version<>NEW.lesson_version OR NEW.reported_at<lesson.scheduled_end_at OR NEW.reported_at>clock_timestamp()+interval '1 second' THEN RAISE EXCEPTION 'Report teacher/version/time mismatch' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='lesson_actual_outcomes' THEN
  IF NEW.report_id IS NOT NULL THEN
   SELECT * INTO report FROM lesson_outcome_reports WHERE id=NEW.report_id;
   IF report.lesson_occurrence_id IS DISTINCT FROM NEW.lesson_occurrence_id OR report.reported_by_id IS DISTINCT FROM NEW.actual_teacher_id OR report.result<>'CONDUCTED' OR report.actual_started_at IS DISTINCT FROM NEW.actual_started_at OR report.duration_min IS DISTINCT FROM NEW.duration_min THEN RAISE EXCEPTION 'Confirmed outcome must match its report' USING ERRCODE='23514'; END IF;
  END IF;
 ELSE
  IF (to_jsonb(NEW)-'valid_to'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'valid_to'-'updated_at') OR (OLD.valid_to IS NOT NULL AND NEW.valid_to>OLD.valid_to) THEN RAISE EXCEPTION 'Teaching assignment history is immutable' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_t09_lesson_identity BEFORE UPDATE ON lesson_occurrences FOR EACH ROW EXECUTE FUNCTION t09_guard_schedule();
CREATE TRIGGER trg_t09_report BEFORE INSERT ON lesson_outcome_reports FOR EACH ROW EXECUTE FUNCTION t09_guard_schedule();
CREATE TRIGGER trg_t09_outcome_report BEFORE INSERT ON lesson_actual_outcomes FOR EACH ROW EXECUTE FUNCTION t09_guard_schedule();
CREATE TRIGGER trg_t09_assignment_history BEFORE UPDATE ON teaching_assignments FOR EACH ROW EXECUTE FUNCTION t09_guard_schedule();
GRANT SELECT,INSERT,UPDATE ON subjects,student_subject_enrollments,teaching_assignments,teacher_availabilities,recurring_slots,lesson_occurrences TO online_school_runtime;
GRANT SELECT,INSERT ON lesson_change_events,lesson_actual_outcomes,lesson_outcome_reports,slot_change_events,schedule_change_requests TO online_school_runtime;
GRANT UPDATE(id) ON teacher_accounts TO online_school_runtime;

COMMIT;
