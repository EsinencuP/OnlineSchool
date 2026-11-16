-- One command (source_operation_id) records at most one operation of each type, so a replayed
-- command cannot duplicate a manager subscription operation. Fails loudly if duplicates exist.
CREATE UNIQUE INDEX uq_manager_subscription_operations_source_type
  ON manager_subscription_operations (source_operation_id, type);
