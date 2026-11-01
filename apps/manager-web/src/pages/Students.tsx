import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listManagerStudents, createManagerStudent } from '@online-school/api-contracts';
import type { ListManagerStudentsParams } from '@online-school/api-contracts';
import { read } from '../api/client.js';
import { useCommand } from '../hooks/use-command.js';
import { useManager } from '../session.js';
import { ru } from '../i18n/ru.js';
import { formatMoney } from '../lib/money.js';
import { displayTime } from '../lib/time.js';
import {
  Badge,
  State,
  Dialog,
  FormShell,
  Input,
  Select,
  TextArea,
  Check,
  text,
  enumOptions,
} from '../components/ui.js';
import { MANAGER_ROUTES as routes } from '../routes.js';
export default function Students() {
  const me = useManager();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const q: ListManagerStudentsParams = {
    limit: 25,
    ...(params.get('search') ? { search: params.get('search')! } : {}),
    ...(params.get('status')
      ? { status: params.get('status')! as NonNullable<ListManagerStudentsParams['status']> }
      : {}),
    ...(params.get('cursor') ? { cursor: params.get('cursor')! } : {}),
    ...(params.get('overdue') ? { hasOverdueTask: true } : {}),
    ...(params.get('expiring') ? { subscriptionExpiringSoon: true } : {}),
    sort: (params.get('sort') ?? 'name') as NonNullable<ListManagerStudentsParams['sort']>,
  };
  const query = useQuery({
    queryKey: ['manager', 'students', q],
    queryFn: ({ signal }) => read((o) => listManagerStudents(q, o), signal),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {ru.portfolio} · {me.portfolioSize}
          </p>
          <h1>{ru.students}</h1>
        </div>
        <button className="primary" type="button" onClick={() => setCreating(true)}>
          + {ru.newStudent}
        </button>
      </div>
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const next = new URLSearchParams();
          for (const key of ['search', 'status', 'sort'])
            if (text(f, key)) next.set(key, text(f, key));
          for (const key of ['overdue', 'expiring']) if (f.has(key)) next.set(key, 'true');
          setParams(next);
        }}
      >
        <Input
          name="search"
          label={ru.search}
          minLength={2}
          maxLength={100}
          defaultValue={params.get('search') ?? ''}
          hint={ru.searchHelp}
        />
        <Select
          name="status"
          label={ru.status}
          options={enumOptions(['LEAD', 'ACTIVE', 'FROZEN', 'EXPIRED', 'ARCHIVED'])}
          defaultValue={params.get('status') ?? ''}
        />
        <Select
          name="sort"
          label={ru.sort}
          placeholder={false}
          options={[
            { id: 'name', label: ru.sortName },
            { id: 'nextLesson', label: ru.sortNext },
            { id: 'subscriptionEnd', label: ru.sortEnd },
          ]}
          defaultValue={q.sort}
        />
        <Check name="overdue" label={ru.overdueOnly} defaultChecked={params.has('overdue')} />
        <Check name="expiring" label={ru.expiringOnly} defaultChecked={params.has('expiring')} />
        <button type="submit">{ru.filter}</button>
      </form>
      <State query={query} empty={query.data?.items.length === 0}>
        {(d) => (
          <>
            <div className="data-table student-table">
              <div className="table-head">
                <span>{ru.student}</span>
                <span>{ru.status}</span>
                <span>{ru.balance}</span>
                <span>{ru.nextLesson}</span>
                <span>{ru.tasks}</span>
              </div>
              {d.items.map((s) => (
                <article className="table-row" key={s.studentId}>
                  <div>
                    <Link className="record-title" to={routes.student(s.studentId)}>
                      {s.fullName}
                    </Link>
                    <small>
                      {s.maskedPhone ?? ru.dash} · {s.hasAccount ? ru.hasAccount : ru.noAccount}
                    </small>
                  </div>
                  <div>
                    <Badge value={s.status} />
                  </div>
                  <div data-label={ru.balance}>
                    {s.balances.map((b) => (
                      <span className="block" key={b.currency}>
                        {formatMoney(b.amount, b.currency)}
                      </span>
                    ))}
                    {s.balances.length === 0 && ru.dash}
                  </div>
                  <div data-label={ru.nextLesson}>{displayTime(s.nextLessonAt, me.timezone)}</div>
                  <div data-label={ru.tasks}>
                    {s.openTasksCount}
                    {s.overdueTasksCount > 0 && (
                      <small className="danger-text">
                        {ru.overdue}: {s.overdueTasksCount}
                      </small>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="pagination">
              {params.has('cursor') && (
                <button
                  type="button"
                  onClick={() => {
                    const p = new URLSearchParams(params);
                    p.delete('cursor');
                    setParams(p);
                  }}
                >
                  {ru.firstPage}
                </button>
              )}
              {d.nextCursor && (
                <button
                  type="button"
                  onClick={() => {
                    const p = new URLSearchParams(params);
                    p.set('cursor', d.nextCursor!);
                    setParams(p);
                  }}
                >
                  {ru.next}
                </button>
              )}
            </div>
          </>
        )}
      </State>
      {creating && <NewStudent close={() => setCreating(false)} />}
    </>
  );
}

function NewStudent({ close }: { close: () => void }) {
  const command = useCommand();
  const navigate = useNavigate();
  return (
    <Dialog
      title={ru.newStudent}
      close={() => {
        if (!command.busy) {
          close();
        }
      }}
    >
      <FormShell
        busy={command.busy}
        error={command.error}
        button={ru.create}
        submit={async (f) => {
          const payload = {
            fullName: text(f, 'fullName'),
            ...(text(f, 'phone') ? { phone: text(f, 'phone') } : {}),
            ...(text(f, 'email') ? { email: text(f, 'email') } : {}),
            ...(text(f, 'guardianName') ? { guardianName: text(f, 'guardianName') } : {}),
            ...(text(f, 'managerNote') ? { managerNote: text(f, 'managerNote') } : {}),
          };
          const result = await command.run(payload, (o) => createManagerStudent(payload, o));
          if (result) navigate(routes.student(result.studentId));
        }}
      >
        <p className="hint">{ru.noAccount}</p>
        <Input name="fullName" label={ru.fullName} required minLength={2} maxLength={120} />
        <Input
          name="phone"
          label={ru.phone}
          type="tel"
          pattern={String.raw`\+?[0-9 \(\)\-]{6,20}`}
        />
        <Input name="email" label={ru.email} type="email" maxLength={254} />
        <Input name="guardianName" label={ru.guardian} minLength={2} maxLength={120} />
        <TextArea name="managerNote" label={ru.managerNote} maxLength={2000} />
      </FormShell>
    </Dialog>
  );
}
