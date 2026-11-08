import { createRoot } from 'react-dom/client';
import { Button } from '@online-school/ui';
import {
  AsyncConfirmation,
  GuardedOverlay,
  OverlaySpecimen,
} from '../../../../packages/ui/stories/overlays.stories.js';
import type { OverlayStoryArgs } from '../../../../packages/ui/stories/overlays.stories.js';
import '@online-school/ui/style.css';
const params = new URLSearchParams(location.search);
const locale = params.get('locale') === 'ro' ? 'ro' : 'ru';
const kinds = ['dialog', 'drawer', 'nonmodal', 'confirm', 'popover', 'menu'] as const;
const kind: OverlayStoryArgs['kind'] = kinds.find((k) => k === params.get('kind')) ?? 'dialog';
createRoot(globalThis.document.getElementById('root')!).render(
  <main
    className={`overlays-lab k8k-role-${params.get('role') === 'manager' ? 'manager' : 'student'}`}
  >
    <h1>{locale === 'ro' ? 'Exemple sintetice de ferestre' : 'Синтетические примеры окон'}</h1>
    <Button data-background variant="secondary">
      {locale === 'ro' ? 'Control în fundal' : 'Фоновая кнопка'}
    </Button>
    {params.get('kind') === 'async-confirm' ? (
      <AsyncConfirmation locale={locale} />
    ) : params.get('kind') === 'guard' ? (
      <GuardedOverlay locale={locale} />
    ) : (
      <OverlaySpecimen locale={locale} kind={kind} />
    )}
  </main>,
);
