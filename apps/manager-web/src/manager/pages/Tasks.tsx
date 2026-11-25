import { Clock, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Badge, Empty, Notice, Panel } from '../../shared/ui';
import { useManager } from '../store';
import type { ManagerTask, TaskType } from '../types';
import { fmtDateTime, fmtMoney, relative } from '../../shared/format';
import { approvalStatus, taskStatus, taskType } from '../labels';

type Tab = 'active' | 'overdue' | 'done';

export function Tasks() {
  const { state } = useManager();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('filter') === 'overdue' ? 'overdue' : 'active');
  const [type, setType] = useState<TaskType | 'ALL'>('ALL');
  const selected = state.tasks.find((t) => t.taskId === params.get('task')) ?? null;

  const isOpen = (t: ManagerTask) => t.status === 'OPEN' || t.status === 'IN_PROGRESS';
  const byTab: Record<Tab, ManagerTask[]> = useMemo(
    () => ({
      active: state.tasks.filter(isOpen),
      overdue: state.tasks.filter((t) => isOpen(t) && t.isOverdue),
      done: state.tasks.filter((t) => !isOpen(t)),
    }),
    [state.tasks],
  );
  const rows = byTab[tab]
    .filter((t) => type === 'ALL' || t.type === type)
    .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || a.dueAt.localeCompare(b.dueAt));

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('task', id);
    else next.delete('task');
    setParams(next, { replace: true });
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Задачи</h1>
          <p>Задачи создаются из событий платформы (заявки, переносы, споры, окончание абонемента) и вручную. Срочную задачу нужно принять в течение 10 минут.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="chips" role="group" aria-label="Очередь">
          {([['active', 'Активные'], ['overdue', 'Просроченные'], ['done', 'Закрытые']] as const).map(([k, label]) => (
            <button key={k} type="button" className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>
              {label} <span className="n">{byTab[k].length}</span>
            </button>
          ))}
        </div>
        <label htmlFor="task-type" className="sr-only">Тип задачи</label>
        <select id="task-type" className="chip" style={{ marginLeft: 'auto' }} value={type} onChange={(e) => setType(e.target.value as TaskType | 'ALL')}>
          <option value="ALL">Все типы</option>
          {Object.entries(taskType).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <section className="card"><Empty title="Здесь пусто" text="Задач по выбранному фильтру нет." /></section>
      ) : (
        <div className="list" style={{ gap: 10 }}>
          {rows.map((t) => (
            <button key={t.taskId} type="button" className="row-item card" style={{ padding: 16, borderRadius: 20 }} onClick={() => open(t.taskId)}>
              <Avatar name={t.studentName} />
              <span className="grow">
                <span className="title">{t.studentName}</span>
                <span className="sub">{summary(t)}</span>
              </span>
              <span className="chips" style={{ justifyContent: 'flex-end' }}>
                <Badge tone={taskType[t.type].tone}>{taskType[t.type].label}</Badge>
                <Badge tone={taskStatus[t.status].tone}>{taskStatus[t.status].label}</Badge>
                {t.approvalStatus !== 'NONE' && <Badge tone="violet">{approvalStatus[t.approvalStatus]}</Badge>}
              </span>
              {(t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
                <span className={`time-pill${t.isOverdue ? ' overdue' : ''}`}>
                  {t.isOverdue ? 'просрочена ' : 'срок '}
                  {relative(t.dueAt, state.now)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && <TaskDrawer task={selected} onClose={() => open(null)} />}
    </div>
  );
}

function summary(t: ManagerTask): string {
  const p = t.payload;
  switch (p.kind) {
    case 'TaskGeneralPayloadDto':
      return p.text;
    case 'TaskDisputePayloadDto':
      return `Спор: ${p.chargedLessons} зан.${p.chargedAmount ? `, ${fmtMoney(p.chargedAmount, p.currency ?? 'MDL')}` : ''}`;
    case 'TaskReschedulePayloadDto':
      return `Урок ${fmtDateTime(p.currentStartsAt)}${p.studentComment ? ` — «${p.studentComment}»` : ''}`;
    case 'TaskExpiringPayloadDto':
      return `Абонемент заканчивается ${fmtDateTime(p.endsAt)}`;
    case 'TaskLeadPayloadDto':
      return 'Связаться с семьёй по заявке';
  }
}

function TaskDrawer({ task, onClose }: { task: ManagerTask; onClose: () => void }) {
  const { state, run } = useManager();
  const [note, setNote] = useState('');
  const p = task.payload;
  const active = task.status === 'OPEN' || task.status === 'IN_PROGRESS';

  return (
    <Panel title={taskType[task.type].label} onClose={onClose}>
      <div className="chips">
        <Badge tone={taskStatus[task.status].tone}>{taskStatus[task.status].label}</Badge>
        {task.isOverdue && <Badge tone="coral">Просрочена</Badge>}
        {task.approvalStatus !== 'NONE' && <Badge tone="violet">{approvalStatus[task.approvalStatus]}</Badge>}
      </div>

      <section className="card">
        <dl className="kv">
          <dt>Ученик / заявка</dt>
          <dd>{task.studentName}</dd>
          <dt>Создана</dt>
          <dd>{fmtDateTime(task.createdAt)}</dd>
          <dt>Срок</dt>
          <dd>
            {fmtDateTime(task.dueAt)} <span className="muted">({relative(task.dueAt, state.now)})</span>
          </dd>
          {task.escalatedAt && (
            <>
              <dt>Эскалация</dt>
              <dd>{fmtDateTime(task.escalatedAt)}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="card">
        <div className="card-head"><h3>Детали</h3></div>
        {p.kind === 'TaskGeneralPayloadDto' && <p>{p.text}</p>}
        {p.kind === 'TaskLeadPayloadDto' && <p>Свяжитесь с семьёй и зафиксируйте результат контакта. Стадия заявки меняется в разделе «Заявки».</p>}
        {p.kind === 'TaskExpiringPayloadDto' && <p>Абонемент заканчивается {fmtDateTime(p.endsAt)}. Предложите продление и зарегистрируйте платёж.</p>}
        {p.kind === 'TaskReschedulePayloadDto' && (
          <dl className="kv">
            <dt>Текущее время</dt>
            <dd>{fmtDateTime(p.currentStartsAt)}</dd>
            <dt>Пожелания</dt>
            <dd>{p.preferredWindows.map((w) => `${fmtDateTime(w.from)}–${fmtDateTime(w.to).split(', ')[1]}`).join('; ') || '—'}</dd>
            {p.studentComment && (
              <>
                <dt>Комментарий</dt>
                <dd>«{p.studentComment}»</dd>
              </>
            )}
          </dl>
        )}
        {p.kind === 'TaskDisputePayloadDto' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <dl className="kv">
              <dt>Списано</dt>
              <dd className="num">{p.chargedLessons} зан.{p.chargedAmount ? ` · ${fmtMoney(p.chargedAmount, p.currency ?? 'MDL')}` : ''}</dd>
              <dt>Проводка</dt>
              <dd className="num">{p.ledgerRef ?? '—'}</dd>
              <dt>Жалоба</dt>
              <dd>«{p.studentComment}»</dd>
            </dl>
            <Notice tone="violet" icon={<TriangleAlert size={16} />}>
              Менеджер предлагает решение, полную отмену списания исполняет директор. Частичный возврат уходит на ручную финансовую проверку.
            </Notice>
          </div>
        )}
      </section>

      {active && (
        <section className="card" aria-label="Действия по задаче">
          {task.status === 'OPEN' ? (
            <button type="button" className="btn btn-dark" onClick={() => run({ type: 'task.claim', taskId: task.taskId })}>
              <Clock size={16} /> Взять в работу
            </button>
          ) : task.approvalStatus === 'AWAITING_DIRECTOR' ? (
            <p className="muted">Ждём решения директора — закрыть задачу сейчас нельзя.</p>
          ) : (
            <form
              style={{ display: 'grid', gap: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (run({ type: 'task.resolve', taskId: task.taskId, note }).ok) setNote('');
              }}
            >
              <div className="field">
                <label htmlFor="task-note">Результат</label>
                <textarea id="task-note" rows={3} required minLength={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Что сделано и о чём договорились" />
                <span className="hint">Сохраняется в истории задачи. {note.length}/500</span>
              </div>
              <button type="submit" className="btn btn-dark">Закрыть задачу</button>
            </form>
          )}
        </section>
      )}
    </Panel>
  );
}
