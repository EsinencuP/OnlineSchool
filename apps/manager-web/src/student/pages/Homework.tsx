import { Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fmtDateTime, fmtDay, relative } from '../../shared/format';
import { SUBJECT_ICON } from '../../shared/subjects';
import { Badge, Empty, Notice, Panel } from '../../shared/ui';
import { homeworkStatus } from '../labels';
import { useStudent } from '../store';
import type { HomeworkItem, HomeworkStatus } from '../types';

const FILTERS: (HomeworkStatus | 'ALL')[] = ['ALL', 'NOT_SUBMITTED', 'NEEDS_REVISION', 'SUBMITTED', 'REVIEWED'];

export function StudentHomework() {
  const { state } = useStudent();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<HomeworkStatus | 'ALL'>('ALL');
  const q = (params.get('q') ?? '').toLowerCase();
  const selected = state.homework.find((h) => h.homeworkId === params.get('id')) ?? null;
  const order: Record<HomeworkStatus, number> = { NEEDS_REVISION: 0, NOT_SUBMITTED: 1, SUBMITTED: 2, REVIEWED: 3 };
  const rows = state.homework
    .filter((h) => (filter === 'ALL' || h.status === filter) && (!q || h.title.toLowerCase().includes(q)))
    .sort((a, b) => order[a.status] - order[b.status] || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('id', id);
    else next.delete('id');
    setParams(next, { replace: true });
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Задания</h1>
          <p>Преподаватель проверяет работу до следующего урока. Если нужно доработать — отправьте новую версию, прежние сохраняются.</p>
        </div>
      </div>
      <div className="chips" role="group" aria-label="Статус">
        {FILTERS.map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'ALL' ? 'Все' : homeworkStatus[f].label}
            <span className="n">{f === 'ALL' ? state.homework.length : state.homework.filter((h) => h.status === f).length}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <section className="card"><Empty title="Заданий нет" text="По выбранному фильтру пусто." /></section>
      ) : (
        <div className="grid-3">
          {rows.map((h) => (
            <HomeworkCard key={h.homeworkId} h={h} now={state.now} onOpen={() => open(h.homeworkId)} />
          ))}
        </div>
      )}

      {selected && <HomeworkPanel h={selected} onClose={() => open(null)} />}
    </div>
  );
}

function HomeworkCard({ h, now, onOpen }: { h: HomeworkItem; now: string; onOpen: () => void }) {
  const dark = h.status === 'NEEDS_REVISION';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card"
      style={{
        textAlign: 'left',
        border: 0,
        display: 'grid',
        gap: 10,
        alignContent: 'start',
        background: dark ? 'var(--navy-deep)' : h.status === 'NOT_SUBMITTED' ? 'var(--yellow-tint)' : 'var(--surface)',
        color: dark ? '#fff' : undefined,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <img src={SUBJECT_ICON[h.subjectName]} alt="" width={40} height={40} style={{ objectFit: 'contain', background: '#fff', borderRadius: 12, padding: 2 }} />
        <span style={{ fontSize: 12, opacity: 0.8 }}>{h.subjectName}</span>
        <span style={{ marginLeft: 'auto' }}>
          <Badge tone={h.isLate ? 'coral' : homeworkStatus[h.status].tone}>{h.isLate ? 'Просрочено' : homeworkStatus[h.status].label}</Badge>
        </span>
      </div>
      <b style={{ fontSize: 16 }}>{h.title}</b>
      <span style={{ fontSize: 13, opacity: 0.8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{h.description}</span>
      <span style={{ fontSize: 12, opacity: 0.85 }}>
        {h.dueAt ? `Срок: ${fmtDay(h.dueAt)} (${relative(h.dueAt, now)})` : 'Без срока'}
        {h.draftContent ? ' · есть черновик' : ''}
      </span>
    </button>
  );
}

function HomeworkPanel({ h, onClose }: { h: HomeworkItem; onClose: () => void }) {
  const { run } = useStudent();
  const [text, setText] = useState(h.draftContent ?? (h.status === 'NEEDS_REVISION' ? h.latestVersion?.content ?? '' : ''));
  const editable = h.status === 'NOT_SUBMITTED' || h.status === 'NEEDS_REVISION';

  return (
    <Panel title={h.title} onClose={onClose}>
      <div className="chips">
        <Badge tone={homeworkStatus[h.status].tone}>{homeworkStatus[h.status].label}</Badge>
        {h.isLate && <Badge tone="coral">Просрочено</Badge>}
        <Badge tone="neutral">{h.subjectName}</Badge>
      </div>
      <section className="card">
        <dl className="kv">
          <dt>Преподаватель</dt>
          <dd>{h.teacherName}</dd>
          <dt>Выдано</dt>
          <dd>{fmtDateTime(h.assignedAt)}</dd>
          <dt>Срок</dt>
          <dd>{h.dueAt ? fmtDateTime(h.dueAt) : 'без срока'}</dd>
        </dl>
        <p style={{ marginTop: 12 }}>{h.description}</p>
        {h.attachments.map((a) => (
          <div key={a.fileId} className="file-row" style={{ marginTop: 10 }}>
            <Paperclip size={16} />
            <span className="grow" style={{ flex: 1 }}>{a.fileName}</span>
            <span className="muted num" style={{ fontSize: 12 }}>{Math.round(a.fileSizeBytes / 1024)} КБ</span>
          </div>
        ))}
      </section>

      {h.versions.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>Мои версии</h3></div>
          <div style={{ display: 'grid', gap: 14 }}>
            {[...h.versions].reverse().map((v) => (
              <div key={v.versionNumber} className={`version${v.teacherStatus === 'NEEDS_REVISION' ? ' needs' : v.teacherStatus === 'REVIEWED' ? ' ok' : ''}`}>
                <b>Версия {v.versionNumber} · {fmtDateTime(v.submittedAt)}</b>
                <span style={{ fontSize: 13 }}>{v.content}</span>
                {v.teacherComment ? (
                  <Notice tone={v.teacherStatus === 'NEEDS_REVISION' ? 'coral' : 'teal'}>
                    <b>{h.teacherName}:</b> {v.teacherComment}
                  </Notice>
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>Ждёт проверки</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {editable && (
        <section className="card">
          <div className="card-head"><h3>{h.status === 'NEEDS_REVISION' ? 'Новая версия' : 'Ответ'}</h3></div>
          <form
            style={{ display: 'grid', gap: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (run({ type: 'homework.submit', homeworkId: h.homeworkId, content: text }).ok) onClose();
            }}
          >
            <div className="field">
              <label htmlFor="hw-text" className="sr-only">Текст ответа</label>
              <textarea id="hw-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Запишите решение или ответ. Файлы прикрепляются в рабочей версии через защищённое хранилище." />
            </div>
            <div className="chips">
              <button type="submit" className="btn btn-dark">Сдать на проверку</button>
              <button type="button" className="btn btn-ghost" onClick={() => run({ type: 'homework.saveDraft', homeworkId: h.homeworkId, content: text })}>
                Сохранить черновик
              </button>
            </div>
          </form>
        </section>
      )}
    </Panel>
  );
}
