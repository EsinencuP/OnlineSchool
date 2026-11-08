import { lazy, Suspense, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getManagerStudentCard,
  updateManagerStudentContacts,
  createEnrollment,
} from '@online-school/api-contracts';
import type { StudentCardDto } from '@online-school/api-contracts';
import { read } from '../api/client.js';
import { useCommand } from '../hooks/use-command.js';
import { useOptions } from '../hooks/use-options.js';
import {
  Badge,
  State,
  Dialog,
  FormShell,
  Input,
  Select,
  TextArea,
  text,
} from '../components/ui.js';
import { ru } from '../i18n/ru.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
const BalanceSummary = lazy(() => import('./student/BalanceSummary.js'));
const Payments = lazy(() => import('./student/Payments.js'));
const Subscriptions = lazy(() => import('./student/Subscriptions.js'));
const Notifications = lazy(() => import('./student/Notifications.js'));
const Schedule = lazy(() => import('./Schedule.js'));
const Tasks = lazy(() => import('./Tasks.js'));
const tabs = [
  { id: 'overview', label: ru.overview },
  { id: 'subscriptions', label: ru.subscriptions },
  { id: 'payments', label: ru.payments },
  { id: 'schedule', label: ru.schedule },
  { id: 'tasks', label: ru.tasks },
  { id: 'notifications', label: ru.notifications },
];
export default function Student() {
  const id = useParams().id!;
  const [params] = useSearchParams();
  const [action, setAction] = useState<'contacts' | 'enrollment' | null>(null);
  const query = useQuery({
    queryKey: ['manager', 'student', id],
    queryFn: ({ signal }) => read((o) => getManagerStudentCard(id, o), signal),
  });
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'overview';
  return (
    <>
      <Link className="back-link" to={routes.students}>
        ← {ru.students}
      </Link>
      <State query={query}>
        {(s) => (
          <>
            <div className="page-heading">
              <div>
                <h1>{s.fullName}</h1>
                <div className="inline">
                  <Badge value={s.status} />
                  <span>{s.hasAccount ? ru.hasAccount : ru.noAccount}</span>
                </div>
              </div>
              <Link className="button" to={routes.studentAccount(id)}>
                {ru.account}
              </Link>
            </div>
            {s.leadId && (
              <Link className="back-link" to={routes.lead(s.leadId)}>
                {ru.openLead} →
              </Link>
            )}
            <nav className="tabs" aria-label={ru.viewStudent}>
              {tabs.map((t) => (
                <Link
                  key={t.id}
                  to={`?tab=${t.id}`}
                  aria-current={t.id === tab ? 'page' : undefined}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            <Suspense fallback={<p role="status">{ru.loading}</p>}>
              {tab === 'overview' && (
                <>
                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>{ru.contacts}</h2>
                        <button type="button" onClick={() => setAction('contacts')}>
                          {ru.editContacts}
                        </button>
                      </div>
                      <dl className="details">
                        <dt>{ru.phone}</dt>
                        <dd>{s.contacts.phone ?? ru.dash}</dd>
                        <dt>{ru.email}</dt>
                        <dd>{s.contacts.email ?? ru.dash}</dd>
                        <dt>{ru.guardian}</dt>
                        <dd>{s.contacts.guardianName ?? ru.dash}</dd>
                      </dl>
                      <h3>{ru.managerNote}</h3>
                      <p className="plain-text">{s.managerNote ?? ru.dash}</p>
                    </section>
                    <BalanceSummary balances={s.balances} />
                  </div>
                  <Directions studentId={id} add={() => setAction('enrollment')} />
                </>
              )}
              {tab === 'payments' && <Payments studentId={id} />}
              {tab === 'subscriptions' && <Subscriptions studentId={id} />}
              {tab === 'schedule' && <Schedule studentId={id} />}
              {tab === 'tasks' && <Tasks studentId={id} />}
              {tab === 'notifications' && <Notifications studentId={id} />}
            </Suspense>
            {action && (
              <StudentAction
                key={action}
                action={action}
                student={s}
                close={() => setAction(null)}
                reload={async () => query.refetch()}
              />
            )}
          </>
        )}
      </State>
    </>
  );
}
function Directions({ studentId, add }: { studentId: string; add: () => void }) {
  const q = useOptions(studentId);
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{ru.direction}</h2>
        <button type="button" onClick={add}>
          + {ru.addDirection}
        </button>
      </div>
      <State query={q} empty={q.data?.enrollments.length === 0}>
        {(o) => (
          <ul className="record-list">
            {o.enrollments.map((e) => (
              <li key={e.id}>
                <strong>{e.label}</strong>
                <span>{e.teachers.map((t) => t.label).join(', ') || ru.noTeachers}</span>
              </li>
            ))}
          </ul>
        )}
      </State>
    </section>
  );
}
function StudentAction({
  action,
  student,
  close,
  reload,
}: {
  action: 'contacts' | 'enrollment';
  student: StudentCardDto;
  close: () => void;
  reload: () => Promise<unknown>;
}) {
  const command = useCommand();
  const options = useOptions(student.studentId);
  async function send(f: FormData) {
    if (action === 'contacts') {
      const payload = {
        phone: text(f, 'phone') || null,
        email: text(f, 'email') || null,
        guardianName: text(f, 'guardianName') || null,
        managerNote: text(f, 'managerNote') || null,
        version: student.version,
      };
      const r = await command.run(payload, (o) =>
        updateManagerStudentContacts(student.studentId, payload, o),
      );
      if (r) close();
    } else {
      const payload = { studentId: student.studentId, subjectId: text(f, 'subjectId') };
      const r = await command.run(payload, (o) => createEnrollment(payload, o));
      if (r) close();
    }
  }
  return (
    <Dialog
      title={action === 'contacts' ? ru.editContacts : ru.addDirection}
      close={() => {
        if (!command.busy) close();
      }}
    >
      <FormShell
        busy={command.busy}
        error={command.error}
        submit={send}
        reload={async () => {
          await reload();
          command.clearError();
        }}
      >
        {action === 'contacts' ? (
          <>
            <Input
              name="phone"
              label={ru.phone}
              type="tel"
              defaultValue={student.contacts.phone ?? ''}
              pattern={String.raw`\+?[0-9 \(\)\-]{6,20}`}
            />
            <Input
              name="email"
              label={ru.email}
              type="email"
              defaultValue={student.contacts.email ?? ''}
              maxLength={254}
            />
            <Input
              name="guardianName"
              label={ru.guardian}
              defaultValue={student.contacts.guardianName ?? ''}
              minLength={2}
              maxLength={120}
            />
            <TextArea
              name="managerNote"
              label={ru.managerNote}
              defaultValue={student.managerNote ?? ''}
              maxLength={2000}
            />
          </>
        ) : (
          <State query={options}>
            {(o) => (
              <Select
                name="subjectId"
                label={ru.direction}
                required
                options={o.subjects.filter((s) => !o.enrollments.some((e) => e.subjectId === s.id))}
              />
            )}
          </State>
        )}
      </FormShell>
    </Dialog>
  );
}
