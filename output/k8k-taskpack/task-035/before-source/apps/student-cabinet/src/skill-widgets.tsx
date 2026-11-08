import { StatusChip } from '@online-school/ui';
import type { SkillDto } from '@online-school/api-contracts';
import { useSkillCopy } from './skill-copy.js';

export function SkillStatus({ status }: { status: SkillDto['status'] }) {
  const { statusLabel } = useSkillCopy();
  return (
    <StatusChip
      tone={status === 'NOT_STUDIED' ? 'neutral' : status === 'APPLYING' ? 'success' : 'info'}
      data-skill-status={status}
    >
      {statusLabel(status)}
    </StatusChip>
  );
}
export function StagesTrack() {
  const { text, statusLabel } = useSkillCopy();
  return (
    <div className="k8k-skill-stages">
      <ol className="k8k-stages" aria-label={text('stages')}>
        {(['FAMILIARIZING', 'PRACTICING', 'APPLYING'] as const).map((status) => (
          <li key={status}>
            <span>{statusLabel(status)}</span>
          </li>
        ))}
      </ol>
      <p className="k8k-student-caption">{text('stageHelp')}</p>
    </div>
  );
}
