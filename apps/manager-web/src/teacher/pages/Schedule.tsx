import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { fmtDateTime, fmtTime } from '../../shared/format';
import { Avatar, Badge, Notice, Panel } from '../../shared/ui';
import { WeekGrid, weekDays, weekRangeLabel } from '../../shared/WeekGrid';
import { NOTICE } from '../logic';
import { useTeacher } from '../store';
import type { RequestKind } from '../types';

const DOW = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const KIND_LABEL: Record<RequestKind, string> = { SINGLE_CANCEL: 'Разовая отмена/перенос', PERMANENT_CHANGE: 'Изменение постоянного слота', ABSENCE: 'Отсутствие 3+ дня' };

export function TeacherSchedule() {
  const { state, run } = useTeacher();
  const [week, setWeek] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [requestFor, setRequestFor] = useState<string | null | undefined>(undefined);
  const [win, setWin] = useState({ weekday: 5, from: 15, to: 18 });
  const days = weekDays(state.now, week);
  const lesson = state.lessons.find((l) => l.lessonId === selected) ?? null;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Расписание</h1>
          <p>Свободные окна вы меняете сами. Подтверждённые уроки, переносы и отмены — только через менеджера: до согласования действует прежнее расписание.</p>
        </div>
        <div className="actions" style={{ alignItems: 'center' }}>
          <button type="button" className="icon-btn" aria-label="Предыдущая неделя" onClick={() => setWeek((w) => w - 1)}><ChevronLeft size={16} /></button>
          <span className="date-pill" style={{ display: 'inline-flex' }}>{weekRangeLabel(days)}</span>
          <button type="button" className="icon-btn" aria-label="Следующая неделя" onClick={() => setWeek((w) => w + 1)}><ChevronRight size={16} /></button>
          <button type="button" className="btn btn-dark" onClick={() => setRequestFor(null)}>Запрос менеджеру</button>
        </div>
      </div>
      <div className="legend" style={{ marginTop: 0 }}>
        <span><i style={{ background: 'var(--teal-tint)', border: '1px dashed var(--teal)' }} />Свободное окно</span>
        <span><i style={{ background: 'var(--blue-tint)' }} />Запланирован</span>
        <span><i style={{ background: 'var(--teal)' }} />Проведён</span>
        <span><i style={{ background: 'var(--yellow-tint)' }} />Пробный</span>
        <span><i style={{ background: 'var(--surface-3)' }} />Отменён / пауза</span>
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <WeekGrid
          days={days}
          now={state.now}
          onOpen={setSelected}
          shade={(wd) => state.availability.filter((w) => w.weekday === wd)}
          items={state.lessons.map((l) => ({
            id: l.lessonId,
            startsAt: l.startsAt,
            endsAt: l.endsAt,
            title: l.studentName,
            subtitle: l.kind === 'TRIAL' ? 'пробный' : l.status === 'CONDUCTED' ? 'проведён' : l.subjectName,
            cancelled: l.status === 'CANCELLED',
            background: l.status === 'CANCELLED' ? 'var(--surface-3)' : l.kind === 'TRIAL' ? 'var(--yellow-tint)' : l.status === 'CONDUCTED' ? 'var(--teal-tint)' : 'var(--blue-tint)',
            label: `${fmtTime(l.startsAt)} ${l.studentName}`,
          }))}
        />
        <aside className="stack">
          <section className="card" aria-labelledby="h-avail">
            <div className="card-head"><h3 id="h-avail">Моя доступность</h3></div>
            <div className="list">
              {state.availability.slice().sort((a, b) => a.weekday - b.weekday || a.from - b.from).map((w) => (
                <div key={w.id} className="row-item">
                  <span className="grow"><span className="title">{DOW[w.weekday]}</span><span className="sub num">{w.from}:00 – {w.to}:00</span></span>
                  <button type="button" className="icon-btn" aria-label={`Удалить окно ${DOW[w.weekday]} ${w.from}–${w.to}`} onClick={() => run({ type: 'availability.remove', windowId: w.id })}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <form style={{ display: 'grid', gap: 8, marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); run({ type: 'availability.add', ...win }); }}>
              <label htmlFor="w-day" className="sr-only">День</label>
              <select id="w-day" className="chip" style={{ height: 40 }} value={win.weekday} onChange={(e) => setWin({ ...win, weekday: Number(e.target.value) })}>
                {DOW.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label htmlFor="w-from" className="sr-only">С</label>
                <input id="w-from" className="chip" style={{ height: 40, width: 80 }} type="number" min={0} max={23} value={win.from} onChange={(e) => setWin({ ...win, from: Number(e.target.value) })} />
                —
                <label htmlFor="w-to" className="sr-only">До</label>
                <input id="w-to" className="chip" style={{ height: 40, width: 80 }} type="number" min={1} max={24} value={win.to} onChange={(e) => setWin({ ...win, to: Number(e.target.value) })} />
                <button type="submit" className="btn btn-accent btn-sm">Добавить</button>
              </div>
            </form>
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Лимиты: {state.limits.perDay}/день, {state.limits.perWeek}/неделю, перерыв {state.limits.breakMin} мин.</p>
          </section>
          <section className="card" aria-labelledby="h-req">
            <div className="card-head"><h3 id="h-req">Запросы менеджеру</h3></div>
            <div className="list">
              {state.requests.map((r) => (
                <div key={r.requestId} className="row-item" style={{ alignItems: 'flex-start' }}>
                  <span className="grow">
                    <span className="title">{KIND_LABEL[r.kind]}</span>
                    <span className="sub" style={{ whiteSpace: 'normal' }}>{r.reason}</span>
                    <span className="sub">{r.lessonStartsAt ? `${r.studentName}, ${fmtDateTime(r.lessonStartsAt)}` : r.requestedStartAt ? `с ${fmtDateTime(r.requestedStartAt)}` : ''}</span>
                  </span>
                  <Badge tone={r.status === 'PENDING' ? (r.emergency ? 'coral' : 'yellow') : 'teal'}>{r.status === 'PENDING' ? (r.emergency ? 'Экстренно' : 'Ждёт') : 'Решён'}</Badge>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {lesson && (
        <Panel title={lesson.studentName} onClose={() => setSelected(null)} header={<Avatar name={lesson.studentName} size="lg" />}>
          <section className="card">
            <dl className="kv">
              <dt>Время</dt><dd>{fmtDateTime(lesson.startsAt)} – {fmtTime(lesson.endsAt)}</dd>
              <dt>Тип</dt><dd>{lesson.kind === 'TRIAL' ? 'Пробный: формальная диагностика (9.14)' : 'Регулярный'}</dd>
              <dt>Google Meet</dt><dd>{lesson.meetLinkState === 'PRESENT' ? 'Постоянная ссылка пары, откроется за 10 мин' : <span className="neg">Ссылка не создана</span>}</dd>
              <dt>Результат</dt><dd>{state.reports[lesson.lessonId] ? 'Внесён' : lesson.endsAt <= state.now ? 'Ждёт внесения' : '—'}</dd>
            </dl>
          </section>
          {lesson.status === 'SCHEDULED' && lesson.startsAt > state.now && (
            <button type="button" className="btn btn-ghost" onClick={() => { setRequestFor(lesson.lessonId); setSelected(null); }}>Запросить перенос или отмену</button>
          )}
        </Panel>
      )}
      {requestFor !== undefined && <RequestDialog lessonId={requestFor} onClose={() => setRequestFor(undefined)} />}
    </div>
  );
}

function RequestDialog({ lessonId, onClose }: { lessonId: string | null; onClose: () => void }) {
  const { state, run } = useTeacher();
  const [kind, setKind] = useState<RequestKind>(lessonId ? 'SINGLE_CANCEL' : 'PERMANENT_CHANGE');
  const [lesson, setLesson] = useState(lessonId ?? '');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [emergency, setEmergency] = useState(false);
  const future = state.lessons.filter((l) => l.status === 'SCHEDULED' && l.startsAt > state.now);
  return (
    <Panel title="Запрос менеджеру" variant="modal" onClose={onClose}>
      <form style={{ display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); if (run({ type: 'request.create', kind, lessonId: kind === 'SINGLE_CANCEL' ? lesson : null, startsAt: date ? new Date(`${date}T09:00`).toISOString() : null, reason, emergency }).ok) onClose(); }}>
        <div className="seg" role="radiogroup" aria-label="Тип запроса">
          {(Object.keys(KIND_LABEL) as RequestKind[]).map((k) => (
            <label key={k}><input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />{KIND_LABEL[k]}</label>
          ))}
        </div>
        <Notice tone="blue">Срок уведомления: не позднее чем за {NOTICE[kind].label}.{kind === 'PERMANENT_CHANGE' ? ' Изменение вступит в силу со следующего понедельника после согласования.' : ''}</Notice>
        {kind === 'SINGLE_CANCEL' ? (
          <div className="field">
            <label htmlFor="rq-lesson">Урок</label>
            <select id="rq-lesson" required value={lesson} onChange={(e) => setLesson(e.target.value)}>
              <option value="">Выберите урок</option>
              {future.map((l) => <option key={l.lessonId} value={l.lessonId}>{fmtDateTime(l.startsAt)} — {l.studentName}</option>)}
            </select>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="rq-date">{kind === 'ABSENCE' ? 'Первый день отсутствия' : 'С какой даты'}</label>
            <input id="rq-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="rq-reason">Причина</label>
          <textarea id="rq-reason" rows={3} required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <label className="check"><input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} />Экстренный случай (болезнь, авария) — срок уведомления не соблюдается</label>
        <button type="submit" className="btn btn-dark">Отправить</button>
      </form>
    </Panel>
  );
}
