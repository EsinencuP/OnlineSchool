import { Check, ChevronLeft, ChevronRight, TriangleAlert, Video, VideoOff } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Segmented } from '../../shared/analytics';
import { dayKey, fmtDateTime, fmtTime, plural } from '../../shared/format';
import { addMonths, MonthGrid, MonthPicker, monthKeys, monthLabel } from '../../shared/MonthGrid';
import { Avatar, Badge, Notice, Panel } from '../../shared/ui';
import { addDays, dayLabel, WeekGrid, weekDays, weekRangeLabel, type GridColumn } from '../../shared/WeekGrid';
import { lessonStatus } from '../labels';
import { useManager } from '../store';
import type { LessonView } from '../types';

type View = 'day' | 'week' | 'month';
type Kind = 'ALL' | 'REGULAR' | 'TRIAL';

/** One colour per teacher, like separate calendars in Notion Calendar. */
const PALETTE = [
  { solid: '#e0a100', tint: '#fff1c2' },
  { solid: '#3d8ef0', tint: '#dcebfd' },
  { solid: '#ff5471', tint: '#ffdfe5' },
  { solid: '#00a9ae', tint: '#ccf1f1' },
  { solid: '#906ddf', tint: '#ebe3fc' },
  { solid: '#f08a24', tint: '#ffe6cf' },
];

const validDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ? v : null);

/**
 * Manager schedule in a Notion Calendar layout: left sidebar with a month picker and
 * teachers as toggleable colour-coded calendars; right side Day / Week / Month views.
 * Teacher colour = whose lesson; status = icon and strike-through. View, date and the
 * visible teachers live in the URL. Booking rules are unchanged: only cancel is offered.
 */
export function Schedule() {
  const { state } = useManager();
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState<Kind>('ALL');
  const today = dayKey(state.now);
  const rawView = params.get('view');
  const view: View = rawView === 'day' || rawView === 'month' ? rawView : 'week';
  const anchor = validDate(params.get('date')) ?? today;
  const selected = params.get('lesson');
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  // Visible teachers: `t` = comma list of ids; legacy `teacher` = one id; none = all.
  const ids = state.teachers.map((t) => t.teacherId);
  const rawT = params.get('t') ?? params.get('teacher');
  const visible = new Set(rawT ? rawT.split(',').filter((id) => ids.includes(id)) : ids);
  const setVisible = (next: Set<string>) => set({ t: next.size === ids.length || next.size === 0 ? null : [...next].join(','), teacher: null });
  const color = (teacherId: string) => PALETTE[Math.max(0, ids.indexOf(teacherId)) % PALETTE.length]!;

  const week = weekDays(`${anchor}T12:00:00Z`, 0);
  const range = view === 'day' ? [anchor] : view === 'week' ? week : monthKeys(anchor).filter((k) => k.slice(0, 7) === anchor.slice(0, 7));
  const inRange = new Set(range);
  const lessons = state.lessons.filter((l) => visible.has(l.teacherId) && (kind === 'ALL' || l.kind === kind));
  const shown = lessons.filter((l) => inRange.has(dayKey(l.startsAt)));
  const lesson = state.lessons.find((l) => l.lessonId === selected) ?? null;
  const noLink = shown.filter((l) => l.status === 'SCHEDULED' && !l.meetLink && l.startsAt > state.now).length;
  const busy = new Set(state.lessons.filter((l) => visible.has(l.teacherId) && l.status !== 'CANCELLED').map((l) => dayKey(l.startsAt)));

  const step = (dir: 1 | -1) => set({ date: view === 'month' ? addMonths(anchor, dir) : addDays(anchor, dir * (view === 'week' ? 7 : 1)) });
  const title = view === 'day' ? dayLabel(anchor) : view === 'week' ? weekRangeLabel(week) : monthLabel(anchor);
  const visibleTeachers = state.teachers.filter((t) => visible.has(t.teacherId));

  const columns: GridColumn[] | undefined =
    view === 'day'
      ? visibleTeachers.map((t) => ({
          key: t.teacherId,
          day: anchor,
          label: t.name,
          head: (
            <span className="res">
              <i className="res-dot" style={{ background: color(t.teacherId).solid }} />
              <b>{t.name}</b>
            </span>
          ),
        }))
      : undefined;

  const marker = (l: LessonView) =>
    l.status === 'CONDUCTED' ? <Check size={12} aria-hidden="true" /> : l.status === 'DISPUTED' ? <TriangleAlert size={12} aria-hidden="true" /> : null;
  const describe = (l: LessonView) =>
    `${fmtTime(l.startsAt)}–${fmtTime(l.endsAt)} ${l.studentName}, ${l.subjectName}, ${l.teacherName}, ${lessonStatus[l.status].label}${l.kind === 'TRIAL' ? ', пробный' : ''}`;

  return (
    <div className="ncal-page">
      <div className="page-head">
        <div>
          <h1>Расписание</h1>
          <p>Уроки учеников вашего портфеля и пробные занятия по заявкам. Каждый преподаватель — свой календарь и свой цвет.</p>
        </div>
      </div>

      <div className="ncal">
        <aside className="ncal-side card" aria-label="Календари">
          <MonthPicker anchor={anchor} today={today} inRange={(k) => inRange.has(k)} busy={busy} onPick={(k) => set({ date: k === today ? null : k })} onMonth={(k) => set({ date: k })} />

          <div className="ncal-list">
            <div className="ncal-list-head">
              <b>Преподаватели</b>
              <button type="button" className="link" onClick={() => setVisible(new Set(visible.size === ids.length ? [] : ids))}>
                {visible.size === ids.length ? 'Скрыть всех' : 'Показать всех'}
              </button>
            </div>
            {state.teachers.map((t) => {
              const on = visible.has(t.teacherId);
              const c = color(t.teacherId);
              const n = state.lessons.filter((l) => l.teacherId === t.teacherId && l.status !== 'CANCELLED' && inRange.has(dayKey(l.startsAt))).length;
              return (
                <div key={t.teacherId} className="ncal-cal">
                  <label>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        const next = new Set(visible);
                        if (on) next.delete(t.teacherId);
                        else next.add(t.teacherId);
                        setVisible(next);
                      }}
                    />
                    <span className="ncal-box" style={{ background: on ? c.solid : 'transparent', borderColor: c.solid }} aria-hidden="true">
                      {on && <Check size={12} />}
                    </span>
                    <span className="ncal-name">
                      {t.name}
                      <small>{t.subjects.join(', ')}</small>
                    </span>
                  </label>
                  <button type="button" className="ncal-only" onClick={() => setVisible(new Set([t.teacherId]))} aria-label={`Показать только ${t.name}`}>
                    только
                  </button>
                  <span className="ncal-count num" title="Уроков в выбранном периоде, без отменённых">
                    {n}
                  </span>
                </div>
              );
            })}
          </div>

          <Segmented<Kind> label="Тип урока" value={kind} onChange={setKind} options={[['ALL', 'Все'], ['REGULAR', 'Регулярные'], ['TRIAL', 'Пробные']]} />

          <div className="ncal-legend">
            <span><Check size={12} /> проведён</span>
            <span><TriangleAlert size={12} /> оспорен</span>
            <span><s>отменён</s></span>
            <span><i className="trial-swatch" /> пробный</span>
          </div>
        </aside>

        <section className="ncal-main card" aria-label="Календарь">
          <div className="ncal-bar">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ date: null })} disabled={inRange.has(today)}>
              Сегодня
            </button>
            <button type="button" className="icon-btn" aria-label="Назад" onClick={() => step(-1)}>
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="icon-btn" aria-label="Вперёд" onClick={() => step(1)}>
              <ChevronRight size={16} />
            </button>
            <h2 className="ncal-title">{title}</h2>
            <span className="grow" />
            <Segmented<View> label="Вид" value={view} onChange={(v) => set({ view: v === 'week' ? null : v })} options={[['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']]} />
          </div>

          {noLink > 0 && (
            <Notice tone="coral" icon={<VideoOff size={16} />}>
              {noLink} {plural(noLink, 'предстоящий урок', 'предстоящих урока', 'предстоящих уроков')} без ссылки на видеовстречу.
            </Notice>
          )}

          {visible.size === 0 ? (
            <p className="muted" style={{ padding: 24, textAlign: 'center' }}>Отметьте хотя бы одного преподавателя слева.</p>
          ) : view === 'month' ? (
            <MonthGrid
              anchor={anchor}
              today={today}
              onOpen={(id) => set({ lesson: id })}
              onDay={(k) => set({ view: 'day', date: k })}
              items={lessons.map((l) => ({
                id: l.lessonId,
                startsAt: l.startsAt,
                title: l.studentName,
                color: color(l.teacherId).solid,
                tint: color(l.teacherId).tint,
                cancelled: l.status === 'CANCELLED',
                marker: marker(l),
                label: describe(l),
              }))}
            />
          ) : (
            <WeekGrid
              days={view === 'week' ? week : undefined}
              columns={columns}
              now={state.now}
              onOpen={(id) => set({ lesson: id })}
              items={shown.map((l) => ({
                id: l.lessonId,
                column: l.teacherId,
                startsAt: l.startsAt,
                endsAt: l.endsAt,
                title: l.studentName,
                subtitle: `${l.kind === 'TRIAL' ? 'пробный · ' : ''}${l.status === 'CONDUCTED' ? '✓ ' : l.status === 'DISPUTED' ? '⚠ ' : ''}${l.subjectName}`,
                cancelled: l.status === 'CANCELLED',
                background: color(l.teacherId).tint,
                edge: color(l.teacherId).solid,
                trial: l.kind === 'TRIAL',
                alert: l.status === 'DISPUTED',
                label: describe(l),
              }))}
            />
          )}
        </section>
      </div>

      {lesson && <LessonDrawer l={lesson} onClose={() => set({ lesson: null })} />}
    </div>
  );
}

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
