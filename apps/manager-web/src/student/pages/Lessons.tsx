import { Clock, Video } from 'lucide-react';
import { useMemo, useState } from 'react';
import { fmtDateTime, fmtDayLong, fmtTime, dayKey, relative } from '../../shared/format';
import { Badge, Empty, Notice, Panel } from '../../shared/ui';
import { SUBJECT_ICON } from '../../shared/subjects';
import { attendance, lessonStatus } from '../labels';
import { joinState, RESCHEDULE_MIN_HOURS, selectLessons } from '../logic';
import { useStudent } from '../store';
import type { LessonCard, LessonHistoryItem } from '../types';

export function StudentLessons() {
  const { state } = useStudent();
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const [subject, setSubject] = useState('ALL');
  const [reschedule, setReschedule] = useState<LessonCard | null>(null);
  const [dispute, setDispute] = useState<LessonHistoryItem | null>(null);
  const lessons = useMemo(() => selectLessons(state), [state]);
  const frozen = state.subjects.filter((s) => s.displayStatus === 'FROZEN');

  const upcoming = lessons.filter((l) => (subject === 'ALL' || l.subjectName === subject) && new Date(l.scheduledAt).getTime() + l.durationMinutes * 60_000 > new Date(state.now).getTime());
  const byDay = upcoming.reduce<Record<string, LessonCard[]>>((acc, l) => {
    (acc[dayKey(l.scheduledAt)] ??= []).push(l);
    return acc;
  }, {});
  const history = state.history.filter((h) => subject === 'ALL' || h.subjectName === subject).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Уроки</h1>
          <p>Ссылка на видеоурок открывается за 10 минут до начала. Перенос можно запросить не позднее чем за {RESCHEDULE_MIN_HOURS} часа — менеджер согласует новое время.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="tabs" role="tablist" aria-label="Раздел">
          <button type="button" role="tab" className="chip" aria-selected={tab === 'upcoming'} aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>
            Предстоящие <span className="n">{upcoming.length}</span>
          </button>
          <button type="button" role="tab" className="chip" aria-selected={tab === 'history'} aria-pressed={tab === 'history'} onClick={() => setTab('history')}>
            История <span className="n">{history.length}</span>
          </button>
        </div>
        <label className="sr-only" htmlFor="ls-subject">Предмет</label>
        <select id="ls-subject" className="chip" style={{ marginLeft: 'auto' }} value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="ALL">Все предметы</option>
          {state.subjects.map((s) => <option key={s.subjectId}>{s.subjectName}</option>)}
        </select>
      </div>

      {frozen.length > 0 && tab === 'upcoming' && (
        <Notice tone="blue">
          {frozen.map((f) => f.subjectName).join(', ')}: абонемент заморожен — уроков нет, но материалы и задания доступны для самостоятельной работы.
        </Notice>
      )}

      {tab === 'upcoming' ? (
        upcoming.length === 0 ? (
          <section className="card"><Empty title="Предстоящих уроков нет" /></section>
        ) : (
          Object.entries(byDay).map(([day, items]) => (
            <section key={day} aria-label={fmtDayLong(items[0]!.scheduledAt)}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: '4px 0 10px', textTransform: 'capitalize' }}>{fmtDayLong(items[0]!.scheduledAt)}</h2>
              <div className="list" style={{ gap: 10 }}>
                {items.map((l) => {
                  const j = joinState(l, state.now);
                  const requested = state.rescheduleRequests.find((r) => r.lessonId === l.lessonId);
                  return (
                    <div key={l.lessonId} className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                      <img src={SUBJECT_ICON[l.subjectName]} alt="" className="subject-art md" />
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <b style={{ display: 'block' }}>{l.subjectName}</b>
                        <span className="muted" style={{ fontSize: 13 }}>
                          {fmtTime(l.scheduledAt)}–{fmtTime(new Date(new Date(l.scheduledAt).getTime() + l.durationMinutes * 60_000).toISOString())} · {l.teacherName}
                        </span>
                        {l.originalScheduledAt && <div style={{ fontSize: 12, color: 'var(--violet-ink)' }}>Перенесён с {fmtDateTime(l.originalScheduledAt)}</div>}
                      </div>
                      {requested && <Badge tone="violet">Запрошен перенос</Badge>}
                      {j.live && <Badge tone="coral">Идёт сейчас</Badge>}
                      {l.canJoin ? (
                        <a className="btn btn-dark btn-sm" href={l.meetLink ?? '#'} target="_blank" rel="noreferrer"><Video size={14} /> Подключиться</a>
                      ) : (
                        <span className="time-pill" title="Ссылка откроется за 10 минут до начала"><Clock size={12} /> {relative(l.scheduledAt, state.now)}</span>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!l.canRequestReschedule}
                        title={l.canRequestReschedule ? undefined : requested ? 'Запрос уже отправлен' : `Меньше ${RESCHEDULE_MIN_HOURS} часов до урока — напишите менеджеру`}
                        onClick={() => setReschedule(l)}
                      >
                        Перенести
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )
      ) : (
        <section className="card" style={{ padding: 14 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Урок</th>
                  <th>Статус</th>
                  <th>Списание</th>
                  <th>Остаток</th>
                  <th><span className="sr-only">Действие</span></th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.lessonId} style={{ cursor: 'default' }}>
                    <td>
                      <div className="cell-person">
                        <img src={SUBJECT_ICON[h.subjectName]} alt="" className="subject-art sm" />
                        <div>
                          <b>{h.subjectName}</b>
                          <span>{fmtDateTime(h.scheduledAt)} · {h.teacherName}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge tone={state.disputes.includes(h.lessonId) ? 'violet' : attendance[h.attendanceStatus].tone}>
                        {state.disputes.includes(h.lessonId) ? lessonStatus.DISPUTED.label : attendance[h.attendanceStatus].label}
                      </Badge>
                    </td>
                    <td>{h.lessonDeducted ? '1 занятие' : <span className="muted">не списано</span>}</td>
                    <td className="num">{h.balanceBefore !== null ? `${h.balanceBefore} → ${h.balanceAfter}` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {h.canDispute && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDispute(h)}>
                          Оспорить
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {reschedule && <RescheduleForm lesson={reschedule} onClose={() => setReschedule(null)} />}
      {dispute && <DisputeForm item={dispute} onClose={() => setDispute(null)} />}
    </div>
  );
}

function RescheduleForm({ lesson, onClose }: { lesson: LessonCard; onClose: () => void }) {
  const { run } = useStudent();
  const [date, setDate] = useState(lesson.scheduledAt.slice(0, 10));
  const [comment, setComment] = useState('');
  return (
    <Panel title="Запрос на перенос" variant="modal" onClose={onClose}>
      <p className="muted">
        {lesson.subjectName}, {fmtDateTime(lesson.scheduledAt)}. Урок остаётся в расписании, пока менеджер не подтвердит новое время с преподавателем.
      </p>
      <form
        style={{ display: 'grid', gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (run({ type: 'lesson.requestReschedule', lessonId: lesson.lessonId, preferredDate: date, comment }).ok) onClose();
        }}
      >
        <div className="field">
          <label htmlFor="rs-date">Удобная дата</label>
          <input id="rs-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rs-comment">Причина и удобное время</label>
          <textarea id="rs-comment" rows={3} required minLength={10} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: олимпиада в четверг, удобно в пятницу после 16:00" />
        </div>
        <button type="submit" className="btn btn-dark">Отправить менеджеру</button>
      </form>
    </Panel>
  );
}

function DisputeForm({ item, onClose }: { item: LessonHistoryItem; onClose: () => void }) {
  const { run } = useStudent();
  const [comment, setComment] = useState('');
  return (
    <Panel title="Оспорить списание" variant="modal" onClose={onClose}>
      <Notice tone="violet">
        Менеджер соберёт сведения у преподавателя, решение по возврату занятия принимает руководитель. Спор можно открыть в течение 30 дней.
      </Notice>
      <p className="muted">
        {item.subjectName}, {fmtDateTime(item.scheduledAt)} — {attendance[item.attendanceStatus].label.toLowerCase()}, списано 1 занятие.
      </p>
      <form
        style={{ display: 'grid', gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (run({ type: 'lesson.dispute', lessonId: item.lessonId, comment }).ok) onClose();
        }}
      >
        <div className="field">
          <label htmlFor="dp-comment">Что произошло</label>
          <textarea id="dp-comment" rows={4} required minLength={10} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Опишите ситуацию: например, урок не начался вовремя" />
        </div>
        <button type="submit" className="btn btn-dark">Отправить обращение</button>
      </form>
    </Panel>
  );
}
