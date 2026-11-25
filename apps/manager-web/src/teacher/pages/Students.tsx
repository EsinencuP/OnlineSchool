import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ring } from '../../shared/charts';
import { fmtDateTime, fmtDay } from '../../shared/format';
import { Avatar, Badge, Bar, Empty, Panel } from '../../shared/ui';
import { lessonsToNextReview } from '../logic';
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

function StudentPanel({ e, onClose }: { e: Enrollment; onClose: () => void }) {
  const { state, run } = useTeacher();
  const skills = state.skills[e.enrollmentId] ?? [];
  const goals = state.goals.filter((g) => g.enrollmentId === e.enrollmentId);
  const hw = state.homework.filter((h) => h.studentId === e.studentId);
  const [editing, setEditing] = useState<TeacherSkill | null>(null);
  const [goalText, setGoalText] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDesc, setHwDesc] = useState('');
  const [hwDue, setHwDue] = useState('');
  const recent = state.lessons.filter((l) => l.studentId === e.studentId && l.endsAt <= state.now).slice(-4).reverse();
  const toReview = lessonsToNextReview(e.confirmedLessons);

  return (
    <Panel title={e.studentName} onClose={onClose} header={<Avatar name={e.studentName} size="lg" />}>
      <section className="card" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <Ring value={4 - toReview} max={4} size={92} color="var(--violet)" label={`До пересмотра навыков ${toReview} урока`}>
          <div><b className="num" style={{ fontSize: 20 }}>{4 - toReview}/4</b><div className="muted" style={{ fontSize: 10 }}>к пересмотру</div></div>
        </Ring>
        <dl className="kv" style={{ flex: 1, gridTemplateColumns: '1fr auto' }}>
          <dt>Подтверждено уроков</dt><dd className="num">{e.confirmedLessons}</dd>
          <dt>Отчёт через</dt><dd className="num">{8 - (e.confirmedLessons % 8)} ур.</dd>
          <dt>Задания</dt><dd className="num">{hw.filter((h) => h.state === 'AWAITING_REVIEW').length} на проверке · {hw.filter((h) => h.state === 'NOT_SUBMITTED').length} не сдано</dd>
          <dt>Цели</dt><dd className="num">{goals.filter((g) => g.status === 'ACTIVE').length} активных</dd>
        </dl>
      </section>

      <section className="card">
        <div className="card-head"><h3>Карта навыков</h3><span className="right muted" style={{ fontSize: 12 }}>нажмите, чтобы оценить</span></div>
        <div className="list">
          {skills.map((s) => (
            <button key={s.skillId} type="button" className="row-item" onClick={() => setEditing(s)}>
              <span className="grow">
                <span className="title">{s.name}{s.personal ? ' · индивидуальный' : ''}</span>
                <span className="sub">{s.category}{s.assessedAt ? ` · ${fmtDay(s.assessedAt)}` : ''}{s.internalComment ? ' · есть внутренняя заметка' : ''}</span>
              </span>
              <Badge tone={SKILL[s.status].tone}>{SKILL[s.status].label}</Badge>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h3>Цели</h3></div>
        <div style={{ display: 'grid', gap: 10 }}>
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

      <section className="card">
        <div className="card-head"><h3>Последние уроки</h3></div>
        <div className="list">
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
