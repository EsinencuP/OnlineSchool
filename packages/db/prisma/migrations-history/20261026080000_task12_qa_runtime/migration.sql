BEGIN;
CREATE TABLE runtime_heartbeats (
  instance_id text PRIMARY KEY,
  component text NOT NULL DEFAULT 'worker' CHECK (component='worker'),
  last_seen_at timestamptz(3) NOT NULL DEFAULT now(),
  stopped_at timestamptz(3),
  CONSTRAINT ck_heartbeat_stop CHECK (stopped_at IS NULL OR stopped_at>=last_seen_at)
);
CREATE INDEX runtime_heartbeats_component_last_seen_at_idx ON runtime_heartbeats(component,last_seen_at);
GRANT SELECT,INSERT,UPDATE ON runtime_heartbeats TO online_school_runtime;

-- Exposes one non-secret release identifier; runtime gets no direct access to migration history.
CREATE FUNCTION runtime_migration_version() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT migration_name FROM public._prisma_migrations
  WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  ORDER BY finished_at DESC,migration_name DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION runtime_migration_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION runtime_migration_version() TO online_school_runtime;
COMMIT;
