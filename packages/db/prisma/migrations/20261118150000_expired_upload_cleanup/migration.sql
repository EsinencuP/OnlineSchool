BEGIN;

CREATE INDEX idx_homework_uploads_cleanup_expiry ON public.homework_uploads(expires_at, file_id);
CREATE INDEX idx_teacher_uploads_cleanup_expiry ON public.teacher_material_uploads(expires_at, file_id);

CREATE FUNCTION public.guard_upload_cleanup_reservation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.status IN ('QUARANTINED','DELETED') AND NEW.status IS DISTINCT FROM OLD.status
    AND NOT (OLD.status='QUARANTINED' AND NEW.status='DELETED')
    AND EXISTS (SELECT FROM public.outbox_events e WHERE e.event_key='storage:upload-cleanup:' || OLD.id::text
      AND e.topic='storage.upload-cleanup.v1' AND e.aggregate_id=OLD.id AND e.payload->>'mode'='ABANDONED') THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Reserved upload cannot be reopened';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_upload_cleanup_reservation BEFORE UPDATE OF status ON public.s3_objects
  FOR EACH ROW EXECUTE FUNCTION public.guard_upload_cleanup_reservation();

COMMIT;
