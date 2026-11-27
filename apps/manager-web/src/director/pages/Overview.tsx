import { ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useManager } from '../../manager/store';
import { AttentionItem, HBarList, KpiCard } from '../../shared/analytics';
import { fmtDay, fmtMoney, fmtTime, plural, relative } from '../../shared/format';
import { Avatar, Badge } from '../../shared/ui';
import { ageDays, allDecisions, availability, DECISION_KINDS, decisionKind, liveStaff, managerMetrics, teacherMetrics, unresolvedKind } from '../logic';
import { useDirector } from '../store';
import type { UnresolvedKind } from '../types';

/**
 * Director overview. Question: "Is the academy OK today and what needs my decision?"
 * Level 1 = KPI strip; level 2 = breakdown cards; level 3 = linked record lists.
 */
export function DirectorOverview() {
  const { state } = useDirector();
  const { state: manager } = useManager();
  const navigate = useNavigate();
  const decisions = allDecisions(state, manager);
  const oldest = decisions[0];
  const oldestDays = oldest ? ageDays(oldest.requestedAt, state.now) : 0;
  const blocked = decisions.filter((d) => !d.ready).length;
  const openEsc = state.escalations.filter((e) => e.state === 'OPEN');
  const staff = liveStaff(state, manager);
  const managers = staff.filter((s) => s.kind === 'MANAGER' && s.active);
  const teachers = staff.filter((s) => s.kind === 'TEACHER' && s.active);
  const available = managers.filter((m) => managerMetrics(m).availability === 'AVAILABLE').length;
  const payroll = state.payroll.totals[0];
  const period = state.periods.find((p) => p.id === state.payroll.periodId) ?? state.periods[0];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div>
          <h1>Обзор академии</h1>
          <span className="stale">Данные на {fmtTime(state.now)}</span>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-dark" onClick={() => navigate('/director/decisions')}>
            Очередь решений <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      <div className="kpis" aria-label="Ключевые показатели">
        <KpiCard
          label="Ждут вашего решения"
          color="yellow"
          value={decisions.length}
          context={oldest ? `старейшее — ${oldestDays ? `${oldestDays} ${plural(oldestDays, 'день', 'дня', 'дней')}` : 'сегодня'}${blocked ? ` · ${blocked} заблок.` : ''}` : 'очередь пуста'}
          tone={oldestDays >= 3 ? 'problem' : decisions.length ? 'warn' : 'ok'}
          to="/director/decisions"
        />
        <KpiCard
          label="Открытые эскалации"
          color="coral"
          value={openEsc.length}
          context={openEsc.length ? `${openEsc.filter((e) => e.reason === 'MANAGER_UNAVAILABLE').length} — менеджер недоступен` : 'все приняты'}
          tone={openEsc.length ? 'problem' : 'ok'}
          to="/director/team?tab=escalations"
        />
        <KpiCard color="teal" label="Менеджеры на связи" value={`${available} / ${managers.length}`} context="сейчас" tone={available < managers.length ? 'warn' : 'neutral'} to="/director/team" />
        <KpiCard
          label="Долг перед преподавателями"
          color="blue"
          value={payroll ? fmtMoney(payroll.outstanding, payroll.currency) : '—'}
          context={payroll ? `начислено ${fmtMoney(payroll.accrued, payroll.currency)} · выплачено ${fmtMoney(payroll.paid, payroll.currency)}` : 'нет данных'}
          to="/director/finance"
        />
        <KpiCard
          label="Блокеры закрытия периода"
          color="violet"
          value={period ? period.blockers : '—'}
          context={period ? `период ${fmtDay(period.startsAt)} — ${fmtDay(new Date(new Date(period.endsAt).getTime() - 12 * 3600_000).toISOString())}` : 'нет периода'}
          tone={period && period.blockers > 0 ? 'warn' : 'neutral'}
          to="/director/finance"
        />
      </div>

      <div className="grid-dir">
        <section className="card" aria-labelledby="h-dq">
          <div className="card-head">
            <h3 id="h-dq">Решения по типам</h3>
            <span className="right section-note">нажмите тип, чтобы открыть очередь</span>
          </div>
          <HBarList
            label="Решения по типам"
            empty="Очередь решений пуста"
            rows={DECISION_KINDS.map((k) => {
              const items = decisions.filter((d) => d.kind === k);
              const old = items.filter((d) => ageDays(d.requestedAt, state.now) >= 3).length;
              return {
                key: k,
                label: decisionKind[k].label,
                sub: old ? `${old} ждут 3+ дня` : undefined,
                value: items.length,
                to: `/director/decisions?kind=${k}`,
                tone: old ? ('problem' as const) : undefined,
              };
            }).filter((r) => r.value > 0).sort((a, b) => b.value - a.value)}
          />
        </section>

        <section className="card" aria-labelledby="h-esc">
          <div className="card-head">
            <h3 id="h-esc">Эскалации</h3>
            <Badge tone={openEsc.length ? 'coral' : 'teal'}>{openEsc.length}</Badge>
          </div>
          {openEsc.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Все эскалации приняты.</p>
          ) : (
            <ul className="attn-list">
              {openEsc.map((e) => (
                <AttentionItem
                  key={e.escalationId}
                  tone="problem"
                  title={`${e.studentName ?? e.leadName ?? '—'} · ${e.title}`}
                  meta={`${e.primaryManagerName ?? 'без менеджера'} · ${e.reason === 'MANAGER_UNAVAILABLE' ? 'менеджер недоступен' : 'не принята вовремя'} · ${relative(e.escalatedAt, state.now)}`}
                  to="/director/team?tab=escalations"
                  action="Принять"
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid-dir">
        <section className="card" aria-labelledby="h-mgr">
          <div className="card-head">
            <h3 id="h-mgr">Менеджеры</h3>
            <button type="button" className="link right" onClick={() => navigate('/director/team')}>
              Вся команда
            </button>
          </div>
          <div className="table-wrap flush">
            <table>
              <thead>
                <tr>
                  <th scope="col">Менеджер</th>
                  <th scope="col">Статус</th>
                  <th scope="col" className="r">Ученики</th>
                  <th scope="col" className="r">Заявки</th>
                  <th scope="col" className="r">Задачи</th>
                  <th scope="col" className="r">Эскал.</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => {
                  const mm = managerMetrics(m);
                  return (
                    <tr key={m.id} tabIndex={0} onClick={() => navigate('/director/team')} onKeyDown={(e) => e.key === 'Enter' && navigate('/director/team')}>
                      <td>
                        <span className="cell-person">
                          <Avatar name={m.fullName} />
                          <b>{m.fullName}</b>
                        </span>
                      </td>
                      <td><Badge tone={availability[mm.availability].tone}>{availability[mm.availability].label}</Badge></td>
                      <td className="r">{mm.students}</td>
                      <td className="r">{mm.leads}</td>
                      <td className="r">{mm.openTasks}</td>
                      <td className="r">{mm.openEscalations ? <span className="neg">{mm.openEscalations}</span> : 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" aria-labelledby="h-load">
          <div className="card-head">
            <h3 id="h-load">Уроки на 7 дней</h3>
            <span className="right section-note">по преподавателям</span>
          </div>
          <HBarList
            label="Запланированные уроки на ближайшие 7 дней по преподавателям"
            rows={teachers
              .map((t) => ({ t, m: teacherMetrics(t) }))
              .sort((a, b) => b.m.lessonsNext7Days - a.m.lessonsNext7Days)
              .map(({ t, m }) => ({
                key: t.id,
                label: t.fullName,
                sub: `${m.activeStudents} ${plural(m.activeStudents, 'ученик', 'ученика', 'учеников')}`,
                value: m.lessonsNext7Days,
                to: '/director/team?tab=teachers',
              }))}
          />
        </section>
      </div>

      <section className="card" aria-labelledby="h-unres">
        <div className="card-head">
          <h3 id="h-unres">Незакрытые финансовые факты</h3>
          <span className="right section-note">мешают закрыть период</span>
        </div>
        <HBarList
          label="Незакрытые финансовые факты по типам"
          empty="Блокеров нет — период можно закрывать"
          rows={(Object.keys(unresolvedKind) as UnresolvedKind[])
            .map((k) => ({ key: k, label: unresolvedKind[k], value: state.unresolved.items.filter((i) => i.kind === k).length, to: `/director/finance?kind=${k}`, tone: 'warn' as const }))
            .filter((r) => r.value > 0)}
        />
      </section>

      <p className="section-note">
        Динамика выручки, удержание и отток учеников появятся после аналитических эндпоинтов API — сейчас у руководителя их нет, поэтому они не показаны.
      </p>
    </div>
  );
}
