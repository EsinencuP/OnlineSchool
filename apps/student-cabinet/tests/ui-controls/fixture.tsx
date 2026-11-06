// UI-only test consumer. Routes and writes are intercepted by the local harness.
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { ControlsCatalog } from '../../../../packages/ui/stories/controls.stories.js';
import { Profile } from '../../src/pages/Account.js';
import type { StudentMeResponseDto } from '@online-school/api-contracts';
import '../../src/style.css';
import '@online-school/ui/style.css';
const params = new URLSearchParams(location.search);
const locale = params.get('locale') === 'ro' ? 'ro' : 'ru';
const role = params.get('role') === 'manager' ? 'manager' : 'student';
globalThis.document.documentElement.lang = locale;
const me = { displayName: 'Synthetic Ana', email: 'synthetic@example.test' } satisfies Pick<
  StudentMeResponseDto,
  'displayName' | 'email'
>;
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
createRoot(globalThis.document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <main className={`controls-lab k8k-role-${role}`}>
      {params.get('mode') === 'profile' ? (
        <MemoryRouter initialEntries={['/student/profile']}>
          <Routes>
            <Route element={<Outlet context={me} />}>
              <Route path="/student/profile" element={<Profile />} />
            </Route>
          </Routes>
        </MemoryRouter>
      ) : (
        <ControlsCatalog locale={locale} />
      )}
    </main>
  </QueryClientProvider>,
);
