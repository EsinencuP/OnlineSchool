import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  ActionResults,
  FormTabs,
  InformationCards,
  SupplementaryHelp,
} from '../../../../packages/ui/stories/composites.stories.js';
import { Lessons } from '../../src/pages/Lessons.js';
import { queryClient } from '../../src/api.js';
import '../../src/style.css';
import '@online-school/ui/style.css';

const params = new URLSearchParams(globalThis.location.search);
const locale = params.get('locale') === 'ro' ? 'ro' : 'ru';
const kind = params.get('kind');
createRoot(globalThis.document.getElementById('root')!).render(
  <main className={`composites-lab k8k-role-${kind === 'lessons' ? 'student' : 'manager'}`}>
    {kind === 'lessons' ? (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/student/lessons']}>
          <Lessons />
        </MemoryRouter>
      </QueryClientProvider>
    ) : (
      <>
        <h1>{locale === 'ro' ? 'Componente de interfață' : 'Компоненты интерфейса'}</h1>
        {kind === 'guard' ? (
          <FormTabs locale={locale} guarded />
        ) : (
          <>
            <FormTabs locale={locale} />
            <SupplementaryHelp locale={locale} />
            <InformationCards locale={locale} />
            <ActionResults
              locale={locale}
              request={async (outcome) =>
                (
                  await globalThis.fetch(`/fixture-result?outcome=${outcome}`, {
                    cache: 'no-store',
                  })
                ).status
              }
            />
          </>
        )}
      </>
    )}
  </main>,
);
