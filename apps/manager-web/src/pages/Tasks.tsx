import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listManagerTasks } from '@online-school/api-contracts';
import { read } from '../api/client.js';
import { useManager } from '../session.js';
import { Badge, State, Select, Check, enumOptions } from '../components/ui.js';
import { displayTime } from '../lib/time.js';
import { ru, label } from '../i18n/ru.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
export default function Tasks({ studentId }: { studentId?: string }) {
  const me = useManager();
  const [params] = useSearchParams();
  const [status, setStatus] = useState('OPEN,IN_PROGRESS');
  const [type, setType] = useState('');
  const [overdue, setOverdue] = useState(params.get('overdue') === 'true');
  const [cursor, setCursor] = useState<string | undefined>();
  const q = {
    ...(studentId ? { studentId } : {}),
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(overdue ? { overdue } : {}),
    ...(cursor ? { cursor } : {}),
    limit: 25,
  };
  const query = useQuery({
    queryKey: ['manager', 'tasks', q],
    queryFn: ({ signal }) => read((o) => listManagerTasks(q, o), signal),
  });
  return (
    <>
      <div className="page-heading">
        <h1>{ru.tasks}</h1>
        <button
          type="button"
          onClick={() => {
            void query.refetch();
          }}
        >
          {ru.refresh}
        </button>
      </div>
      <div className="filters">
        <Select
          name="taskStatus"
          label={ru.status}
          value={status}
          options={[
            { id: 'OPEN,IN_PROGRESS', label: ru.openTasks },
            ...enumOptions(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']),
          ]}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursor(undefined);
          }}
        />
        <Select
          name="taskType"
          label={ru.type}
          value={type}
          options={enumOptions([
            'LEAD_FOLLOWUP',
            'ASSIGN_TEACHER',
            'RESCHEDULE_REQUEST',
            'CHARGE_DISPUTE',
            'SUBSCRIPTION_EXPIRING',
            'GENERAL',
          ])}
          onChange={(e) => {
            setType(e.target.value);
            setCursor(undefined);
          }}
        />
        <Check
          name="overdue"
          label={ru.overdueOnly}
          checked={overdue}
          onChange={(e) => {
            setOverdue(e.target.checked);
            setCursor(undefined);
          }}
        />
      </div>
      <State query={query} empty={query.data?.items.length === 0}>
        {(d) => (
          <>
            <ul className="record-cards">
              {d.items.map((t) => (
                <li key={t.taskId}>
                  <div className="section-heading">
                    <Link className="record-title" to={routes.task(t.taskId)}>
                      {label(t.type)}
                    </Link>
                    <Badge value={t.status} />
                  </div>
                  <Link
                    to={
                      t.leadId
                        ? routes.lead(t.leadId)
                        : t.studentId
                          ? routes.student(t.studentId)
                          : routes.tasks
                    }
                  >
                    {t.studentName}
                  </Link>
                  <p className={t.isOverdue ? 'danger-text' : ''}>
                    {ru.dueAt}: {displayTime(t.dueAt, me.timezone)} {t.isOverdue && ru.overdue}
                  </p>
                  <Badge value={t.approvalStatus} />
                </li>
              ))}
            </ul>
            <div className="pagination">
              {cursor && (
                <button type="button" onClick={() => setCursor(undefined)}>
                  {ru.firstPage}
                </button>
              )}
              {d.nextCursor && (
                <button type="button" onClick={() => setCursor(d.nextCursor!)}>
                  {ru.next}
                </button>
              )}
            </div>
          </>
        )}
      </State>
    </>
  );
}
