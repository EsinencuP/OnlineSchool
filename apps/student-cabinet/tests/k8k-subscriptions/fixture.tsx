// Synthetic component data only. The production read goes through the student API.
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { StudentSubjectDto } from '@online-school/api-contracts';
import { SubjectSubscriptions } from '../../src/student-widgets.js';
import { subscriptionSubjects } from './data.mjs';
import '../../src/style.css';
import '@online-school/ui/style.css';
import '../../src/student.css';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <main className="k8k-access-screen">
      <h1>Абонементы по предметам</h1>
      <section className="k8k-student-card" data-module="DASH-STU-05">
        <SubjectSubscriptions
          items={subscriptionSubjects() as StudentSubjectDto[]}
          timeZone="Europe/Chisinau"
        />
      </section>
    </main>
  </MemoryRouter>,
);
