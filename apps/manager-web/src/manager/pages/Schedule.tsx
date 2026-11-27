import { ChevronLeft, ChevronRight, Video, VideoOff } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HBarList, Segmented } from '../../shared/analytics';
import { dayKey, fmtDateTime, fmtTime, plural } from '../../shared/format';
import { Avatar, Badge, Notice, Panel } from '../../shared/ui';
import { addDays, dayLabel, WeekGrid, weekDays, weekRangeLabel, type GridColumn } from '../../shared/WeekGrid';
import { lessonStatus } from '../labels';
import { useManager } from '../store';
import type { LessonView } from '../types';

type View = 'week' | 'day';
type Kind = 'ALL' | 'REGULAR' | 'TRIAL';

/**
 * Manager schedule. Week view answers "what does this teacher's week look like";
 * day view puts teachers side by side to find gaps and overlaps. View, teacher and
 * date live in the URL, so links from the dashboard and Back keep the context.
 * Booking/rescheduling rules are unchanged: only the existing cancel command is offered.
 */
export function Schedule() {
  const { state } = useManager();
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState<Kind>('ALL');
  const view: View = params.get('view') === 'day' ? 'day' : 'week';
  const teacherId = params.get('teacher');
  const today = dayKey(state.now);
  const rawDate = params.get('date');
  // Hand-edited or stale links must not break the page: fall back to today.
  const anchor = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !Number.isNaN(Date.parse(`${rawDate}T12:00:00Z`)) ? rawDate : today;
  const selected = params.get('lesson');
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const week = weekDays(`${anchor}T12:00:00Z`, 0);
  const range = view === 'week' ? week : [anchor];
  const teacher = state.teachers.find((t) => t.teacherId === teacherId) ?? null;
  const inRange = state.lessons.filter((l) => range.includes(dayKey(l.startsAt)) && (kind === 'ALL' || l.kind === kind));
  const visible = inRange.filter((l) => !teacher || l.teacherId === teacher.teacherId);
  const lesson = state.lessons.find((l) => l.lessonId === selected) ?? null;
  const noLink = visible.filter((l) => l.status === 'SCHEDULED' && !l.meetLink).length;
  const step = view === 'week' ? 7 : 1;

  const columns: GridColumn[] | undefined =
    view === 'day'
      ? (teacher ? [teacher] : state.teachers).map((t) => ({
          key: t.teacherId,
          day: anchor,
          label: t.name,
          head: (
            <span className="res">
              <Avatar name={t.name} />
              <b>{t.name.split(' ')[0]}</b>
            </span>
          ),
        }))
      : undefined;

  const perTeacher = state.teachers
    .map((t) => {
      const ls = inRange.filter((l) => l.teacherId === t.teacherId && l.status !== 'CANCELLED');
      const hours = ls.reduce((a, l) => a + (new Date(l.endsAt).getTime() - new Date(l.startsAt).getTime()) / 3600_000, 0);
      return { t, n: ls.length, hours };
    })
    .sort((a, b) => b.n - a.n);
  const linkFor = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('teacher', id);
    else next.delete('teacher');
    next.delete('lesson');
    return `/manager/schedule?${next.toString()}`;
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="page-head">
        <div>
          <h1>Расписание</h1>
          <p>Уроки учеников вашего портфеля и пробные занятия по заявкам.</p>
        </div>
        <div className="actions" style={{ alignItems: 'center' }}>
          <Segmented<View> label="Вид" value={view} onChange={(v) => set({ view: v === 'week' ? null : v })} options={[['day', 'День'], ['week', 'Неделя']]} />
          <button type="button" className="icon-btn" aria-label={view === 'week' ? 'Предыдущая неделя' : 'Предыдущий день'} onClick={() => set({ date: addDays(anchor, -step) })}>
            <ChevronLeft size={16} />
          </button>
          <span className="date-pill" style={{ display: 'inline-flex', minWidth: 190, justifyContent: 'center' }}>{view === 'week' ? weekRangeLabel(week) : dayLabel(anchor)}</span>
          <button type="button" className="icon-btn" aria-label={view === 'week' ? 'Следующая неделя' : 'Следующий день'} onClick={() => set({ date: addDays(anchor, step) })}>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={range.includes(today)} style={range.includes(today) ? { visibility: 'hidden' } : undefined} onClick={() => set({ date: null })}>
            Сегодня
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="Преподаватель">
          <button type="button" className="chip" aria-pressed={!teacher} onClick={() => set({ teacher: null })}>
            Все преподаватели
          </button>
          {state.teachers.map((t) => (
            <button key={t.teacherId} type="button" className="chip" aria-pressed={teacher?.teacherId === t.teacherId} onClick={() => set({ teacher: t.teacherId })}>
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar">
        <Segmented<Kind> label="Тип урока" value={kind} onChange={setKind} options={[['ALL', 'Все уроки'], ['REGULAR', 'Регулярные'], ['TRIAL', 'Пробные']]} />
        <span className="grow" />
        <div className="legend" style={{ marginTop: 0 }}>
          <span><i style={{ background: 'var(--c-people)' }} />Запланирован</span>
          <span><i style={{ background: 'var(--ok)' }} />Проведён</span>
          <span><i style={{ background: 'var(--yellow)' }} />Ждёт оценки</span>
          <span><i style={{ background: 'var(--danger)' }} />Оспорен</span>
          <span><i style={{ background: 'var(--c-prev)' }} />Отменён</span>
          <span><i style={{ background: 'var(--yellow-tint)', border: '1px solid var(--yellow)' }} />Пробный</span>
        </div>
      </div>

      {noLink > 0 && (
        <Notice tone="coral" icon={<VideoOff size={16} />}>
          {noLink} {plural(noLink, 'урок', 'урока', 'уроков')} без ссылки на видеовстречу в выбранном периоде.
        </Notice>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: 16, alignItems: 'start' }} className="schedule-layout">
        <WeekGrid
          days={view === 'week' ? week : undefined}
          columns={columns}
          now={state.now}
          onOpen={(id) => set({ lesson: id })}
          items={visible.map((l) => ({
            id: l.lessonId,
            column: l.teacherId,
            startsAt: l.startsAt,
            endsAt: l.endsAt,
            title: l.studentName,
            subtitle: `${l.kind === 'TRIAL' ? 'пробный · ' : ''}${teacher || view === 'day' ? l.subjectName : l.teacherName.split(' ')[0]}`,
            cancelled: l.status === 'CANCELLED',
            background: l.kind === 'TRIAL' ? 'var(--yellow-tint)' : l.status === 'CANCELLED' ? 'var(--surface-3)' : 'var(--info-tint)',
            edge: lessonEdge(l),
            label: `${fmtTime(l.startsAt)}–${fmtTime(l.endsAt)} ${l.studentName}, ${l.subjectName}, ${l.teacherName}, ${lessonStatus[l.status].label}${l.kind === 'TRIAL' ? ', пробный' : ''}`,
          }))}
        />

        <aside className="card" aria-labelledby="h-load" style={{ position: 'sticky', top: 12 }}>
          <div className="card-head">
            <h3 id="h-load">Уроки по преподавателям</h3>
          </div>
          <p className="section-note" style={{ marginTop: -6, marginBottom: 8 }}>
            {view === 'week' ? 'неделя' : 'день'} · без отменённых · только ваш портфель
          </p>
          <HBarList
            label="Количество уроков по преподавателям в выбранном периоде"
            rows={perTeacher.map(({ t, n, hours }) => ({
              key: t.teacherId,
              label: t.name,
              sub: n ? `${hours.toFixed(hours % 1 ? 1 : 0)} ч` : undefined,
              value: n,
              to: linkFor(teacher?.teacherId === t.teacherId ? null : t.teacherId),
              tone: teacher && teacher.teacherId !== t.teacherId ? ('muted' as const) : undefined,
            }))}
          />
        </aside>
      </div>

      {lesson && <LessonDrawer l={lesson} onClose={() => set({ lesson: null })} />}
    </div>
  );
}

/** Status is carried by the block's left edge; fill only distinguishes trial lessons. */
const lessonEdge = (l: LessonView) =>
  l.status === 'CANCELLED' ? 'var(--c-prev)'
  : l.status === 'DISPUTED' ? 'var(--danger)'
  : l.status === 'CONDUCTED' ? 'var(--ok)'
  : l.status === 'STAR_PENDING' ? 'var(--yellow)'
  : 'var(--c-people)';

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
