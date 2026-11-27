import { Download, FileDown, Snowflake } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ring } from '../../shared/charts';
import { fmtDateTime, fmtDay, relative } from '../../shared/format';
import { SUBJECT_ICON, SUBJECT_TONE } from '../../shared/subjects';
import { Badge, Empty, Notice } from '../../shared/ui';
import { notificationTone } from '../labels';
import { useStudent } from '../store';

export function StudentReports() {
  const { state, run } = useStudent();
  const [openId, setOpenId] = useState<string | null>(state.reports[0]?.reportId ?? null);

  useEffect(() => {
    if (state.pdfExport !== 'PREPARING') return;
    const t = window.setTimeout(() => run({ type: 'reports.exportReady' }), 1800);
    return () => window.clearTimeout(t);
  }, [state.pdfExport, run]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Отчёты</h1>
          <p>Каждые 8 проведённых уроков преподаватель готовит отчёт: достижения, что подтянуть и рекомендации. История сохраняется и переходит к новому преподавателю.</p>
        </div>
        <div className="actions">
          {state.pdfExport === 'READY' ? (
            <a className="btn btn-dark" href="#" onClick={(e) => e.preventDefault()}>
              <Download size={16} /> Скачать PDF
            </a>
          ) : (
            <button type="button" className="btn btn-accent" disabled={state.pdfExport === 'PREPARING'} onClick={() => run({ type: 'reports.exportPdf' })}>
              <FileDown size={16} /> {state.pdfExport === 'PREPARING' ? 'Готовим PDF…' : 'Образовательная история в PDF'}
            </button>
          )}
        </div>
      </div>

      {state.reports.length === 0 ? (
        <section className="card"><Empty title="Отчётов пока нет" text="Первый появится после 8 проведённых уроков." /></section>
      ) : (
        <div className="list" style={{ gap: 12 }}>
          {state.reports.map((r) => {
            const open = openId === r.reportId;
            return (
              <section key={r.reportId} className="card">
                <button
                  type="button"
                  className="row-item"
                  style={{ background: 'none', padding: 0 }}
                  aria-expanded={open}
                  onClick={() => {
                    setOpenId(open ? null : r.reportId);
                    if (r.isNew) run({ type: 'report.read', reportId: r.reportId });
                  }}
                >
                  <img src={SUBJECT_ICON[r.subjectName]} alt="" className="subject-art md" />
                  <span className="grow">
                    <span className="title" style={{ fontSize: 16 }}>{r.subjectName} · {r.lessonCount} уроков</span>
                    <span className="sub">{fmtDay(r.periodFrom)} — {fmtDay(r.periodTo)} · {r.teacherName}</span>
                  </span>
                  {r.isNew && <Badge tone="coral">Новый</Badge>}
                </button>
                {open && (
                  <div className="grid-3" style={{ marginTop: 16 }}>
                    <div className="tile tile-teal" style={{ minHeight: 0 }}>
                      <h3 style={{ fontSize: 15 }}>Достижения</h3>
                      <p style={{ marginTop: 8, fontSize: 14 }}>{r.content.achievements}</p>
                    </div>
                    <div className="tile tile-yellow" style={{ minHeight: 0 }}>
                      <h3 style={{ fontSize: 15 }}>Что подтянуть</h3>
                      <p style={{ marginTop: 8, fontSize: 14 }}>{r.content.growthAreas}</p>
                    </div>
                    <div className="tile tile-blue" style={{ minHeight: 0 }}>
                      <h3 style={{ fontSize: 15 }}>Рекомендации</h3>
                      <p style={{ marginTop: 8, fontSize: 14 }}>{r.content.recommendations}</p>
                    </div>
                    <p className="muted" style={{ gridColumn: '1 / -1', fontSize: 13 }}>Заверено: {r.content.teacherSignature}, {fmtDateTime(r.createdAt)}</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

const FILE_KIND = (mime: string) => (mime.includes('pdf') ? ['PDF', 'coral'] : mime.includes('sheet') ? ['XLS', 'teal'] : mime.includes('word') ? ['DOC', 'blue'] : ['FILE', 'neutral']) as [string, string];

export function StudentMaterials() {
  const { state } = useStudent();
  const [params] = useSearchParams();
  const [subject, setSubject] = useState('ALL');
  const q = (params.get('q') ?? '').toLowerCase();
  const rows = state.materials.filter((m) => (subject === 'ALL' || m.subjectName === subject) && (!q || m.fileName.toLowerCase().includes(q)));
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Материалы</h1>
          <p>Файлы, которые преподаватели открыли для вас. Доступны и во время заморозки абонемента.</p>
        </div>
      </div>
      <div className="chips" role="group" aria-label="Предмет">
        {['ALL', ...state.subjects.map((s) => s.subjectName)].map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={subject === s} onClick={() => setSubject(s)}>
            {s === 'ALL' ? 'Все' : s}
          </button>
        ))}
      </div>
      {q && <Notice tone="blue">Поиск: «{params.get('q')}» — найдено {rows.length}</Notice>}
      <section className="card">
        {rows.length === 0 ? (
          <Empty title="Ничего не найдено" />
        ) : (
          <div className="list">
            {rows.map((m) => {
              const [kind, tone] = FILE_KIND(m.mimeType);
              return (
                <div key={m.fileId} className="file-row">
                  <span className={`file-ico tone-${tone}`}>{kind}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fileName}</b>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {m.subjectName}{m.lessonTitle ? ` · тема «${m.lessonTitle}»` : ''} · {m.sharedByTeacherName} · {fmtDay(m.sharedAt)}
                    </span>
                  </span>
                  <span className="muted num" style={{ fontSize: 12 }}>{(m.fileSizeBytes / 1_048_576).toFixed(1)} МБ</span>
                  <button type="button" className="icon-btn" aria-label={`Скачать ${m.fileName}`} disabled={m.canDownload === false}>
                    <Download size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const LEDGER_LABEL = { DEDUCTION: ['Списание', 'coral'], CREDIT: ['Начисление', 'teal'], FREEZE: ['Заморозка', 'violet'], UNFREEZE: ['Разморозка', 'blue'] } as const;

export function StudentSubscription() {
  const { state } = useStudent();
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Абонементы</h1>
          <p>Права на занятия раздельны по предметам. Продление и оплату оформляет менеджер; после подтверждения поступления занятия появятся здесь.</p>
        </div>
      </div>
      <div className="grid-3">
        {state.subscriptions.map((s) => (
          <section key={s.subscriptionId} className="card" style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <img src={SUBJECT_ICON[s.subjectName]} alt="" className="subject-art md" />
              <div style={{ flex: 1 }}>
                <b style={{ display: 'block' }}>{s.subjectName}</b>
                <span className="muted" style={{ fontSize: 12 }}>{s.planName}</span>
              </div>
              <Badge tone={s.isFrozen ? 'violet' : (s.lessonsRemaining ?? 0) <= 2 ? 'coral' : 'teal'}>{s.isFrozen ? 'Заморожен' : (s.lessonsRemaining ?? 0) <= 2 ? 'Заканчивается' : 'Активен'}</Badge>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Ring value={s.lessonsRemaining ?? 0} max={s.lessonsTotal ?? 1} size={100} color={`var(--${SUBJECT_TONE[s.subjectName] ?? 'teal'})`} label={`Осталось ${s.lessonsRemaining} из ${s.lessonsTotal}`}>
                <div><b className="num" style={{ fontSize: 24 }}>{s.lessonsRemaining}</b><div className="muted" style={{ fontSize: 11 }}>из {s.lessonsTotal}</div></div>
              </Ring>
              <dl className="kv" style={{ gridTemplateColumns: '1fr', gap: 2 }}>
                <dt>Действует</dt>
                <dd>{s.validFrom ? fmtDay(s.validFrom) : '—'} — {s.validUntil ? fmtDay(s.validUntil) : '—'}</dd>
                <dt>Преподаватель</dt>
                <dd>{s.teacherName}</dd>
              </dl>
            </div>
            {s.isFrozen && (
              <Notice tone="violet" icon={<Snowflake size={16} />}>
                Заморожен до {fmtDay(s.frozenUntil!)}. Занятия не списываются, материалы и задания доступны.
              </Notice>
            )}
          </section>
        ))}
      </div>
      <section className="card" style={{ padding: 14 }}>
        <div className="card-head" style={{ padding: '6px 8px 0' }}><h3>Движения по занятиям</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Дата</th><th>Предмет</th><th>Операция</th><th>Остаток</th></tr></thead>
            <tbody>
              {state.ledger.map((e) => (
                <tr key={e.entryId} style={{ cursor: 'default' }}>
                  <td className="num">{fmtDateTime(e.entryDate)}</td>
                  <td>{e.subjectName}</td>
                  <td><Badge tone={LEDGER_LABEL[e.type][1]}>{LEDGER_LABEL[e.type][0]}</Badge> <span className="muted" style={{ fontSize: 12 }}>{e.description}</span></td>
                  <td className="num">{e.balanceBefore} → {e.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function StudentNotifications() {
  const { state, run } = useStudent();
  const unread = state.notifications.filter((n) => !n.isRead).length;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Уведомления</h1>
          <p>Учебные уведомления приходят только сюда, без SMS и мессенджеров. Организационные вопросы менеджер решает лично.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost" disabled={!unread} onClick={() => run({ type: 'notification.readAll' })}>
            Прочитать все
          </button>
        </div>
      </div>
      <section className="card">
        <div className="list">
          {state.notifications.map((n) => (
            <button
              key={n.notificationId}
              type="button"
              className="row-item"
              style={{ background: n.isRead ? 'var(--surface-2)' : 'var(--accent-tint)' }}
              onClick={() => !n.isRead && run({ type: 'notification.read', notificationId: n.notificationId })}
              aria-label={`${n.title}${n.isRead ? '' : ', не прочитано'}`}
            >
              <Badge tone={notificationTone(n.type)}>{n.isRead ? 'Прочитано' : 'Новое'}</Badge>
              <span className="grow">
                <span className="title">{n.title}</span>
                <span className="sub" style={{ whiteSpace: 'normal' }}>{n.body}</span>
              </span>
              <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{relative(n.createdAt, state.now)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
