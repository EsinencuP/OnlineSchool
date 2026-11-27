import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useManager } from '../../manager/store';
import { Segmented, SortTh, useSort } from '../../shared/analytics';
import { fmtDateTime, relative } from '../../shared/format';
import { Avatar, Badge, Empty } from '../../shared/ui';
import { availability, liveStaff, managerMetrics, teacherMetrics } from '../logic';
import { useDirector } from '../store';
import type { Escalation, StaffItem } from '../types';

type Tab = 'managers' | 'teachers' | 'escalations';

/** Team: managers' workload, teachers' schedule load and the escalation queue in one place. */
export function DirectorTeam() {
  const { state } = useDirector();
  const { state: manager } = useManager();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'managers';
  const q = params.get('q') ?? '';
  const staff = liveStaff(state, manager).filter((s) => s.fullName.toLowerCase().includes(q.trim().toLowerCase()));
  const openEsc = state.escalations.filter((e) => e.state === 'OPEN').length;
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div>
          <h1>Команда</h1>
          <p>Нагрузка менеджеров и преподавателей, эскалации задач, которые никто не принял вовремя.</p>
        </div>
      </div>
      <div className="toolbar">
        <Segmented<Tab>
          label="Раздел"
          value={tab}
          onChange={(v) => set('tab', v === 'managers' ? null : v)}
          options={[['managers', 'Менеджеры'], ['teachers', 'Преподаватели'], ['escalations', `Эскалации · ${openEsc}`]]}
        />
        <span className="grow" />
        {tab !== 'escalations' && (
          <label className="filter-search">
            <Search size={14} aria-hidden="true" />
            <span className="sr-only">Поиск по имени</span>
            <input value={q} placeholder="Поиск по имени" onChange={(e) => set('q', e.target.value || null)} />
          </label>
        )}
      </div>
      {tab === 'managers' && <Managers rows={staff.filter((s) => s.kind === 'MANAGER')} />}
      {tab === 'teachers' && <Teachers rows={staff.filter((s) => s.kind === 'TEACHER')} />}
      {tab === 'escalations' && <Escalations rows={state.escalations} />}
    </div>
  );
}

type MKey = 'name' | 'students' | 'leads' | 'openTasks' | 'openEscalations';
function Managers({ rows }: { rows: StaffItem[] }) {
  const { sorted, sort, toggle } = useSort<StaffItem, MKey>(rows, { key: 'openTasks', dir: 'desc' }, (s, k) => (k === 'name' ? s.fullName : managerMetrics(s)[k]));
  if (rows.length === 0) return <section className="card"><Empty title="Никого не нашли" /></section>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <SortTh k="name" sort={sort} onSort={toggle}>Менеджер</SortTh>
            <th scope="col">Статус</th>
            <SortTh k="students" sort={sort} onSort={toggle} align="r">Ученики</SortTh>
            <SortTh k="leads" sort={sort} onSort={toggle} align="r">Открытые заявки</SortTh>
            <SortTh k="openTasks" sort={sort} onSort={toggle} align="r">Открытые задачи</SortTh>
            <SortTh k="openEscalations" sort={sort} onSort={toggle} align="r">Эскалации</SortTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => {
            const m = managerMetrics(s);
            return (
              <tr key={s.id} style={{ cursor: 'default' }}>
                <td><span className="cell-person"><Avatar name={s.fullName} /><b>{s.fullName}</b></span></td>
                <td><Badge tone={availability[m.availability].tone}>{availability[m.availability].label}</Badge></td>
                <td className="r">{m.students}</td>
                <td className="r">{m.leads}</td>
                <td className="r">{m.openTasks}</td>
                <td className="r">{m.openEscalations ? <span className="neg">{m.openEscalations}</span> : 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type TKey = 'name' | 'activeStudents' | 'lessonsNext7Days' | 'futureLessons';
function Teachers({ rows }: { rows: StaffItem[] }) {
  const { sorted, sort, toggle } = useSort<StaffItem, TKey>(rows, { key: 'lessonsNext7Days', dir: 'desc' }, (s, k) => (k === 'name' ? s.fullName : teacherMetrics(s)[k]));
  const max = Math.max(1, ...rows.map((r) => teacherMetrics(r).lessonsNext7Days));
  if (rows.length === 0) return <section className="card"><Empty title="Никого не нашли" /></section>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <SortTh k="name" sort={sort} onSort={toggle}>Преподаватель</SortTh>
            <SortTh k="activeStudents" sort={sort} onSort={toggle} align="r">Активные ученики</SortTh>
            <SortTh k="lessonsNext7Days" sort={sort} onSort={toggle} align="r">Уроков на 7 дней</SortTh>
            <th scope="col" style={{ width: '28%' }}><span className="sr-only">Сравнение</span></th>
            <SortTh k="futureLessons" sort={sort} onSort={toggle} align="r">Всего впереди</SortTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => {
            const m = teacherMetrics(s);
            return (
              <tr key={s.id} style={{ cursor: 'default' }}>
                <td><span className="cell-person"><Avatar name={s.fullName} /><b>{s.fullName}</b></span></td>
                <td className="r">{m.activeStudents}</td>
                <td className="r"><b>{m.lessonsNext7Days}</b></td>
                <td>
                  <span className="hb-track" style={{ display: 'block' }} aria-hidden="true">
                    <i style={{ width: `${(m.lessonsNext7Days / max) * 100}%` }} />
                  </span>
                </td>
                <td className="r">{m.futureLessons}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Escalations({ rows }: { rows: Escalation[] }) {
  const { state, run } = useDirector();
  const sorted = [...rows].sort((a, b) => (a.state === b.state ? a.escalatedAt.localeCompare(b.escalatedAt) : a.state === 'OPEN' ? -1 : 1));
  if (rows.length === 0) return <section className="card"><Empty title="Эскалаций нет" /></section>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Задача</th>
            <th scope="col">Клиент</th>
            <th scope="col">Менеджер</th>
            <th scope="col">Причина</th>
            <th scope="col">Эскалирована</th>
            <th scope="col">Состояние</th>
            <th scope="col"><span className="sr-only">Действие</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr key={e.escalationId} style={{ cursor: 'default' }}>
              <td><b>{e.title}</b></td>
              <td>{e.studentName ?? e.leadName ?? '—'}</td>
              <td>{e.primaryManagerName ?? '—'}</td>
              <td>{e.reason === 'MANAGER_UNAVAILABLE' ? 'Менеджер недоступен' : 'Не принята вовремя'}</td>
              <td title={fmtDateTime(e.escalatedAt)}>{relative(e.escalatedAt, state.now)}</td>
              <td>{e.state === 'OPEN' ? <Badge tone="coral">Открыта</Badge> : <Badge tone="teal">Принята · {e.acceptedByName}</Badge>}</td>
              <td className="r">
                {e.state === 'OPEN' && (
                  <button type="button" className="btn btn-dark btn-sm" onClick={() => run({ type: 'escalation.accept', escalationId: e.escalationId })}>
                    Принять
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
