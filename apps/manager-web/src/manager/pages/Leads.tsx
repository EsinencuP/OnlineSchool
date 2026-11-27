import { Clock, Plus, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, Badge, Notice, Panel } from '../../shared/ui';
import { canMoveLead, errorText } from '../logic';
import { useManager } from '../store';
import type { Lead, LeadLostReason, LeadSource, LeadStage } from '../types';
import { fmtDateTime, relative } from '../../shared/format';
import { leadSource, leadStage, lostReason } from '../labels';

const OPEN_STAGES: LeadStage[] = ['NEW', 'IN_PROGRESS', 'TRIAL', 'AWAITING_PAYMENT'];
const SUBJECTS = ['Математика', 'Английский язык', 'Физика', 'Химия', 'Информатика', 'История'];

export function Leads() {
  const { state } = useManager();
  const [params, setParams] = useSearchParams();
  // Filters live in the URL so links from the dashboard land filtered and Back restores them.
  const closed = params.get('view') === 'closed';
  const setClosed = (v: boolean) => {
    const next = new URLSearchParams(params);
    if (v) next.set('view', 'closed');
    else next.delete('view');
    setParams(next, { replace: true });
  };
  const [source, setSource] = useState<LeadSource | 'ALL'>('ALL');
  const onlyOverdue = params.get('overdue') === '1';
  const setOnlyOverdue = (fn: (v: boolean) => boolean) => {
    const next = new URLSearchParams(params);
    if (fn(onlyOverdue)) next.set('overdue', '1');
    else next.delete('overdue');
    setParams(next, { replace: true });
  };
  const selectedId = params.get('lead');
  const selected = state.leads.find((l) => l.leadId === selectedId) ?? null;
  const creating = params.get('new') === '1';

  const filtered = useMemo(
    () =>
      state.leads.filter(
        (l) => (source === 'ALL' || l.source === source) && (!onlyOverdue || l.isOverdue),
      ),
    [state.leads, source, onlyOverdue],
  );
  const columns: LeadStage[] = closed ? ['CONVERTED', 'LOST'] : OPEN_STAGES;
  const overdueCount = state.leads.filter((l) => l.isOverdue && !['LOST', 'CONVERTED'].includes(l.stage)).length;

  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('lead', id);
    else next.delete('lead');
    next.delete('new');
    setParams(next, { replace: true });
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Заявки</h1>
          <p>Воронка из шести стадий: от первого контакта до оплаты абонемента. Закрыть заявку без оплаты можно с указанием причины.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-yellow" onClick={() => setParams({ new: '1' })}>
            <Plus size={16} /> Новая заявка
          </button>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Фильтры заявок">
        <button type="button" className="chip" aria-pressed={!closed} onClick={() => setClosed(false)}>
          Открытые <span className="n">{state.leads.filter((l) => OPEN_STAGES.includes(l.stage)).length}</span>
        </button>
        <button type="button" className="chip" aria-pressed={closed} onClick={() => setClosed(true)}>
          Закрытые <span className="n">{state.leads.filter((l) => !OPEN_STAGES.includes(l.stage)).length}</span>
        </button>
        <span style={{ width: 12 }} />
        <button type="button" className="chip" aria-pressed={onlyOverdue} onClick={() => setOnlyOverdue((v) => !v)}>
          <TriangleAlert size={14} /> Просрочен контакт <span className="n">{overdueCount}</span>
        </button>
        <label className="sr-only" htmlFor="lead-source">
          Источник
        </label>
        <select id="lead-source" className="chip" value={source} onChange={(e) => setSource(e.target.value as LeadSource | 'ALL')}>
          <option value="ALL">Все источники</option>
          {Object.entries(leadSource).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="kanban" style={closed ? { gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))' } : undefined}>
        {columns.map((stage) => {
          const items = filtered.filter((l) => l.stage === stage);
          return (
            <section key={stage} className="kcol" aria-label={leadStage[stage].label}>
              <div className="kcol-head">
                <Badge tone={leadStage[stage].tone}>{leadStage[stage].label}</Badge>
                <span className="n num">{items.length}</span>
              </div>
              {items.length === 0 && <p className="muted" style={{ padding: '8px 6px', fontSize: 13 }}>Пусто</p>}
              {items.map((l) => (
                <LeadCard key={l.leadId} lead={l} now={state.now} onOpen={() => open(l.leadId)} />
              ))}
            </section>
          );
        })}
      </div>

      {selected && <LeadDrawer lead={selected} onClose={() => open(null)} />}
      {creating && <CreateLead onClose={() => open(null)} />}
    </div>
  );
}

function LeadCard({ lead, now, onOpen }: { lead: Lead; now: string; onOpen: () => void }) {
  return (
    <button type="button" className={`kcard${lead.isOverdue ? ' overdue' : ''}`} onClick={onOpen}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Avatar name={lead.contactName} />
        <div style={{ minWidth: 0 }}>
          <div className="name">{lead.contactName}</div>
          <div className="meta">
            {lead.subjectName}
            {lead.grade ? ` · ${lead.grade} класс` : lead.audience === 'ADULT' ? ' · взрослый' : ''}
          </div>
        </div>
      </div>
      <div className="meta">
        <Badge tone="neutral">{leadSource[lead.source]}</Badge>
        {lead.possibleDuplicateAtIntake && <Badge tone="violet">Возможный дубль</Badge>}
      </div>
      {lead.stage === 'TRIAL' && lead.trial && (
        <div className="foot">
          <Clock size={14} />
          Пробный {fmtDateTime(lead.trial.startsAt)}
          {lead.trial.outcome === 'ATTENDED' && <Badge tone="teal">Был</Badge>}
        </div>
      )}
      {lead.nextActionAt && (
        <div className="foot" style={{ color: lead.isOverdue ? 'var(--coral-ink)' : 'var(--muted)', fontWeight: lead.isOverdue ? 600 : 400 }}>
          {lead.isOverdue ? <TriangleAlert size={14} /> : <Clock size={14} />}
          Следующий контакт {relative(lead.nextActionAt, now)}
        </div>
      )}
      {lead.stage === 'LOST' && lead.lostReason && <div className="meta">Причина: {lostReason[lead.lostReason]}</div>}
    </button>
  );
}

function LeadDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { state, run } = useManager();
  const [mode, setMode] = useState<'none' | 'trial' | 'pay' | 'lose'>('none');
  const [teacherId, setTeacherId] = useState(
    state.teachers.find((t) => t.subjects.includes(lead.subjectName))?.teacherId ?? state.teachers[0]?.teacherId ?? '',
  );
  const tomorrow = new Date(new Date(state.now).getTime() + 26 * 3600_000);
  tomorrow.setMinutes(0, 0, 0);
  const [startsAt, setStartsAt] = useState(toLocalInput(tomorrow));
  const [reason, setReason] = useState('');
  const [lose, setLose] = useState<LeadLostReason>('NOT_INTERESTED');
  const terminal = lead.stage === 'CONVERTED';

  const canTrial = lead.stage === 'NEW' || canMoveLead(lead, 'TRIAL') === null;
  const payBlock = lead.stage === 'IN_PROGRESS' ? null : canMoveLead(lead, 'AWAITING_PAYMENT');
  const after = (ok: boolean) => ok && setMode('none');

  return (
    <Panel title={lead.contactName} onClose={onClose} header={<Avatar name={lead.contactName} size="lg" />}>
      <div className="chips">
        <Badge tone={leadStage[lead.stage].tone}>{leadStage[lead.stage].label}</Badge>
        <Badge tone="neutral">{leadSource[lead.source]}</Badge>
        {lead.isOverdue && <Badge tone="coral">Контакт просрочен</Badge>}
      </div>

      <section className="card">
        <div className="card-head"><h3>Контакт</h3></div>
        <dl className="kv">
          <dt>Предмет</dt>
          <dd>{lead.subjectName}{lead.grade ? `, ${lead.grade} класс` : ''}</dd>
          <dt>Родитель</dt>
          <dd>{lead.guardianName ?? '—'}</dd>
          <dt>Телефон</dt>
          <dd className="num">{lead.phone ?? lead.maskedPhone ?? '—'}</dd>
          <dt>Создана</dt>
          <dd>{fmtDateTime(lead.createdAt)}</dd>
          <dt>След. контакт</dt>
          <dd>{lead.nextActionAt ? `${fmtDateTime(lead.nextActionAt)} (${relative(lead.nextActionAt, state.now)})` : '—'}</dd>
          {lead.comment && (
            <>
              <dt>Комментарий</dt>
              <dd>{lead.comment}</dd>
            </>
          )}
        </dl>
      </section>

      {lead.trial && (
        <section className="card">
          <div className="card-head">
            <h3>Пробный урок</h3>
            <span className="right">
              <Badge tone={lead.trial.outcome === 'ATTENDED' ? 'teal' : lead.trial.outcome === 'NO_SHOW' ? 'coral' : 'yellow'}>
                {{ PENDING: 'Ожидается', ATTENDED: 'Состоялся', NO_SHOW: 'Не пришёл', CANCELLED: 'Отменён' }[lead.trial.outcome]}
              </Badge>
            </span>
          </div>
          <dl className="kv">
            <dt>Когда</dt>
            <dd>{fmtDateTime(lead.trial.startsAt)}</dd>
            <dt>Преподаватель</dt>
            <dd>{lead.trial.teacherName}</dd>
            {lead.trial.feedbackSummary && (
              <>
                <dt>Отзыв</dt>
                <dd>{lead.trial.feedbackSummary}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {!terminal && (
        <section className="card" aria-label="Действия">
          <div className="card-head"><h3>Следующий шаг</h3></div>
          <div className="chips">
            {lead.stage === 'NEW' && (
              <button type="button" className="btn btn-dark btn-sm" onClick={() => run({ type: 'lead.claim', leadId: lead.leadId })}>
                Взять в работу
              </button>
            )}
            {lead.stage !== 'LOST' && canTrial && (
              <button type="button" className="btn btn-yellow btn-sm" aria-pressed={mode === 'trial'} onClick={() => setMode('trial')}>
                Назначить пробный
              </button>
            )}
            {(lead.stage === 'IN_PROGRESS' || lead.stage === 'TRIAL') && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={payBlock !== null}
                title={payBlock ? errorText(payBlock) : undefined}
                onClick={() =>
                  lead.stage === 'TRIAL'
                    ? run({ type: 'lead.transition', leadId: lead.leadId, to: 'AWAITING_PAYMENT' })
                    : setMode('pay')
                }
              >
                К оплате
              </button>
            )}
            {lead.stage !== 'LOST' ? (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setMode('lose')}>
                Закрыть без оплаты
              </button>
            ) : (
              <button type="button" className="btn btn-dark btn-sm" onClick={() => run({ type: 'lead.reopen', leadId: lead.leadId })}>
                Вернуть в работу
              </button>
            )}
          </div>
          {payBlock && lead.stage === 'TRIAL' && <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>{errorText(payBlock)}</p>}

          {mode === 'trial' && (
            <form
              style={{ display: 'grid', gap: 12, marginTop: 16 }}
              onSubmit={(e) => {
                e.preventDefault();
                after(run({ type: 'lead.trial', leadId: lead.leadId, teacherId, startsAt: new Date(startsAt).toISOString() }).ok);
              }}
            >
              <div className="form-row">
                <div className="field">
                  <label htmlFor="trial-teacher">Преподаватель</label>
                  <select id="trial-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                    {state.teachers.map((t) => (
                      <option key={t.teacherId} value={t.teacherId}>
                        {t.name} — {t.subjects.join(', ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="trial-at">Дата и время</label>
                  <input id="trial-at" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn btn-dark">Назначить пробный урок</button>
            </form>
          )}

          {mode === 'pay' && (
            <form
              style={{ display: 'grid', gap: 12, marginTop: 16 }}
              onSubmit={(e) => {
                e.preventDefault();
                after(run({ type: 'lead.transition', leadId: lead.leadId, to: 'AWAITING_PAYMENT', skipTrialReason: reason }).ok);
              }}
            >
              <Notice tone="yellow">Заявка идёт к оплате без пробного урока — нужна причина. Карточка ученика будет создана автоматически.</Notice>
              <div className="field">
                <label htmlFor="skip-reason">Причина</label>
                <input id="skip-reason" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Например: продолжает обучение с прошлого года" />
              </div>
              <button type="submit" className="btn btn-dark">Перевести в «Ждём оплату»</button>
            </form>
          )}

          {mode === 'lose' && (
            <form
              style={{ display: 'grid', gap: 12, marginTop: 16 }}
              onSubmit={(e) => {
                e.preventDefault();
                after(run({ type: 'lead.lose', leadId: lead.leadId, reason: lose }).ok);
              }}
            >
              <div className="field">
                <label htmlFor="lose-reason">Причина закрытия</label>
                <select id="lose-reason" value={lose} onChange={(e) => setLose(e.target.value as LeadLostReason)}>
                  {Object.entries(lostReason).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                {lead.trial && lead.trial.startsAt > state.now && <span className="hint">Назначенный пробный урок будет отменён.</span>}
              </div>
              <button type="submit" className="btn btn-danger">Закрыть заявку</button>
            </form>
          )}
        </section>
      )}

      <section className="card">
        <div className="card-head"><h3>История</h3></div>
        <div className="history">
          {[...lead.history].reverse().map((h, i) => (
            <div key={i} className="history-item">
              <i />
              <div>
                <b>{leadStage[h.to].label}</b>
                <div className="muted" style={{ fontSize: 12 }}>
                  {fmtDateTime(h.at)} · {h.byManager ? 'менеджер' : 'система'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Panel>
  );
}

function CreateLead({ onClose }: { onClose: () => void }) {
  const { run } = useManager();
  const [form, setForm] = useState({ contactName: '', guardianName: '', phone: '+373 ', subjectName: SUBJECTS[0]!, source: 'PHONE' as LeadSource, comment: '' });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Panel title="Новая заявка" variant="modal" onClose={onClose}>
      <form
        style={{ display: 'grid', gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (run({ type: 'lead.create', ...form }).ok) onClose();
        }}
      >
        <div className="field">
          <label htmlFor="nl-name">Ученик</label>
          <input id="nl-name" required minLength={2} value={form.contactName} onChange={set('contactName')} autoComplete="off" />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="nl-guardian">Родитель</label>
            <input id="nl-guardian" value={form.guardianName} onChange={set('guardianName')} />
            <span className="hint">Пусто — взрослый ученик</span>
          </div>
          <div className="field">
            <label htmlFor="nl-phone">Телефон</label>
            <input id="nl-phone" required pattern="\+?[0-9 ]{8,}" value={form.phone} onChange={set('phone')} inputMode="tel" />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="nl-subject">Предмет</label>
            <select id="nl-subject" value={form.subjectName} onChange={set('subjectName')}>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nl-source">Источник</label>
            <select id="nl-source" value={form.source} onChange={set('source')}>
              {Object.entries(leadSource).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="nl-comment">Комментарий</label>
          <textarea id="nl-comment" rows={3} value={form.comment} onChange={set('comment')} />
        </div>
        <button type="submit" className="btn btn-dark">Создать заявку</button>
      </form>
    </Panel>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

