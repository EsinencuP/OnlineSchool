import type { ReactNode } from 'react';

export interface PrioritySource {
  // The adapter must supply server-authorized priority/selection. Never infer it from dueAt.
  primary: { id: string; title: string; description?: string; action: ReactNode } | null;
  criticalCount: number;
  queueAction: ReactNode;
  important?: ReactNode;
}
export function PriorityEvents({
  source,
  enabled = false,
}: {
  source?: PrioritySource | undefined;
  enabled?: boolean;
}) {
  if (!enabled || !source) return null; // Explicit readiness flag + authoritative source required.
  return (
    <section className="k8k-priority-slot" aria-label="События, требующие внимания">
      <div className="k8k-critical" data-slot="critical">
        {source.primary && (
          <>
            <p className="k8k-priority-label">Требует действия</p>
            <h2>{source.primary.title}</h2>
            {source.primary.description && <p>{source.primary.description}</p>}
            {source.primary.action}
          </>
        )}
      </div>
      <div className="k8k-event-queue" data-slot="queue">
        <p>
          Критические события: <strong>{source.criticalCount}</strong>
        </p>
        {source.queueAction}
      </div>
      {source.important && <div className="k8k-important">{source.important}</div>}
    </section>
  );
}
