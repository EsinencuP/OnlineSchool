// Synthetic component data only; never imported by a cabinet entry point.
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { SubjectSubscriptions } from '../../src/student-widgets.js';
import type { SubjectSubscriptionView } from '../../src/student-widgets.js';
import '@online-school/ui/style.css';
import '../../src/student.css';
const items: SubjectSubscriptionView[] = [
  ['Математика', 'ACTIVE', 5],
  ['Физика', 'EXPIRED', 0],
  ['Английский язык', 'FROZEN', 3],
].map(([subjectName, status, remaining], index) => ({
  subjectId: `subject-${index}`,
  subjectName: String(subjectName),
  subscription: {
    subscriptionId: `10000000-0000-4000-8000-00000000000${index + 1}`,
    planName: null,
    lessonsTotal: 8,
    lessonsRemaining: remaining as number,
    validFrom: '2026-10-01',
    validUntil: '2026-11-30',
    isFrozen: status === 'FROZEN',
    frozenFrom: status === 'FROZEN' ? '2026-11-01' : null,
    frozenUntil: status === 'FROZEN' ? '2026-11-15' : null,
    status: status as 'ACTIVE' | 'EXPIRED' | 'FROZEN',
  },
}));
createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <main className="k8k-access-screen">
      <h1>Компонент: абонементы по предметам</h1>
      <SubjectSubscriptions enabled items={items} />
      <SubjectSubscriptions enabled={false} items={items} />
    </main>
  </MemoryRouter>,
);
