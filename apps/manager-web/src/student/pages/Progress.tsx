import { CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { fmtDay } from '../../shared/format';
import { SUBJECT_ICON } from '../../shared/subjects';
import { Badge, Bar } from '../../shared/ui';
import { SKILL_STAGES, skillStatus } from '../labels';
import { useStudent } from '../store';

export function StudentProgress() {
  const { state } = useStudent();
  const subjects = [...new Set(state.skills.map((s) => s.subjectName))];
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const skills = state.skills.filter((s) => s.subjectName === subject);
  const categories = [...new Set(skills.map((s) => s.category))];
  const goals = state.goals.filter((g) => g.subjectName === subject);
  const applied = skills.filter((s) => s.status === 'APPLYING').length;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Навыки и цели</h1>
          <p>Путь каждого навыка: «Знакомлюсь» → «Практикую» → «Применяю». Статус меняет преподаватель по понятным критериям — автоматического повышения нет.</p>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Предмет">
        {subjects.map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={subject === s} onClick={() => setSubject(s)}>
            <img src={SUBJECT_ICON[s]} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
            {s}
          </button>
        ))}
      </div>

      <div className="split">
        <section className="card" aria-labelledby="h-map">
          <div className="card-head">
            <h3 id="h-map">Карта навыков: {subject}</h3>
            <span className="right muted num" style={{ fontSize: 13 }}>{applied} из {skills.length} применяю</span>
          </div>
          <div style={{ display: 'grid', gap: 18 }}>
            {categories.map((c) => (
              <div key={c} style={{ display: 'grid', gap: 8 }}>
                <span className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>{c}</span>
                {skills.filter((s) => s.category === c).map((s) => {
                  const idx = SKILL_STAGES.indexOf(s.status);
                  return (
                    <div key={s.skillId} className="skill-row">
                      <div>
                        <b>{s.name}</b>
                        <span className="sub">обновлено {fmtDay(s.lastUpdatedAt)} · {s.lastUpdatedByTeacherName}</span>
                      </div>
                      <div className="stepper" role="img" aria-label={`${s.name}: ${skillStatus[s.status].label}`}>
                        {SKILL_STAGES.map((st, i) => (
                          <span key={st} className={i < idx ? 'done' : i === idx ? 'current' : ''}>{skillStatus[st].label}</span>
                        ))}
                      </div>
                      {s.status === 'NOT_STUDIED' ? <Badge tone="neutral">Ещё не изучали</Badge> : <span />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <aside className="stack">
          <section className="card" aria-labelledby="h-goals">
            <div className="card-head"><h3 id="h-goals">Цели</h3></div>
            {goals.length === 0 ? (
              <p className="muted">Цели по предмету ещё не согласованы.</p>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {goals.map((g) => (
                  <div key={g.goalId} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      {g.status === 'ACHIEVED' && <CircleCheck size={18} color="var(--teal)" aria-label="Достигнута" />}
                      <b style={{ fontWeight: 600 }}>{g.text}</b>
                    </div>
                    <Bar value={g.progress} max={100} color={g.status === 'ACHIEVED' ? 'var(--teal)' : 'var(--violet)'} />
                    <span className="muted" style={{ fontSize: 12 }}>
                      {g.status === 'ACHIEVED' ? `Достигнута ${fmtDay(g.updatedAt)} — поздравляем!` : `${g.progress}%${g.targetDate ? ` · к ${fmtDay(g.targetDate)}` : ''}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="card">
            <div className="card-head"><h3>Как читать карту</h3></div>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              {(['FAMILIARIZING', 'PRACTICING', 'APPLYING'] as const).map((s) => (
                <div key={s} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge tone={skillStatus[s].tone}>{skillStatus[s].label}</Badge>
                  <span className="muted">
                    {s === 'FAMILIARIZING' ? 'разобрали тему на уроке' : s === 'PRACTICING' ? 'решаю с подсказками' : 'решаю самостоятельно'}
                  </span>
                </div>
              ))}
              <p className="muted">Пересмотр навыков — каждые 4 урока, отчёт — каждые 8.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
