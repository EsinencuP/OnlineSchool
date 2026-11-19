BEGIN;

-- Preserve the original dead event and all terminal jobs. A failed replay releases
-- its slot while pending and delivered replays reserve the source event permanently.
CREATE UNIQUE INDEX uq_outbox_live_audit_replay ON public.outbox_events(aggregate_id)
  WHERE topic='ops.outbox.audit-replay.v1' AND status IN ('PENDING','DELIVERED');

COMMIT;
