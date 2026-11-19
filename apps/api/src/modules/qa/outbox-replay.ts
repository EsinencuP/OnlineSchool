import type { OutboxEvent, Prisma } from '@online-school/db';

export const OUTBOX_AUDIT_REPLAY_TOPIC = 'ops.outbox.audit-replay.v1';

type AuditReplaySource = Pick<
  OutboxEvent,
  'id' | 'aggregate_type' | 'aggregate_id' | 'source_operation_id'
>;
type AuditReplayLookup =
  | { status: 'missing' }
  | { status: 'ineligible' }
  | { status: 'eligible'; source: AuditReplaySource };

export async function loadAuditReplaySource(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<AuditReplayLookup> {
  const source = await tx.outboxEvent.findUnique({
    where: { id },
    select: {
      id: true,
      topic: true,
      status: true,
      last_error_code: true,
      schema_version: true,
      aggregate_type: true,
      aggregate_id: true,
      source_operation_id: true,
      payload: true,
      audit_event_ref: {
        select: { action: true, result: true, resource_id: true, source_operation_id: true },
      },
    },
  });
  if (!source) return { status: 'missing' };
  const { payload, audit_event_ref: audit } = source;
  if (
    source.status !== 'DEAD' ||
    source.topic !== 'auth.demo.switch.v1' ||
    source.last_error_code !== 'OUTBOX_HANDLER_NOT_REGISTERED' ||
    source.schema_version !== 1 ||
    source.aggregate_type !== 'Session' ||
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    payload.schemaVersion !== 1 ||
    payload.resourceId !== source.aggregate_id ||
    audit.action !== 'auth.demo.switch' ||
    audit.result !== 'SUCCESS' ||
    audit.resource_id !== source.aggregate_id ||
    audit.source_operation_id !== source.source_operation_id
  )
    return { status: 'ineligible' };

  return { status: 'eligible', source };
}
