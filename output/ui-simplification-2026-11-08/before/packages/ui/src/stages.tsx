import { StatusChip } from './controls.js';
import { useLocale } from './locale.js';

const steps = [
  ['FAMILIARIZING', 'stageFamiliarizing'],
  ['PRACTICING', 'stagePracticing'],
  ['APPLYING', 'stageApplying'],
] as const;
export type SkillStage = (typeof steps)[number][0] | 'NOT_STUDIED';

/** Renders a supplied stage. The presentation does not advance or assess it. */
export function StagesTrack({ label, stage }: { label: string; stage: SkillStage | null }) {
  const { t } = useLocale();
  return (
    <section className="k8k-stages-track" aria-label={label}>
      <p className="k8k-stages-label">{label}</p>
      {(stage === 'NOT_STUDIED' || stage === null) && (
        <StatusChip tone="neutral">
          {t(stage === null ? 'unknownStatus' : 'stageNotStudied')}
        </StatusChip>
      )}
      <ol role="list">
        {steps.map(([step, key]) => (
          <li key={step} aria-current={stage === step ? 'step' : undefined}>
            {t(key)}
          </li>
        ))}
      </ol>
    </section>
  );
}
