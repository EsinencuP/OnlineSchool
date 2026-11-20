import { useEffect, useState } from 'react';
import { Icon } from '@online-school/ui';
import { record, request } from './contract.js';
import type { Details } from './contract.js';
import { useEndpoint } from './hooks.js';
import { LoadState } from './Operations.js';
import { chartColors, GroupedBars, HorizontalBars } from './Charts.js';
import { enumTitle, t } from './actionCopy.js';

const arr = (value: unknown) => (Array.isArray(value) ? value.map(record) : []);
const amount = (value: unknown) => {
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};
function currencyFormat(currency: string) {
  try {
    const format = new Intl.NumberFormat(t('ru', 'ro'), {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    return (value: number) => format.format(value);
  } catch {
    return (value: number) => `${Math.round(value)} ${currency}`;
  }
}
const count = (value: number) => new Intl.NumberFormat(t('ru', 'ro')).format(value);

function lastMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}
function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(t('ru', 'ro'), { month: 'short' })
    .format(new Date(year!, (m ?? 1) - 1, 1))
    .replace('.', '');
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="cab-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

/** Teacher: what was accrued and paid in each of the last six months. */
export function TeacherEarnings() {
  const [months] = useState(() => lastMonths(6));
  const [state, setState] = useState<{ data: Details[] | null; error: unknown }>({
    data: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      months.map((month) =>
        request<unknown>('getTeacherPayrollStatement', {
          query: { month },
          signal: controller.signal,
        }).then(record),
      ),
    )
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ data: null, error });
      });
    return () => controller.abort();
  }, [months, attempt]);
  if (!state.data)
    return (
      <section className="cab-card cab-analytics">
        <LoadState
          refreshing={!state.error}
          error={state.error}
          retry={() => {
            setState({ data: null, error: null });
            setAttempt((value) => value + 1);
          }}
        />
      </section>
    );
  const statements = state.data;
  const currencies = [
    ...new Set(statements.flatMap((s) => arr(s.totals).map((row) => String(row.currency)))),
  ];
  const labels = months.map(monthLabel);
  return (
    <section className="cab-card cab-analytics" aria-label={t('Мой заработок', 'Câștigurile mele')}>
      <header className="cab-analytics-head">
        <h2>
          <Icon name="wallet" size={19} /> {t('Мой заработок по месяцам', 'Câștigurile mele pe luni')}
        </h2>
        <span>{t('Последние 6 месяцев', 'Ultimele 6 luni')}</span>
      </header>
      {!currencies.length ? (
        <p className="cab-empty">
          {t(
            'За последние 6 месяцев начислений пока нет.',
            'În ultimele 6 luni nu există calcule.',
          )}
        </p>
      ) : (
        currencies.map((currency) => {
          const pickTotal = (key: string) =>
            statements.map((s) =>
              amount(arr(s.totals).find((row) => row.currency === currency)?.[key]),
            );
          const accrued = pickTotal('accrued');
          const paid = pickTotal('paid');
          const outstanding = pickTotal('outstanding');
          const format = currencyFormat(currency);
          const sum = accrued.reduce((a, b) => a + b, 0);
          const best = accrued.indexOf(Math.max(...accrued));
          const lessons = statements[statements.length - 1]
            ? arr(statements[statements.length - 1]!.lines).filter((l) => l.currency === currency)
                .length
            : 0;
          return (
            <div key={currency} className="cab-analytics-body">
              <div className="cab-kpis">
                <Kpi label={t('Начислено за 6 мес.', 'Calculat în 6 luni')} value={format(sum)} />
                <Kpi
                  label={t('Лучший месяц', 'Cea mai bună lună')}
                  value={sum ? `${labels[best]} · ${format(accrued[best] ?? 0)}` : '—'}
                />
                <Kpi
                  label={t('Ждёт выплаты сейчас', 'De primit acum')}
                  value={format(outstanding[outstanding.length - 1] ?? 0)}
                  note={t(`уроков в этом месяце: ${lessons}`, `lecții luna aceasta: ${lessons}`)}
                />
              </div>
              <GroupedBars
                title={t(`Начислено и выплачено, ${currency}`, `Calculat și plătit, ${currency}`)}
                categories={labels}
                format={format}
                series={[
                  { key: 'accrued', label: t('Начислено', 'Calculat'), color: chartColors.violet, values: accrued },
                  { key: 'paid', label: t('Выплачено', 'Plătit'), color: chartColors.green, values: paid },
                ]}
              />
            </div>
          );
        })
      )}
    </section>
  );
}

/** Manager: lead funnel, conversion and the student portfolio, from the dashboard read. */
export function ManagerAnalytics({ payload }: { payload: Details }) {
  const leads = record(payload.leads);
  const stages = record(leads.countsByStage);
  const students = record(payload.students);
  if (!Object.keys(stages).length && !Object.keys(students).length) return null;
  const funnel = ['NEW', 'IN_PROGRESS', 'TRIAL', 'AWAITING_PAYMENT'].map((stage) => ({
    label: enumTitle(stage),
    value: amount(stages[stage]),
  }));
  const conversion = typeof leads.conversion30dBp === 'number' ? leads.conversion30dBp / 100 : null;
  const pending = arr(record(payload.pendingPayments).totalsByCurrency);
  return (
    <section className="cab-card cab-analytics" aria-label={t('Аналитика', 'Analiză')}>
      <header className="cab-analytics-head">
        <h2>
          <Icon name="skills" size={19} /> {t('Аналитика продаж', 'Analiza vânzărilor')}
        </h2>
        <span>{t('Данные на сейчас', 'Date curente')}</span>
      </header>
      <div className="cab-kpis">
        <Kpi
          label={t('Конверсия за 30 дней', 'Conversie în 30 de zile')}
          value={conversion === null ? '—' : `${conversion.toFixed(1)}%`}
        />
        <Kpi label={t('Новых заявок сегодня', 'Cereri noi azi')} value={count(amount(leads.createdToday))} />
        <Kpi label={t('Пробных сегодня', 'Probe azi')} value={count(amount(leads.trialsToday))} />
        <Kpi
          label={t('Ждут распределения', 'Așteaptă distribuirea')}
          value={
            pending.length
              ? pending
                  .map((row) => currencyFormat(String(row.currency))(amount(row.amount)))
                  .join(' · ')
              : '—'
          }
        />
      </div>
      <div className="cab-analytics-split">
        <HorizontalBars title={t('Воронка заявок', 'Pâlnia cererilor')} items={funnel} format={count} />
        <HorizontalBars
          title={t('Ученики в портфеле', 'Elevi în portofoliu')}
          color={chartColors.green}
          format={count}
          items={[
            { label: t('Активные', 'Activi'), value: amount(students.active) },
            { label: t('Заморожены', 'Înghețați'), value: amount(students.frozen) },
            { label: t('Ещё заявки', 'Încă cereri'), value: amount(students.leads) },
          ]}
        />
      </div>
    </section>
  );
}

/** Director: accrued, paid and owed per teacher (all periods, or one period). */
export function DirectorPayrollChart() {
  const result = useEndpoint<unknown>('getDirectorPayrollSummary');
  const data = record(result.data);
  const teachers = arr(data.teachers);
  const currencies = [...new Set(teachers.map((row) => String(row.currency)))];
  return (
    <section className="cab-card cab-analytics" aria-label={t('Начисления', 'Calcule')}>
      <header className="cab-analytics-head">
        <h2>
          <Icon name="wallet" size={19} />{' '}
          {t('Начисления и выплаты преподавателям', 'Calcule și plăți către profesori')}
        </h2>
        <span>{t('За всё время', 'Pentru toată perioada')}</span>
      </header>
      {result.pending || result.error ? (
        <LoadState refreshing={result.pending} error={result.error} retry={result.refresh} />
      ) : !currencies.length ? (
        <p className="cab-empty">{t('Начислений пока нет.', 'Încă nu există calcule.')}</p>
      ) : (
        currencies.map((currency) => {
          const rows = teachers
            .filter((row) => row.currency === currency)
            .sort((a, b) => amount(b.accrued) - amount(a.accrued))
            .slice(0, 8);
          const total = arr(data.totals).find((row) => row.currency === currency) ?? {};
          const format = currencyFormat(currency);
          return (
            <div key={currency} className="cab-analytics-body">
              <div className="cab-kpis">
                <Kpi label={t('Начислено', 'Calculat')} value={format(amount(total.accrued))} />
                <Kpi label={t('Выплачено', 'Plătit')} value={format(amount(total.paid))} />
                <Kpi label={t('Долг перед преподавателями', 'Datorii către profesori')} value={format(amount(total.outstanding))} />
              </div>
              <GroupedBars
                title={t(`По преподавателям, ${currency}`, `Pe profesori, ${currency}`)}
                categories={rows.map((row) =>
                  String(row.teacherName ?? '—')
                    .replace(/^\[(ДЕМО|DEMO)\]\s*/i, '')
                    .split(' ')
                    .slice(0, 2)
                    .map((part, i) => (i ? `${part[0] ?? ''}.` : part))
                    .join(' '),
                )}
                format={format}
                series={[
                  { key: 'accrued', label: t('Начислено', 'Calculat'), color: chartColors.violet, values: rows.map((r) => amount(r.accrued)) },
                  { key: 'paid', label: t('Выплачено', 'Plătit'), color: chartColors.green, values: rows.map((r) => amount(r.paid)) },
                  { key: 'outstanding', label: t('К выплате', 'De plătit'), color: chartColors.orange, values: rows.map((r) => amount(r.outstanding)) },
                ]}
              />
            </div>
          );
        })
      )}
    </section>
  );
}
