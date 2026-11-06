import type { ReactNode } from 'react';
import { useLocale } from './locale.js';

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
  const { t } = useLocale();
  if (!enabled || !source) return null; // Explicit readiness flag + authoritative source required.
  return (
    <section className="k8k-priority-slot" aria-label={t('priorityAttention')}>
      <div className="k8k-critical" data-slot="critical">
        {source.primary && (
          <>
            <p className="k8k-priority-label">{t('priorityAction')}</p>
            <h2>{source.primary.title}</h2>
            {source.primary.description && <p>{source.primary.description}</p>}
            {source.primary.action}
          </>
        )}
      </div>
      <div className="k8k-event-queue" data-slot="queue">
        <p>
          {t('priorityCount')}: <strong>{source.criticalCount}</strong>
        </p>
        {source.queueAction}
      </div>
      {source.important && <div className="k8k-important">{source.important}</div>}
    </section>
  );
}
