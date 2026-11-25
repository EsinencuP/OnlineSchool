import { ChevronLeft, ChevronRight, Video, VideoOff } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Badge, Bar, Notice, Panel } from '../../shared/ui';
import { useManager } from '../store';
import type { LessonView } from '../types';
import { dayKey, fmtDateTime, fmtTime } from '../../shared/format';
import { lessonStatus } from '../labels';
import { WeekGrid, weekDays, weekRangeLabel } from '../../shared/WeekGrid';

export function Schedule() {
  const { state } = useManager();
  const [week, setWeek] = useState(0);
  const [kind, setKind] = useState<'ALL' | 'REGULAR' | 'TRIAL'>('ALL');
  const [selected, setSelected] = useState<string | null>(null);

  const days = weekDays(state.now, week);
  const keys = days.map((d) => dayKey(d.toISOString()));
  const inWeek = state.lessons.filter((l) => keys.includes(dayKey(l.startsAt)) && (kind === 'ALL' || l.kind === kind));
  const lesson = state.lessons.find((l) => l.lessonId === selected) ?? null;
  const range = weekRangeLabel(days);
  const noLink = inWeek.filter((l) => l.status === 'SCHEDULED' && !l.meetLink).length;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Расписание</h1>
          <p>Уроки учеников вашего портфеля и пробные занятия по заявкам.</p>
        </div>
        <div className="actions" style={{ alignItems: 'center' }}>
          <button type="button" className="icon-btn" aria-label="Предыдущая неделя" onClick={() => setWeek((w) => w - 1)}><ChevronLeft size={16} /></button>
          <span className="date-pill" style={{ display: 'inline-flex' }}>{range}</span>
          <button type="button" className="icon-btn" aria-label="Следующая неделя" onClick={() => setWeek((w) => w + 1)}><ChevronRight size={16} /></button>
          {week !== 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWeek(0)}>Сегодня</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="chips" role="group" aria-label="Тип урока">
          {([['ALL', 'Все'], ['REGULAR', 'Регулярные'], ['TRIAL', 'Пробные']] as const).map(([k, label]) => (
            <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
        <div className="legend" style={{ marginTop: 0, marginLeft: 'auto' }}>
          <span><i style={{ background: 'var(--blue)' }} />Регулярный</span>
          <span><i style={{ background: 'var(--yellow)' }} />Пробный</span>
          <span><i style={{ background: 'var(--coral)' }} />Оспорен</span>
          <span><i style={{ background: 'var(--surface-3)' }} />Отменён</span>
        </div>
      </div>

      {noLink > 0 && <Notice tone="coral" icon={<VideoOff size={16} />}>На этой неделе {noLink} урок(а) без ссылки на видеовстречу.</Notice>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 20 }} className="schedule-layout">
        <WeekGrid
          days={days}
          now={state.now}
          onOpen={setSelected}
          items={inWeek.map((l) => ({
            id: l.lessonId,
            startsAt: l.startsAt,
            endsAt: l.endsAt,
            title: l.studentName,
            subtitle: l.kind === 'TRIAL' ? 'пробный' : l.subjectName,
            cancelled: l.status === 'CANCELLED',
            background: lessonBg(l),
            label: `${fmtTime(l.startsAt)} ${l.studentName}, ${l.subjectName}, ${lessonStatus[l.status].label}`,
          }))}
        />

        <aside className="card" aria-labelledby="h-load" style={{ alignSelf: 'start' }}>
          <div className="card-head"><h3 id="h-load">Загрузка преподавателей</h3></div>
          <div style={{ display: 'grid', gap: 14 }}>
            {state.teachers.map((t) => (
              <div key={t.teacherId} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={t.name} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b style={{ display: 'block', fontSize: 13 }}>{t.name}</b>
                    <span className="muted" style={{ fontSize: 12 }}>{t.subjects.join(', ')}</span>
                  </div>
                  <b className="num" style={{ fontSize: 13 }}>{t.loadPercent}%</b>
                </div>
                <Bar value={t.loadPercent} max={100} color={t.loadPercent > 85 ? 'var(--coral)' : t.loadPercent > 60 ? 'var(--yellow)' : 'var(--teal)'} />
              </div>
            ))}
          </div>
        </aside>
      </div>

      {lesson && <LessonDrawer l={lesson} onClose={() => setSelected(null)} />}
    </div>
  );
}

const lessonBg = (l: LessonView) =>
  l.status === 'CANCELLED' ? 'var(--surface-3)'
  : l.status === 'DISPUTED' ? 'var(--coral-tint)'
  : l.kind === 'TRIAL' ? 'var(--yellow-tint)'
  : l.status === 'CONDUCTED' ? 'var(--teal-tint)'
  : 'var(--blue-tint)';

function LessonDrawer({ l, onClose }: { l: LessonView; onClose: () => void }) {
  const { state, run } = useManager();
  const [reason, setReason] = useState('');
  const future = l.startsAt > state.now;
  return (
    <Panel title={l.studentName} onClose={onClose} header={<Avatar name={l.studentName} size="lg" />}>
      <div className="chips">
        <Badge tone={lessonStatus[l.status].tone}>{lessonStatus[l.status].label}</Badge>
        <Badge tone={l.kind === 'TRIAL' ? 'yellow' : 'blue'}>{l.kind === 'TRIAL' ? 'Пробный урок' : 'Регулярный урок'}</Badge>
      </div>
      <section className="card">
        <dl className="kv">
          <dt>Время</dt>
          <dd>{fmtDateTime(l.startsAt)} – {fmtTime(l.endsAt)}</dd>
          <dt>Предмет</dt>
          <dd>{l.subjectName}</dd>
          <dt>Преподаватель</dt>
          <dd>{l.teacherName}</dd>
          <dt>Видеовстреча</dt>
          <dd>{l.meetLink ? <a href={l.meetLink} target="_blank" rel="noreferrer"><Video size={13} /> {l.meetLink.replace('https://', '')}</a> : <span className="neg">Ссылка не добавлена</span>}</dd>
          {l.chargedLessons > 0 && (<><dt>Списано</dt><dd>{l.chargedLessons} зан.</dd></>)}
        </dl>
      </section>
      {l.status === 'SCHEDULED' && future && (
        <section className="card">
          <div className="card-head"><h3>Отменить урок</h3></div>
          <form style={{ display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); if (run({ type: 'lesson.cancel', lessonId: l.lessonId, reason }).ok) onClose(); }}>
            <div className="field">
              <label htmlFor="cancel-reason">Причина</label>
              <input id="cancel-reason" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например: болезнь ученика" />
              <span className="hint">Отмена менее чем за 24 часа может потребовать согласования директора.</span>
            </div>
            <button type="submit" className="btn btn-danger">Отменить урок</button>
          </form>
        </section>
      )}
    </Panel>
  );
}
