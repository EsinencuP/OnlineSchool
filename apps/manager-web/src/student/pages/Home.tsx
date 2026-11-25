import { ArrowUpRight, Clock, Snowflake, Video } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ring } from '../../shared/charts';
import { dayKey, fmtDateTime, fmtDay, fmtTime, plural, relative } from '../../shared/format';
import { MiniCalendar } from '../../shared/MiniCalendar';
import { Badge, Bar, Empty } from '../../shared/ui';
import { homeworkStatus, skillStatus, SKILL_STAGES, SUBJECT_ICON } from '../labels';
import { joinState, selectDashboard, selectLessons } from '../logic';
import { useStudent } from '../store';

function greeting(iso: string) {
  const h = new Date(iso).getHours();
  return h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
}

export function StudentHome() {
  const { state } = useStudent();
  const navigate = useNavigate();
  const d = useMemo(() => selectDashboard(state), [state]);
  const lessons = useMemo(() => selectLessons(state), [state]);
  const first = state.me.displayName.split(' ')[0];
  const next = d.nextLesson;
  const join = next ? joinState({ ...next, status: next.status ?? 'SCHEDULED' }, state.now) : null;
  const todo = state.homework
    .filter((h) => h.status === 'NOT_SUBMITTED' || h.status === 'NEEDS_REVISION')
    .sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9'));
  const newReport = state.reports.find((r) => r.isNew);
  const skillsTotal = state.skills.length;
  const upcoming = lessons.filter((l) => l.scheduledAt > state.now).slice(0, 4);
  const busy = new Set(state.lessons.map((l) => dayKey(l.scheduledAt)));

  return (
    <div className="split">
      <div className="stack">
        <section className="hero" aria-labelledby="hello">
          <div>
            <h1 id="hello">
              {greeting(state.now)}, {first}!
            </h1>
            {next ? (
              <p>
                Следующий урок — <b>{next.subjectName}</b> с {next.teacherName}, {fmtDateTime(next.scheduledAt)} ({relative(next.scheduledAt, state.now)}).
                {todo.length > 0 && ` До него стоит сдать ${todo.length} ${plural(todo.length, 'задание', 'задания', 'заданий')}.`}
              </p>
            ) : (
              <p>Ближайших уроков пока нет — менеджер сообщит, когда расписание обновится.</p>
            )}
            <div className="actions">
              {next && join?.canJoin ? (
                <a className="btn btn-dark" href={next.meetLink ?? '#'} target="_blank" rel="noreferrer">
                  <Video size={16} /> {join.live ? 'Урок идёт — подключиться' : 'Подключиться к уроку'}
                </a>
              ) : next ? (
                <span className="btn btn-ghost" aria-disabled="true" title="Ссылка откроется за 10 минут до начала">
                  <Clock size={16} /> Ссылка откроется в {fmtTime(join!.opensAt)}
                </span>
              ) : null}
              <button type="button" className="btn btn-accent" onClick={() => navigate('/student/homework')}>
                Мои задания
              </button>
            </div>
          </div>
          <img className="mascot" src="/mascot.svg" alt="" />
        </section>

        {newReport && (
          <button type="button" className="row-item" style={{ background: 'var(--violet-tint)', padding: '14px 18px' }} onClick={() => navigate('/student/reports')}>
            <span className="grow">
              <span className="title">Новый отчёт: {newReport.subjectName}</span>
              <span className="sub">{newReport.teacherName} подвела итоги последних 8 занятий</span>
            </span>
            <ArrowUpRight size={18} />
          </button>
        )}

        <div className="grid-3">
          {state.subscriptions.map((s) => (
            <section key={s.subscriptionId} className={`tile ${s.isFrozen ? 'tile-blue' : s.subjectName === 'Математика' ? 'tile-yellow' : 'tile-coral'}`} style={{ minHeight: 170 }}>
              <img src={SUBJECT_ICON[s.subjectName]} alt="" className="shape" style={{ opacity: 0.9, width: 110, height: 'auto', right: -8, top: 8 }} />
              <h3 style={{ fontSize: 16 }}>{s.subjectName}</h3>
              <span className="muted" style={{ fontSize: 12 }}>{s.teacherName}</span>
              <div style={{ marginTop: 'auto' }}>
                <div className="big-num num" style={{ fontSize: 36 }}>
                  {s.lessonsRemaining}
                  <span style={{ fontSize: 16, fontWeight: 500 }}> / {s.lessonsTotal}</span>
                </div>
                <span style={{ fontSize: 12 }}>
                  {s.isFrozen ? (
                    <>
                      <Snowflake size={12} /> заморожен до {fmtDay(s.frozenUntil!)}
                    </>
                  ) : (
                    `занятий осталось · до ${fmtDay(s.validUntil!)}`
                  )}
                </span>
              </div>
            </section>
          ))}
        </div>

        <div className="two-col">
          <section className="card" aria-labelledby="h-todo">
            <div className="card-head">
              <h3 id="h-todo">Задания к сдаче</h3>
              <button type="button" className="link right" onClick={() => navigate('/student/homework')}>Все</button>
            </div>
            {todo.length === 0 ? (
              <Empty title="Всё сдано" text="Новых заданий нет." />
            ) : (
              <div className="list">
                {todo.slice(0, 4).map((h) => (
                  <button key={h.homeworkId} type="button" className="row-item" onClick={() => navigate(`/student/homework?id=${h.homeworkId}`)}>
                    <img src={SUBJECT_ICON[h.subjectName]} alt="" width={36} height={36} style={{ objectFit: 'contain' }} />
                    <span className="grow">
                      <span className="title">{h.title}</span>
                      <span className="sub">{h.subjectName}{h.dueAt ? ` · до ${fmtDay(h.dueAt)}` : ''}</span>
                    </span>
                    <Badge tone={h.isLate ? 'coral' : homeworkStatus[h.status].tone}>{h.isLate ? 'Просрочено' : homeworkStatus[h.status].label}</Badge>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="h-skills">
            <div className="card-head">
              <h3 id="h-skills">Карта навыков</h3>
              <button type="button" className="link right" onClick={() => navigate('/student/progress')}>Открыть</button>
            </div>
            <div className="stack-bar" role="img" aria-label={`Навыки: ${SKILL_STAGES.map((s) => `${skillStatus[s].label} ${d.skillProgress[key(s)]}`).join(', ')}`}>
              {(['APPLYING', 'PRACTICING', 'FAMILIARIZING', 'NOT_STUDIED'] as const).map((s) => {
                const v = d.skillProgress[key(s)];
                return v ? <div key={s} style={{ flex: v, background: skillStatus[s].color }} /> : null;
              })}
            </div>
            <div className="legend">
              {(['APPLYING', 'PRACTICING', 'FAMILIARIZING', 'NOT_STUDIED'] as const).map((s) => (
                <span key={s}>
                  <i style={{ background: skillStatus[s].color }} />
                  {skillStatus[s].label} · <b className="num">{d.skillProgress[key(s)]}</b>
                </span>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
              {d.skillProgress.applying} из {skillsTotal} навыков вы уже применяете самостоятельно. Статус меняет преподаватель после проверки.
            </p>
          </section>
        </div>

        <section className="card" aria-labelledby="h-goals">
          <div className="card-head">
            <h3 id="h-goals">Мои цели</h3>
            <span className="right muted" style={{ fontSize: 12 }}>согласованы с преподавателем</span>
          </div>
          <div className="list">
            {state.goals.filter((g) => g.status === 'ACTIVE').map((g) => (
              <div key={g.goalId} className="row-item" style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: 14 }}>
                <span>
                  <span className="title" style={{ whiteSpace: 'normal' }}>{g.text}</span>
                  <span className="sub">{g.subjectName}{g.targetDate ? ` · к ${fmtDay(g.targetDate)}` : ''}</span>
                </span>
                <Bar value={g.progress} max={100} color="var(--violet)" />
                <b className="num">{g.progress}%</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="side-col" aria-label="Расписание">
        <MiniCalendar now={state.now} busy={busy} />
        <section className="card" aria-labelledby="h-up">
          <div className="card-head">
            <h3 id="h-up">Ближайшие уроки</h3>
          </div>
          {upcoming.length === 0 ? (
            <Empty title="Уроков нет" />
          ) : (
            <div className="timeline">
              {upcoming.map((l) => (
                <div key={l.lessonId} className="tl-item">
                  <span className="tl-time num">{fmtTime(l.scheduledAt)}</span>
                  <div className={`tl-card${l.canJoin ? ' trial' : ''}`}>
                    <b>{l.subjectName}</b>
                    <span>
                      {fmtDay(l.scheduledAt)} · {l.teacherName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-dark" style={{ width: '100%', marginTop: 14 }} onClick={() => navigate('/student/lessons')}>
            Всё расписание
          </button>
        </section>
        <section className="card">
          <div className="card-head"><h3>Посещаемость</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {(() => {
              const done = state.history.filter((h) => h.attendanceStatus === 'COMPLETED').length;
              const total = state.history.filter((h) => h.attendanceStatus !== 'CANCELLED').length;
              return (
                <>
                  <Ring value={done} max={total} size={92} color="var(--teal)" label={`Посещено ${done} из ${total}`}>
                    <b className="num" style={{ fontSize: 20 }}>{Math.round((done / Math.max(1, total)) * 100)}%</b>
                  </Ring>
                  <p className="muted" style={{ fontSize: 13 }}>
                    {done} из {total} уроков за последние недели. Пропуск без предупреждения списывается.
                  </p>
                </>
              );
            })()}
          </div>
        </section>
      </aside>
    </div>
  );
}

const key = (s: 'APPLYING' | 'PRACTICING' | 'FAMILIARIZING' | 'NOT_STUDIED') =>
  ({ APPLYING: 'applying', PRACTICING: 'practicing', FAMILIARIZING: 'familiarizing', NOT_STUDIED: 'notStudied' }) [s] as 'applying' | 'practicing' | 'familiarizing' | 'notStudied';
