import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Ring } from '../../shared/charts';
import { dayKey, fmtDateTime, fmtDay, fmtTime } from '../../shared/format';
import { Avatar, Badge, Bar, Empty, Panel } from '../../shared/ui';
import { plural } from '../../shared/format';
import { lessonsToNextReview, selectJournal } from '../logic';
import { HW_STATE } from './Work';
import { useTeacher } from '../store';
import type { Enrollment, SkillStatus, TeacherSkill } from '../types';

export const SKILL: Record<SkillStatus, { label: string; color: string; tone: 'neutral' | 'blue' | 'yellow' | 'teal' }> = {
  NOT_STUDIED: { label: 'Ещё не изучали', color: 'var(--surface-3)', tone: 'neutral' },
  FAMILIARIZING: { label: 'Знакомлюсь', color: 'var(--blue)', tone: 'blue' },
  PRACTICING: { label: 'Практикую', color: 'var(--yellow)', tone: 'yellow' },
  APPLYING: { label: 'Применяю', color: 'var(--teal)', tone: 'teal' },
};
const ORDER: SkillStatus[] = ['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING'];

export function TeacherStudents() {
  const { state } = useTeacher();
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').toLowerCase();
  const selected = state.enrollments.find((e) => e.enrollmentId === params.get('id')) ?? null;
  const rows = state.enrollments.filter((e) => !q || e.studentName.toLowerCase().includes(q));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Мои ученики</h1>
          <p>Только назначенные вам ученики. Образовательная история переходит вместе с учеником при смене преподавателя.</p>
        </div>
      </div>
      {rows.length === 0 ? <section className="card"><Empty title="Никого не нашли" /></section> : (
        <div className="grid-3">
          {rows.map((e) => <StudentCard key={e.enrollmentId} e={e} onOpen={() => setParams({ id: e.enrollmentId })} />)}
        </div>
      )}
      {selected && <StudentPanel e={selected} onClose={() => setParams({}, { replace: true })} />}
    </div>
  );
}

function StudentCard({ e, onOpen }: { e: Enrollment; onOpen: () => void }) {
  const { state } = useTeacher();
  const skills = state.skills[e.enrollmentId] ?? [];
  const toReview = lessonsToNextReview(e.confirmedLessons);
  const hw = state.homework.filter((h) => h.studentId === e.studentId && h.state === 'AWAITING_REVIEW').length;
  const frozen = !e.nextLessonAt;
  return (
    <button type="button" className="card" style={{ textAlign: 'left', border: 0, display: 'grid', gap: 12 }} onClick={onOpen}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Avatar name={e.studentName} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block' }}>{e.studentName}</b>
          <span className="muted" style={{ fontSize: 12 }}>{e.subjectName} · с {fmtDay(e.assignedFrom)}</span>
        </div>
        {frozen ? <Badge tone="violet">Пауза</Badge> : hw > 0 ? <Badge tone="coral">ДЗ: {hw}</Badge> : null}
      </div>
      <div className="stack-bar" style={{ height: 14 }} role="img" aria-label="Распределение навыков">
        {ORDER.slice().reverse().map((s) => {
          const v = skills.filter((k) => k.status === s).length;
          return v ? <div key={s} style={{ flex: v, background: SKILL[s].color, borderRadius: 6 }} /> : null;
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>Подтверждено уроков: <b className="num">{e.confirmedLessons}</b></span>
        <span className="muted">до пересмотра: {toReview}</span>
      </div>
      <span className="muted" style={{ fontSize: 12 }}>{e.nextLessonAt ? `Следующий урок ${fmtDateTime(e.nextLessonAt)}` : 'Уроков не запланировано (заморозка)'}</span>
    </button>
  );
}

type Tab = 'overview' | 'skills' | 'goals' | 'homework' | 'lessons' | 'reports';
const TABS: [Tab, string][] = [
  ['overview', 'Обзор'],
  ['skills', 'Навыки'],
  ['goals', 'Цели'],
  ['homework', 'Задания'],
  ['lessons', 'Уроки'],
  ['reports', 'Отчёты'],
];

/**
 * One place for a student: overview with per-subject lesson stats, skills, goals, homework,
 * full lesson history and checkpoint reports. Tab is kept in the URL (?id=…&tab=…).
 * "Осталось по абонементу" is not shown: the teacher API does not expose subscriptions.
 */
function StudentPanel({ e, onClose }: { e: Enrollment; onClose: () => void }) {
  const { state, run } = useTeacher();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab') as Tab | null;
  const tab: Tab = TABS.some(([k]) => k === rawTab) ? rawTab! : 'overview';
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === 'overview') next.delete('tab');
    else next.set('tab', t);
    setParams(next, { replace: true });
  };
  const skills = state.skills[e.enrollmentId] ?? [];
  const goals = state.goals.filter((g) => g.enrollmentId === e.enrollmentId);
  const hw = state.homework.filter((h) => h.studentId === e.studentId);
  const [editing, setEditing] = useState<TeacherSkill | null>(null);
  const [goalText, setGoalText] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDesc, setHwDesc] = useState('');
  const [hwDue, setHwDue] = useState('');
  const toReview = lessonsToNextReview(e.confirmedLessons);

  const journal = new Map(selectJournal(state).map((j) => [j.lessonId, j]));
  const lessons = state.lessons.filter((l) => l.studentId === e.studentId && l.subjectName === e.subjectName);
  const planned = lessons.filter((l) => l.status === 'SCHEDULED' && l.startsAt > state.now);
  const cancelled = lessons.filter((l) => l.status === 'CANCELLED');
  const awaiting = lessons.filter((l) => journal.get(l.lessonId)?.state === 'AWAITING_REPORT');
  const thisMonth = lessons.filter((l) => l.status !== 'CANCELLED' && dayKey(l.startsAt).slice(0, 7) === dayKey(state.now).slice(0, 7));
  const recent = lessons.filter((l) => l.endsAt <= state.now).slice(-4).reverse();
  const cps = state.checkpoints.filter((c) => c.enrollmentId === e.enrollmentId);
  const lessonState = (lessonId: string, status: string) => {
    if (status === 'CANCELLED') return { label: 'Отменён', tone: 'neutral' as const };
    const j = journal.get(lessonId);
    if (!j) return { label: 'Запланирован', tone: 'blue' as const };
    if (j.state === 'AWAITING_REPORT') return j.overdue ? { label: 'Отчёт просрочен', tone: 'coral' as const } : { label: 'Ждёт результата', tone: 'yellow' as const };
    return j.state === 'CANCELLED' ? { label: 'Не проведён', tone: 'neutral' as const } : { label: 'Проведён', tone: 'teal' as const };
  };

  return (
    <Panel title={e.studentName} onClose={onClose} header={<Avatar name={e.studentName} size="lg" />}>
      <div className="chips">
        <Badge tone="blue">{e.subjectName}</Badge>
        <Badge tone="neutral">с {fmtDay(e.assignedFrom)}</Badge>
        {e.nextLessonAt ? <Badge tone="teal">следующий урок {fmtDateTime(e.nextLessonAt)}</Badge> : <Badge tone="violet">пауза</Badge>}
      </div>

      <div className="tabbar" role="tablist" aria-label="Разделы карточки ученика">
        {TABS.map(([k, label]) => {
          const n = k === 'homework' ? hw.filter((h) => h.state === 'AWAITING_REVIEW').length : k === 'lessons' ? awaiting.length : k === 'reports' ? cps.filter((c) => c.state === 'PENDING').length : 0;
          return (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {label}
              {n > 0 && <span className="count-dot">{n}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <>
          <section className="card" aria-labelledby="h-stats" style={{ display: 'grid', gap: 12 }}>
            <div className="card-head" style={{ marginBottom: 0 }}>
              <h3 id="h-stats">{e.subjectName}: уроки</h3>
              <button type="button" className="link right" onClick={() => navigate(`/teacher/lessons?student=${e.studentId}&range=all`)}>
                Все уроки
              </button>
            </div>
            <div className="stat-trio">
              <div style={{ background: 'var(--blue-tint)' }}>
                <b>{planned.length}</b>
                <span>запланировано</span>
              </div>
              <div style={{ background: 'var(--teal-tint)' }}>
                <b>{e.confirmedLessons}</b>
                <span>проведено всего</span>
              </div>
              <div style={{ background: 'var(--surface-3)' }}>
                <b>{cancelled.length}</b>
                <span>отменено</span>
              </div>
            </div>
            <dl className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
              <dt>В этом месяце</dt>
              <dd className="num">{thisMonth.length} {plural(thisMonth.length, 'урок', 'урока', 'уроков')}</dd>
              <dt>Ждут результата</dt>
              <dd className="num">{awaiting.length ? <span className="neg">{awaiting.length}</span> : 0}</dd>
              <dt>До пересмотра навыков</dt>
              <dd className="num">{toReview} ур.</dd>
              <dt>До отчёта семье</dt>
              <dd className="num">{8 - (e.confirmedLessons % 8)} ур.</dd>
              <dt>Задания</dt>
              <dd className="num">{hw.filter((h) => h.state === 'AWAITING_REVIEW').length} на проверке · {hw.filter((h) => h.state === 'NOT_SUBMITTED').length} не сдано</dd>
              <dt>Цели</dt>
              <dd className="num">{goals.filter((g) => g.status === 'ACTIVE').length} активных</dd>
            </dl>
          </section>
          <section className="card" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <Ring value={4 - toReview} max={4} size={92} color="var(--violet)" label={`До пересмотра навыков ${toReview} урока`}>
              <div><b className="num" style={{ fontSize: 20 }}>{4 - toReview}/4</b><div className="muted" style={{ fontSize: 10 }}>к пересмотру</div></div>
            </Ring>
            <div style={{ flex: 1, minWidth: 200 }}>
              <b style={{ display: 'block', marginBottom: 8 }}>Навыки</b>
              <div className="stack-bar" style={{ height: 14 }} role="img" aria-label="Распределение навыков по этапам">
                {ORDER.slice().reverse().map((st) => {
                  const v = skills.filter((k) => k.status === st).length;
                  return v ? <div key={st} style={{ flex: v, background: SKILL[st].color, borderRadius: 6 }} title={`${SKILL[st].label}: ${v}`} /> : null;
                })}
              </div>
              <div className="legend">
                {ORDER.slice(1).map((st) => <span key={st}><i style={{ background: SKILL[st].color }} />{SKILL[st].label} <b className="num">{skills.filter((k) => k.status === st).length}</b></span>)}
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h3>Последние уроки</h3></div>
            <div className="list">
              {recent.length === 0 && <span className="muted">Прошедших уроков пока нет.</span>}
              {recent.map((l) => {
                const r = state.reports[l.lessonId];
                return (
                  <div key={l.lessonId} className="row-item">
                    <span className="time-pill num">{fmtDateTime(l.startsAt)}</span>
                    <span className="grow"><span className="sub" style={{ whiteSpace: 'normal' }}>{r?.note ?? 'Результат ещё не внесён'}</span></span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {tab === 'skills' && (
        <section className="card">
          <div className="card-head"><h3>Карта навыков</h3><span className="right muted" style={{ fontSize: 12 }}>нажмите, чтобы оценить</span></div>
          <div className="list">
            {skills.map((sk) => (
              <button key={sk.skillId} type="button" className="row-item" onClick={() => setEditing(sk)}>
                <span className="grow">
                  <span className="title">{sk.name}{sk.personal ? ' · индивидуальный' : ''}</span>
                  <span className="sub">{sk.category}{sk.assessedAt ? ` · ${fmtDay(sk.assessedAt)}` : ''}{sk.internalComment ? ' · есть внутренняя заметка' : ''}</span>
                </span>
                <Badge tone={SKILL[sk.status].tone}>{SKILL[sk.status].label}</Badge>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === 'goals' && (
        <section className="card">
          <div className="card-head"><h3>Цели</h3></div>
          <div style={{ display: 'grid', gap: 10 }}>
            {goals.length === 0 && <span className="muted">Целей пока нет.</span>}
            {goals.map((g) => (
              <div key={g.goalId} className="row-item">
                <span className="grow">
                  <span className="title" style={{ whiteSpace: 'normal' }}>{g.text}</span>
                  <span className="sub">{g.targetDate ? `к ${fmtDay(g.targetDate)} · ` : ''}обновлена {fmtDay(g.updatedAt)}</span>
                </span>
                {g.status === 'ACTIVE' ? (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => run({ type: 'goal.setStatus', goalId: g.goalId, status: 'ACHIEVED' })}>Достигнута</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => run({ type: 'goal.setStatus', goalId: g.goalId, status: 'PAUSED' })}>Пауза</button>
                  </>
                ) : (
                  <Badge tone={g.status === 'ACHIEVED' ? 'teal' : 'neutral'}>{g.status === 'ACHIEVED' ? 'Достигнута' : 'На паузе'}</Badge>
                )}
              </div>
            ))}
            <form style={{ display: 'flex', gap: 8 }} onSubmit={(ev) => { ev.preventDefault(); if (run({ type: 'goal.add', enrollmentId: e.enrollmentId, text: goalText, targetDate: null }).ok) setGoalText(''); }}>
              <label htmlFor="goal-new" className="sr-only">Новая цель</label>
              <input id="goal-new" className="chip" style={{ flex: 1, height: 42, borderRadius: 12 }} value={goalText} onChange={(ev) => setGoalText(ev.target.value)} placeholder="Новая цель, согласованная с учеником" />
              <button type="submit" className="btn btn-dark" aria-label="Добавить цель"><Plus size={16} /></button>
            </form>
          </div>
        </section>
      )}

      {tab === 'homework' && (
        <>
          <section className="card">
            <div className="card-head"><h3>Задания</h3></div>
            <div className="list">
              {hw.length === 0 && <span className="muted">Заданий пока не было.</span>}
              {hw.map((h) => (
                <button key={h.deliveryId} type="button" className="row-item" onClick={() => navigate(`/teacher/homework?id=${h.deliveryId}`)}>
                  <span className="grow">
                    <span className="title">{h.title}</span>
                    <span className="sub">выдано {fmtDay(h.issuedAt)}{h.dueAt ? ` · срок ${fmtDay(h.dueAt)}` : ''}{h.submissionCount ? ` · версий: ${h.submissionCount}` : ''}</span>
                  </span>
                  <Badge tone={HW_STATE[h.state].tone}>{HW_STATE[h.state].label}</Badge>
                </button>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h3>Выдать задание</h3></div>
            <form style={{ display: 'grid', gap: 10 }} onSubmit={(ev) => { ev.preventDefault(); if (run({ type: 'homework.issue', enrollmentId: e.enrollmentId, title: hwTitle, description: hwDesc, dueAt: hwDue ? new Date(`${hwDue}T21:00`).toISOString() : null }).ok) { setHwTitle(''); setHwDesc(''); setHwDue(''); } }}>
              <div className="field"><label htmlFor="hw-t">Название</label><input id="hw-t" required minLength={3} value={hwTitle} onChange={(ev) => setHwTitle(ev.target.value)} /></div>
              <div className="field"><label htmlFor="hw-d">Что сделать</label><textarea id="hw-d" rows={2} value={hwDesc} onChange={(ev) => setHwDesc(ev.target.value)} /></div>
              <div className="form-row">
                <div className="field"><label htmlFor="hw-due">Срок</label><input id="hw-due" type="date" value={hwDue} onChange={(ev) => setHwDue(ev.target.value)} /><span className="hint">Задание — по педагогической необходимости, не после каждого урока.</span></div>
                <button type="submit" className="btn btn-dark" style={{ alignSelf: 'center' }}>Выдать</button>
              </div>
            </form>
          </section>
        </>
      )}

      {tab === 'lessons' && (
        <section className="card" style={{ padding: 14 }}>
          <div className="card-head" style={{ padding: '4px 6px 0' }}>
            <h3>Все уроки · {lessons.length}</h3>
            <button type="button" className="link right" onClick={() => navigate(`/teacher/lessons?student=${e.studentId}&range=all`)}>Открыть в «Уроках»</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Дата</th><th>Статус</th><th>Результат</th></tr></thead>
              <tbody>
                {[...lessons].reverse().map((l) => {
                  const st = lessonState(l.lessonId, l.status);
                  return (
                    <tr key={l.lessonId} tabIndex={0} onClick={() => navigate(`/teacher/lessons?lesson=${l.lessonId}&student=${e.studentId}&range=all`)} onKeyDown={(ev) => ev.key === 'Enter' && navigate(`/teacher/lessons?lesson=${l.lessonId}&student=${e.studentId}&range=all`)}>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDay(l.startsAt)}, {fmtTime(l.startsAt)}</td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="muted" style={{ fontSize: 12 }}>{state.reports[l.lessonId]?.note ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'reports' && (
        <section className="card">
          <div className="card-head"><h3>Контрольные точки и отчёты</h3></div>
          <div className="list">
            {cps.length === 0 && <span className="muted">Отчёты появятся после 4 и 8 подтверждённых уроков. Следующая точка через {toReview} ур.</span>}
            {cps.map((c) => (
              <button key={c.checkpointId} type="button" className="row-item" onClick={() => navigate('/teacher/checkpoints')}>
                <span className="grow">
                  <span className="title">{c.type === 'LESSON_8' ? 'Отчёт семье (8 уроков)' : 'Пересмотр навыков (4 урока)'}</span>
                  <span className="sub">на {c.confirmedLessonCount} уроке · открыта {fmtDay(c.triggeredAt)}{c.completedAt ? ` · завершена ${fmtDay(c.completedAt)}` : ''}</span>
                </span>
                <Badge tone={c.state === 'PENDING' ? 'coral' : 'teal'}>{c.state === 'PENDING' ? 'Нужно заполнить' : 'Готово'}</Badge>
              </button>
            ))}
          </div>
        </section>
      )}

      {editing && <AssessDialog enrollmentId={e.enrollmentId} skill={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function AssessDialog({ enrollmentId, skill, onClose }: { enrollmentId: string; skill: TeacherSkill; onClose: () => void }) {
  const { run } = useTeacher();
  const [status, setStatus] = useState<SkillStatus>(skill.status);
  const [pub, setPub] = useState(skill.publicComment ?? '');
  const [internal, setInternal] = useState(skill.internalComment ?? '');
  const back = ORDER.indexOf(status) < ORDER.indexOf(skill.status);
  return (
    <Panel title={skill.name} variant="modal" onClose={onClose}>
      <form style={{ display: 'grid', gap: 14 }} onSubmit={(e) => { e.preventDefault(); if (run({ type: 'skill.assess', enrollmentId, skillId: skill.skillId, status, publicComment: pub, internalComment: internal }).ok) onClose(); }}>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Этап освоения</legend>
          <div className="seg">
            {ORDER.map((s) => (
              <label key={s}><input type="radio" name="st" checked={status === s} onChange={() => setStatus(s)} />{SKILL[s].label}</label>
            ))}
          </div>
        </fieldset>
        <Bar value={ORDER.indexOf(status)} max={3} color="var(--violet)" />
        <div className="field">
          <label htmlFor="pub">Комментарий для ученика{back ? ' — обязательно при возврате этапа' : ''}</label>
          <textarea id="pub" rows={2} required={back} minLength={back ? 3 : undefined} value={pub} onChange={(e) => setPub(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="int"><Lock size={12} /> Внутренняя педагогическая заметка</label>
          <textarea id="int" rows={2} value={internal} onChange={(e) => setInternal(e.target.value)} />
          <span className="hint">Видят только преподаватель и администрация (правило 9.25).</span>
        </div>
        <button type="submit" className="btn btn-dark">Сохранить оценку</button>
      </form>
    </Panel>
  );
}
