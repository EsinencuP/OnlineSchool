import { CalendarDays, ChevronLeft, ChevronRight, Columns3, List, Search, Video, VideoOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Segmented, SortTh, useSort } from '../../shared/analytics';
import { dayKey, fmtDateTime, fmtTime, plural } from '../../shared/format';
import { addMonths, MonthGrid, monthLabel, monthStart } from '../../shared/MonthGrid';
import { Badge, Empty, Panel, type Tone } from '../../shared/ui';
import { weekDays } from '../../shared/WeekGrid';
import { selectJournal } from '../logic';
import { useTeacher } from '../store';
import type { TeacherLesson } from '../types';

type Range = 'upcoming' | 'today' | 'week' | 'month' | 'last' | 'all' | 'custom';
type Status = 'ALL' | 'PLANNED' | 'AWAITING' | 'OVERDUE' | 'DONE' | 'CANCELLED';
type Col = 'subject' | 'kind' | 'report' | 'meet';
type SortKey = 'date' | 'student';

const STATUS: Record<Exclude<Status, 'ALL'>, { label: string; tone: Tone }> = {
  PLANNED: { label: 'Запланирован', tone: 'blue' },
  AWAITING: { label: 'Ждёт результата', tone: 'yellow' },
  OVERDUE: { label: 'Отчёт просрочен', tone: 'coral' },
  DONE: { label: 'Проведён', tone: 'teal' },
  CANCELLED: { label: 'Отменён', tone: 'neutral' },
};
const RANGES: [Range, string][] = [
  ['upcoming', 'Предстоящие'],
  ['today', 'Сегодня'],
  ['week', 'Эта неделя'],
  ['month', 'Этот месяц'],
  ['last', 'Прошлый месяц'],
  ['all', 'Все'],
];
const COLS: [Col, string][] = [
  ['subject', 'Предмет'],
  ['kind', 'Тип'],
  ['report', 'Результат урока'],
  ['meet', 'Видеовстреча'],
];
const COLS_KEY = 'teacher.lessons.columns';
const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
const readCols = (): Col[] => {
  try {
    const v = JSON.parse(window.localStorage.getItem(COLS_KEY) ?? 'null') as unknown;
    return Array.isArray(v) ? (v.filter((c) => COLS.some(([k]) => k === c)) as Col[]) : COLS.map(([k]) => k);
  } catch {
    return COLS.map(([k]) => k);
  }
};

/**
 * All of the teacher's lessons (past and future) as a working table: search, status,
 * student, type, quick periods or a custom range, column picker, and a month calendar
 * of the same filtered set. Every filter lives in the URL.
 */
export function TeacherLessons() {
  const { state } = useTeacher();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [cols, setCols] = useState<Col[]>(readCols);
  const [colsOpen, setColsOpen] = useState(false);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const today = dayKey(state.now);
  const q = params.get('q') ?? '';
  const view = params.get('view') === 'calendar' ? 'calendar' : 'list';
  const from = isDate(params.get('from')) ? params.get('from')! : null;
  const to = isDate(params.get('to')) ? params.get('to')! : null;
  const rawRange = params.get('range') as Range | null;
  const range: Range = from || to ? 'custom' : RANGES.some(([k]) => k === rawRange) ? rawRange! : 'upcoming';
  const rawStatus = params.get('status') as Status | null;
  const status: Status = rawStatus && (rawStatus === 'ALL' || rawStatus in STATUS) ? rawStatus : 'ALL';
  const kind = params.get('kind') === 'TRIAL' || params.get('kind') === 'REGULAR' ? params.get('kind')! : 'ALL';
  const studentId = params.get('student');
  const selected = params.get('lesson');

  const journal = new Map(selectJournal(state).map((j) => [j.lessonId, j]));
  const statusOf = (l: TeacherLesson): Exclude<Status, 'ALL'> => {
    if (l.status === 'CANCELLED') return 'CANCELLED';
    const j = journal.get(l.lessonId);
    if (!j) return 'PLANNED';
    if (j.state === 'AWAITING_REPORT') return j.overdue ? 'OVERDUE' : 'AWAITING';
    return j.state === 'CANCELLED' ? 'CANCELLED' : 'DONE';
  };

  const week = weekDays(state.now, 0);
  const inRange = (l: TeacherLesson) => {
    const k = dayKey(l.startsAt);
    switch (range) {
      case 'upcoming':
        return l.startsAt >= state.now;
      case 'today':
        return k === today;
      case 'week':
        return k >= week[0]! && k <= week[6]!;
      case 'month':
        return k.slice(0, 7) === today.slice(0, 7);
      case 'last':
        return k.slice(0, 7) === addMonths(today, -1).slice(0, 7);
      case 'custom':
        return (!from || k >= from) && (!to || k <= to);
      default:
        return true;
    }
  };
  const needle = q.trim().toLowerCase();
  const base = state.lessons.filter(
    (l) =>
      inRange(l) &&
      (kind === 'ALL' || l.kind === kind) &&
      (!studentId || l.studentId === studentId) &&
      (!needle || `${l.studentName} ${l.subjectName}`.toLowerCase().includes(needle)),
  );
  const rows = base.filter((l) => status === 'ALL' || statusOf(l) === status);
  const { sorted, sort, toggle } = useSort<TeacherLesson, SortKey>(rows, { key: 'date', dir: range === 'upcoming' ? 'asc' : 'desc' }, (l, k) => (k === 'date' ? l.startsAt : l.studentName));
  const students = [...new Map(state.lessons.map((l) => [l.studentId, l.studentName])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'ru'));
  const lesson = state.lessons.find((l) => l.lessonId === selected) ?? null;
  const calMonth = isDate(params.get('month')) ? params.get('month')! : from ?? (range === 'last' ? addMonths(today, -1) : today);
  const show = (c: Col) => cols.includes(c);
  const toggleCol = (c: Col) => {
    const next = show(c) ? cols.filter((x) => x !== c) : [...cols, c];
    setCols(next);
    try {
      window.localStorage.setItem(COLS_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: keep the choice for this visit only
    }
  };
  const filtered = q || status !== 'ALL' || kind !== 'ALL' || studentId || range !== 'upcoming';

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Уроки</h1>
          <p>Все ваши уроки — прошедшие и будущие. Фильтры сохраняются в адресе страницы.</p>
        </div>
        <div className="actions">
          <Segmented
            label="Вид"
            value={view}
            onChange={(v) => set({ view: v === 'list' ? null : v })}
            options={[
              ['list', <span key="l" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><List size={15} /> Список</span>],
              ['calendar', <span key="c" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><CalendarDays size={15} /> Календарь</span>],
            ]}
          />
        </div>
      </div>

      <section className="card lessons-filters" aria-label="Фильтры уроков">
        <div className="toolbar">
          <label className="filter-search grow">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Поиск по ученику или предмету</span>
            <input value={q} placeholder="Ученик или предмет" onChange={(e) => set({ q: e.target.value })} />
          </label>
          <label className="filter-select">
            <span className="sr-only">Ученик</span>
            <select value={studentId ?? ''} onChange={(e) => set({ student: e.target.value || null })}>
              <option value="">Все ученики</option>
              {students.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <Segmented label="Тип урока" value={kind} onChange={(v) => set({ kind: v === 'ALL' ? null : v })} options={[['ALL', 'Все'], ['REGULAR', 'Регулярные'], ['TRIAL', 'Пробные']]} />
        </div>
        <div className="toolbar">
          <div className="chips" role="group" aria-label="Период">
            {RANGES.map(([k, label]) => (
              <button key={k} type="button" className="chip" aria-pressed={range === k} onClick={() => set({ range: k === 'upcoming' ? null : k, from: null, to: null, month: null })}>
                {label}
              </button>
            ))}
          </div>
          <span className="grow" />
          <label className="date-field">
            <span>с</span>
            <input type="date" value={from ?? ''} onChange={(e) => set({ from: e.target.value || null, range: null, month: null })} />
          </label>
          <label className="date-field">
            <span>по</span>
            <input type="date" value={to ?? ''} onChange={(e) => set({ to: e.target.value || null, range: null, month: null })} />
          </label>
        </div>
        <div className="toolbar">
          <div className="chips" role="group" aria-label="Статус">
            <button type="button" className="chip" aria-pressed={status === 'ALL'} onClick={() => set({ status: null })}>
              Все статусы <span className="n">{base.length}</span>
            </button>
            {(Object.keys(STATUS) as Exclude<Status, 'ALL'>[]).map((s) => {
              const n = base.filter((l) => statusOf(l) === s).length;
              return (
                <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => set({ status: s })} disabled={n === 0 && status !== s}>
                  {STATUS[s].label} <span className="n">{n}</span>
                </button>
              );
            })}
          </div>
          <span className="grow" />
          {filtered && (
            <button type="button" className="link" onClick={() => setParams(view === 'calendar' ? { view: 'calendar' } : {}, { replace: true })}>
              Сбросить фильтры
            </button>
          )}
          {view === 'list' && (
            <div className="cols-menu">
              <button type="button" className="btn btn-ghost btn-sm" aria-expanded={colsOpen} onClick={() => setColsOpen((v) => !v)}>
                <Columns3 size={15} /> Колонки
              </button>
              {colsOpen && (
                <div className="cols-pop" role="group" aria-label="Видимые колонки">
                  {COLS.map(([k, label]) => (
                    <label key={k} className="check">
                      <input type="checkbox" checked={show(k)} onChange={() => toggleCol(k)} /> {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {view === 'calendar' ? (
        <section className="card" style={{ display: 'grid', gap: 12 }}>
          <div className="ncal-bar">
            <button type="button" className="icon-btn" aria-label="Предыдущий месяц" onClick={() => set({ month: addMonths(calMonth, -1) })}>
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="icon-btn" aria-label="Следующий месяц" onClick={() => set({ month: addMonths(calMonth, 1) })}>
              <ChevronRight size={16} />
            </button>
            <h2 className="ncal-title">{monthLabel(calMonth)}</h2>
            <span className="grow" />
            <span className="muted" style={{ fontSize: 13 }}>
              {rows.length} {plural(rows.length, 'урок', 'урока', 'уроков')} по фильтрам
            </span>
          </div>
          <MonthGrid
            anchor={monthStart(calMonth)}
            today={today}
            onOpen={(id) => set({ lesson: id })}
            onDay={(k) => set({ from: k, to: k, range: null, view: null, month: null })}
            items={rows.map((l) => {
              const st = statusOf(l);
              const c = st === 'DONE' ? ['var(--teal)', 'var(--teal-tint)'] : st === 'OVERDUE' ? ['var(--coral)', 'var(--coral-tint)'] : st === 'AWAITING' ? ['var(--yellow)', 'var(--yellow-tint)'] : st === 'CANCELLED' ? ['#b9b3a6', 'var(--surface-3)'] : ['var(--blue)', 'var(--blue-tint)'];
              return { id: l.lessonId, startsAt: l.startsAt, title: l.studentName, color: c[0]!, tint: c[1]!, cancelled: st === 'CANCELLED', label: `${fmtDateTime(l.startsAt)} ${l.studentName}, ${STATUS[st].label}` };
            })}
          />
        </section>
      ) : sorted.length === 0 ? (
        <section className="card">
          <Empty title="Уроков не найдено" text="Измените период или сбросьте фильтры." />
        </section>
      ) : (
        <div className="table-wrap boxed">
          <table>
            <thead>
              <tr>
                <SortTh k="date" sort={sort} onSort={toggle}>Дата и время</SortTh>
                <SortTh k="student" sort={sort} onSort={toggle}>Ученик</SortTh>
                {show('subject') && <th scope="col">Предмет</th>}
                {show('kind') && <th scope="col">Тип</th>}
                <th scope="col">Статус</th>
                {show('report') && <th scope="col">Результат урока</th>}
                {show('meet') && <th scope="col">Встреча</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => {
                const st = statusOf(l);
                const r = state.reports[l.lessonId];
                return (
                  <tr key={l.lessonId} tabIndex={0} onClick={() => set({ lesson: l.lessonId })} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), set({ lesson: l.lessonId }))}>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      {fmtDateTime(l.startsAt)}–{fmtTime(l.endsAt)}
                    </td>
                    <td>
                      <b>{l.studentName}</b>
                    </td>
                    {show('subject') && <td>{l.subjectName}</td>}
                    {show('kind') && <td>{l.kind === 'TRIAL' ? <Badge tone="yellow">Пробный</Badge> : 'Регулярный'}</td>}
                    <td>
                      <Badge tone={STATUS[st].tone}>{STATUS[st].label}</Badge>
                    </td>
                    {show('report') && (
                      <td className="muted" style={{ fontSize: 12, maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r?.note ?? '—'}
                      </td>
                    )}
                    {show('meet') && (
                      <td>
                        {l.status === 'CANCELLED' ? '—' : l.meetLinkState === 'MISSING' ? <Badge tone="coral"><VideoOff size={12} /> Нет</Badge> : <span className="muted"><Video size={14} aria-label="Ссылка есть" /></span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lesson && (
        <LessonPanel
          l={lesson}
          status={statusOf(lesson)}
          onClose={() => set({ lesson: null })}
          onReport={() => navigate(`/teacher/journal?lesson=${lesson.lessonId}`)}
          onRequest={() => navigate('/teacher/schedule?request=new')}
          onStudent={(id) => navigate(`/teacher/students?id=${id}`)}
        />
      )}
    </div>
  );
}

function LessonPanel({
  l,
  status,
  onClose,
  onReport,
  onRequest,
  onStudent,
}: {
  l: TeacherLesson;
  status: Exclude<Status, 'ALL'>;
  onClose: () => void;
  onReport: () => void;
  onRequest: () => void;
  onStudent: (enrollmentId: string) => void;
}) {
  const { state } = useTeacher();
  const r = state.reports[l.lessonId];
  const enrollment = state.enrollments.find((e) => e.studentId === l.studentId);
  const future = l.status === 'SCHEDULED' && l.startsAt > state.now;
  return (
    <Panel title={l.studentName} onClose={onClose}>
      <div className="chips">
        <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
        {l.kind === 'TRIAL' && <Badge tone="yellow">Пробный урок</Badge>}
      </div>
      <section className="card">
        <dl className="kv">
          <dt>Время</dt>
          <dd>
            {fmtDateTime(l.startsAt)} – {fmtTime(l.endsAt)}
          </dd>
          <dt>Предмет</dt>
          <dd>{l.subjectName}</dd>
          <dt>Видеовстреча</dt>
          <dd>{l.meetLinkState === 'MISSING' ? <span className="neg">Ссылка не добавлена</span> : 'Ссылка есть'}</dd>
          {r && (
            <>
              <dt>Результат</dt>
              <dd>
                {r.result === 'CONDUCTED' ? 'Проведён' : 'Не проведён'}
                {r.studentNoShow ? ' · ученик не пришёл' : ''} · {r.durationMin} мин
              </dd>
              <dt>Заметка</dt>
              <dd>{r.note ?? '—'}</dd>
            </>
          )}
        </dl>
      </section>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(status === 'AWAITING' || status === 'OVERDUE') && (
          <button type="button" className="btn btn-dark" onClick={onReport}>
            Внести результат
          </button>
        )}
        {future && (
          <button type="button" className="btn btn-ghost" onClick={onRequest}>
            Запросить перенос или отмену
          </button>
        )}
        {enrollment && (
          <button type="button" className="btn btn-ghost" onClick={() => onStudent(enrollment.enrollmentId)}>
            Карточка ученика
          </button>
        )}
      </div>
    </Panel>
  );
}

