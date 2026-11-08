import { useState } from 'react';
import {
  getStudentMaterialUrl,
  getStudentMaterials,
  getStudentSkillAudit,
  getStudentSkillMaps,
  getStudentSkillSnapshots,
  getStudentSubscription,
  getStudentSubscriptionLedger,
  getStudentSubscriptionPayments,
  getStudentNotifications,
  markAllStudentNotificationsRead,
  markStudentNotificationRead,
} from '@online-school/api-contracts';
import { read, useCommand, useStudentQuery, write } from '../api.js';
import {
  date,
  Empty,
  ErrorNotice,
  Pager,
  Panel,
  QueryState,
  safeUrl,
  Status,
} from '../components.js';
function SkillHistory({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const query = useStudentQuery(['skill-history', id, page], (o) =>
    getStudentSkillAudit({ skillId: id, page }, o),
  );
  return (
    <QueryState query={query}>
      {query.data?.items.length ? (
        <ol className="versions">
          {query.data.items.map((e) => (
            <li key={e.auditId}>
              <strong>
                {date(e.changedAt, true)} · {e.teacherName}
              </strong>
              <p>
                <Status value={e.fromStatus} /> → <Status value={e.toStatus} />
              </p>
              <p>{e.comment}</p>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>Изменений пока нет.</Empty>
      )}
      {query.data && <Pager {...query.data} change={setPage} />}
    </QueryState>
  );
}
export function SkillMap() {
  const [subject, setSubject] = useState(''),
    [skill, setSkill] = useState(''),
    [page, setPage] = useState(1);
  const maps = useStudentQuery(['skills'], (o) => getStudentSkillMaps(undefined, o));
  const snapshots = useStudentQuery(['snapshots', page], (o) =>
    getStudentSkillSnapshots({ page }, o),
  );
  return (
    <>
      <h1>Мой путь знаний</h1>
      <p className="lead">Каждый навык — ещё один шаг к твоей цели</p>
      <label className="filter">
        Предмет
        <select
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setSkill('');
          }}
        >
          <option value="">Все предметы</option>
          {maps.data?.map((m) => (
            <option key={m.subjectId} value={m.subjectId}>
              {m.subjectName}
            </option>
          ))}
        </select>
      </label>
      <QueryState query={maps}>
        {maps.data?.length ? (
          maps.data
            .filter((m) => !subject || m.subjectId === subject)
            .map((m) => (
              <Panel key={m.subjectId} title={m.subjectName}>
                <ul className="skill-list">
                  {m.skills.map((s) => (
                    <li key={s.skillId}>
                      <div>
                        <strong>{s.name}</strong>
                        <small>{s.category}</small>
                      </div>
                      <div>
                        <Status value={s.status} />
                        <button
                          className="quiet"
                          onClick={() => setSkill(skill === s.skillId ? '' : s.skillId)}
                          aria-expanded={skill === s.skillId}
                        >
                          История навыка
                        </button>
                      </div>
                      {skill === s.skillId && (
                        <div className="full-width">
                          <SkillHistory id={skill} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {!m.skills.length && <Empty>Навыки ещё не добавлены.</Empty>}
                <h3>Цели обучения</h3>
                {m.learningGoals.length ? (
                  <ul className="goals">
                    {m.learningGoals.map((g) => (
                      <li key={g.goalId}>
                        <span aria-hidden="true">{g.isAchieved ? '✓' : '○'}</span>
                        <div>
                          {g.text}
                          <small>
                            {g.isAchieved ? 'Достигнута' : `Срок: ${date(g.targetDate)}`}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>Обсудите цели с преподавателем.</Empty>
                )}
                <p className="muted">
                  Последний срез: {date(m.lastSnapshotAt)}
                  {m.nextSnapshotIn !== null
                    ? ` · Следующий через ${m.nextSnapshotIn} занятий`
                    : ''}
                </p>
              </Panel>
            ))
        ) : (
          <Empty>Предметы пока не назначены.</Empty>
        )}
      </QueryState>
      <Panel title="История срезов">
        <QueryState query={snapshots}>
          {snapshots.data?.items.length ? (
            snapshots.data.items.map((s) => (
              <details key={s.snapshotId}>
                <summary>
                  {s.subjectName} · {date(s.createdAt)} · Урок {s.lessonNumber}
                </summary>
                <p>{s.teacherSummary}</p>
                <ul className="skill-list">
                  {s.skills.map((k, i) => (
                    <li key={i}>
                      <span>{k.skillName}</span>
                      <Status value={k.status} />
                      {k.teacherComment && <p className="full-width">{k.teacherComment}</p>}
                    </li>
                  ))}
                </ul>
              </details>
            ))
          ) : (
            <Empty>Подтверждённых срезов пока нет.</Empty>
          )}
        </QueryState>
        {snapshots.data && <Pager {...snapshots.data} change={setPage} />}
      </Panel>
    </>
  );
}
export function Materials() {
  const [page, setPage] = useState(1),
    [subject, setSubject] = useState('');
  const maps = useStudentQuery(['skills'], (o) => getStudentSkillMaps(undefined, o));
  const query = useStudentQuery(['materials', page, subject], (o) =>
    getStudentMaterials({ page, ...(subject ? { subjectId: subject } : {}) }, o),
  );
  const download = useCommand(async (fileId: string) => {
    const result = await read((o) => getStudentMaterialUrl(fileId, o));
    const url = safeUrl(result.url);
    if (!url) return Promise.reject({ code: 'INVALID_URL' });
    window.location.assign(url);
  });
  return (
    <>
      <h1>Материалы</h1>
      <p className="lead">Всё необходимое для уроков и самостоятельной работы</p>
      <label className="filter">
        Предмет
        <select
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все предметы</option>
          {maps.data?.map((s) => (
            <option key={s.subjectId} value={s.subjectId}>
              {s.subjectName}
            </option>
          ))}
        </select>
      </label>
      <Panel title="Библиотека">
        <ErrorNotice error={download.error} />
        <QueryState query={query}>
          {query.data?.items.length ? (
            <ul className="homework-list">
              {query.data.items.map((m) => (
                <li key={m.fileId}>
                  <div>
                    <small>
                      {m.subjectName} · {m.sharedByTeacherName}
                    </small>
                    <h3>{m.fileName}</h3>
                    <p className="muted">
                      {m.mimeType} · {(m.fileSizeBytes / 1024 / 1024).toFixed(1)} МБ ·{' '}
                      {date(m.sharedAt)}
                    </p>
                    {m.lessonTitle && <p>{m.lessonTitle}</p>}
                  </div>
                  <button disabled={download.isPending} onClick={() => download.mutate(m.fileId)}>
                    Скачать
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Преподаватель ещё не поделился материалами.</Empty>
          )}
        </QueryState>
        {query.data && <Pager {...query.data} change={setPage} />}
      </Panel>
    </>
  );
}
export function Subscription() {
  const [paymentsPage, setPaymentsPage] = useState(1),
    [ledgerPage, setLedgerPage] = useState(1);
  const query = useStudentQuery(['subscription'], (o) => getStudentSubscription(undefined, o));
  const payments = useStudentQuery(['payments', paymentsPage], (o) =>
    getStudentSubscriptionPayments({ page: paymentsPage }, o),
  );
  const ledger = useStudentQuery(['ledger', ledgerPage], (o) =>
    getStudentSubscriptionLedger({ page: ledgerPage }, o),
  );
  return (
    <>
      <h1>Абонемент</h1>
      <p className="lead">Занятия, срок действия и история операций</p>
      <Panel title="Твой абонемент">
        <QueryState query={query}>
          {query.data && (
            <>
              <Status value={query.data.status} />
              <h3>{query.data.planName ?? 'Абонемент пока не оформлен'}</h3>
              <div className="balance">
                <strong>{query.data.lessonsRemaining ?? '—'}</strong>
                <span>занятий осталось из {query.data.lessonsTotal ?? '—'}</span>
              </div>
              <p>
                Период: {date(query.data.validFrom)} — {date(query.data.validUntil)}
              </p>
              {query.data.isFrozen && (
                <p>
                  Заморозка: {date(query.data.frozenFrom)} — {date(query.data.frozenUntil)}
                </p>
              )}
              <p className="muted">По вопросам абонемента обращайся к менеджеру.</p>
            </>
          )}
        </QueryState>
      </Panel>
      <Panel title="Подтверждённые платежи">
        <QueryState query={payments}>
          {payments.data?.items.length ? (
            <ul className="history-list">
              {payments.data.items.map((p) => (
                <li key={p.paymentId}>
                  <strong>
                    {p.amount} {p.currency}
                  </strong>
                  <span>{p.description}</span>
                  <small>
                    {date(p.confirmedAt, true)}
                    {p.lessonsAdded !== null ? ` · Добавлено занятий: ${p.lessonsAdded}` : ''}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Подтверждённых платежей пока нет.</Empty>
          )}
        </QueryState>
        {payments.data && <Pager {...payments.data} change={setPaymentsPage} />}
      </Panel>
      <Panel title="История занятий и баланса">
        <QueryState query={ledger}>
          {ledger.data?.items.length ? (
            <ul className="history-list">
              {ledger.data.items.map((e) => (
                <li key={e.entryId}>
                  <strong>{e.description}</strong>
                  <span>
                    {e.balanceBefore} → {e.balanceAfter} занятий
                  </span>
                  <small>{date(e.entryDate)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Операций пока нет.</Empty>
          )}
        </QueryState>
        {ledger.data && <Pager {...ledger.data} change={setLedgerPage} />}
      </Panel>
    </>
  );
}
export function Notifications() {
  const [page, setPage] = useState(1);
  const query = useStudentQuery(
    ['notifications', page],
    (o) => getStudentNotifications({ page }, o),
    true,
    60_000,
  );
  const markAll = useCommand(() => write(markAllStudentNotificationsRead));
  const mark = useCommand((id: string) => write((o) => markStudentNotificationRead(id, o)));
  return (
    <>
      <h1>Уведомления</h1>
      <div className="toolbar">
        <p className="lead">Непрочитанных: {query.data?.unreadCount ?? '—'}</p>
        <button
          disabled={markAll.isPending || !query.data?.unreadCount}
          onClick={() => markAll.mutate()}
        >
          Прочитать все
        </button>
      </div>
      <ErrorNotice error={markAll.error ?? mark.error} />
      <Panel title="События обучения">
        <QueryState query={query}>
          {query.data?.items.length ? (
            <ul className="notification-list">
              {query.data.items.map((n) => (
                <li key={n.notificationId} className={n.isRead ? '' : 'unread'}>
                  <div>
                    <h3>{n.title}</h3>
                    <p className="preserve-lines">{n.body}</p>
                    <small>{date(n.createdAt, true)}</small>
                  </div>
                  {!n.isRead && (
                    <button disabled={mark.isPending} onClick={() => mark.mutate(n.notificationId)}>
                      Прочитано
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Новых событий пока нет.</Empty>
          )}
        </QueryState>
        {query.data && <Pager {...query.data} change={setPage} />}
      </Panel>
    </>
  );
}
