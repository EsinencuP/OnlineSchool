import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fmtDateTime, relative } from '../../shared/format';
import { Avatar, Badge, Empty, Notice, Panel } from '../../shared/ui';
import { REPORT_DEADLINE_H, selectJournal } from '../logic';
import { useTeacher } from '../store';
import type { JournalItem } from '../types';

const STATE: Record<JournalItem['state'], { label: string; tone: 'yellow' | 'teal' | 'neutral' | 'coral' | 'violet' }> = {
  AWAITING_REPORT: { label: 'Ждёт результата', tone: 'yellow' },
  AWAITING_CONFIRMATION: { label: 'На подтверждении', tone: 'violet' },
  CONDUCTED: { label: 'Проведён', tone: 'teal' },
  CANCELLED: { label: 'Не проведён', tone: 'neutral' },
  DISPUTED: { label: 'Спор', tone: 'coral' },
};

export function TeacherJournal() {
  const { state } = useTeacher();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'todo' | 'all'>('todo');
  const journal = selectJournal(state);
  const rows = tab === 'todo' ? journal.filter((j) => j.state === 'AWAITING_REPORT') : journal;
  const selected = journal.find((j) => j.lessonId === params.get('lesson')) ?? null;
  const open = (id: string | null) => setParams(id ? { lesson: id } : {}, { replace: true });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Журнал уроков</h1>
          <p>Подтвердите факт урока и тему в течение {REPORT_DEADLINE_H} часов после окончания. Без подтверждения урок не считается проведённым и не попадает в начисления.</p>
        </div>
      </div>
      <div className="tabs" role="group" aria-label="Фильтр">
        <button type="button" className="chip" aria-pressed={tab === 'todo'} onClick={() => setTab('todo')}>
          Ждут результата <span className="n">{journal.filter((j) => j.state === 'AWAITING_REPORT').length}</span>
        </button>
        <button type="button" className="chip" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>
          Все прошедшие <span className="n">{journal.length}</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <section className="card"><Empty title="Все результаты внесены" text="Отличная дисциплина журнала." /></section>
      ) : (
        <section className="card" style={{ padding: 14 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Ученик</th><th>Урок</th><th>Статус</th><th>Срок внесения</th><th><span className="sr-only">Действие</span></th></tr>
              </thead>
              <tbody>
                {rows.map((j) => (
                  <tr key={j.lessonId} tabIndex={0} onClick={() => open(j.lessonId)} onKeyDown={(e) => e.key === 'Enter' && open(j.lessonId)}>
                    <td><div className="cell-person"><Avatar name={j.studentName} /><div><b>{j.studentName}</b><span>{j.kind === 'TRIAL' ? 'Пробный' : j.subjectName}</span></div></div></td>
                    <td className="num">{fmtDateTime(j.startsAt)}</td>
                    <td><Badge tone={STATE[j.state].tone}>{STATE[j.state].label}</Badge></td>
                    <td>
                      {j.state === 'AWAITING_REPORT' ? (
                        <span className={j.overdue ? 'neg' : ''}>
                          {j.overdue && <TriangleAlert size={13} />} {j.overdue ? `просрочено ${relative(j.reportDeadlineAt, state.now)}` : `осталось ${relative(j.reportDeadlineAt, state.now).replace('через ', '')}`}
                        </span>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {j.state === 'AWAITING_REPORT' && <button type="button" className="btn btn-dark btn-sm" onClick={(e) => { e.stopPropagation(); open(j.lessonId); }}>Внести</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected && <ReportPanel item={selected} onClose={() => open(null)} />}
    </div>
  );
}

function ReportPanel({ item, onClose }: { item: JournalItem; onClose: () => void }) {
  const { state, run } = useTeacher();
  const existing = state.reports[item.lessonId];
  const [result, setResult] = useState<'CONDUCTED' | 'NOT_CONDUCTED'>('CONDUCTED');
  const [noShow, setNoShow] = useState(true);
  const [waited, setWaited] = useState(false);
  const [duration, setDuration] = useState(60);
  const [note, setNote] = useState('');

  return (
    <Panel title={item.studentName} onClose={onClose} header={<Avatar name={item.studentName} size="lg" />}>
      <div className="chips">
        <Badge tone={STATE[item.state].tone}>{STATE[item.state].label}</Badge>
        <Badge tone="neutral">{fmtDateTime(item.startsAt)}</Badge>
        {item.overdue && <Badge tone="coral">Больше 24 ч</Badge>}
      </div>
      {existing ? (
        <section className="card">
          <dl className="kv">
            <dt>Результат</dt>
            <dd>{existing.result === 'CONDUCTED' ? 'Проведён' : existing.studentNoShow ? 'Ученик не подключился' : 'Не проведён'}</dd>
            {existing.durationMin && (<><dt>Длительность</dt><dd>{existing.durationMin} мин</dd></>)}
            <dt>Тема / заметка</dt>
            <dd>{existing.note}</dd>
            <dt>Внесено</dt>
            <dd>{fmtDateTime(existing.reportedAt)}</dd>
          </dl>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Подтверждённый урок исправляет менеджер (правило 6.4).</p>
        </section>
      ) : (
        <section className="card">
          <form
            style={{ display: 'grid', gap: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (run({ type: 'lesson.report', lessonId: item.lessonId, result, studentNoShow: noShow, waited15: waited, durationMin: duration, note }).ok) onClose();
            }}
          >
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Результат</legend>
              <div className="seg">
                <label><input type="radio" name="res" checked={result === 'CONDUCTED'} onChange={() => setResult('CONDUCTED')} />Урок проведён</label>
                <label><input type="radio" name="res" checked={result === 'NOT_CONDUCTED'} onChange={() => setResult('NOT_CONDUCTED')} />Не проведён</label>
              </div>
            </fieldset>
            {result === 'CONDUCTED' ? (
              <div className="field" style={{ maxWidth: 200 }}>
                <label htmlFor="dur">Фактически, минут</label>
                <input id="dur" type="number" min={1} max={90} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                <span className="hint">Потерянные минуты по вашей вине компенсируются ученику.</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <label className="check"><input type="checkbox" checked={noShow} onChange={(e) => setNoShow(e.target.checked)} />Ученик не подключился</label>
                {noShow && (
                  <>
                    <label className="check"><input type="checkbox" checked={waited} onChange={(e) => setWaited(e.target.checked)} />Я ждал(а) 15 минут в Google Meet и сообщил(а) менеджеру</label>
                    <Notice tone="teal">При вашей готовности провести урок начисляется полная ставка, урок ученику списывается по правилам академии.</Notice>
                  </>
                )}
              </div>
            )}
            <div className="field">
              <label htmlFor="note">Тема урока / что произошло</label>
              <textarea id="note" rows={3} required minLength={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: квадратные уравнения, разбор ДЗ, начали теорему Виета" />
            </div>
            <button type="submit" className="btn btn-dark">Подтвердить</button>
          </form>
        </section>
      )}
    </Panel>
  );
}
