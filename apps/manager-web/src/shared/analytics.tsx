import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Analytics primitives shared by all cabinets. Rules (see education-crm-design skill):
 * - every number carries its unit and a one-word baseline or period;
 * - "—" means no data, never a fake 0;
 * - warm colour only for a problem; the drill-down link sits on the number itself.
 */

export type KpiTone = 'neutral' | 'problem' | 'warn' | 'ok';

export function KpiCard({
  label,
  value,
  unit,
  context,
  tone = 'neutral',
  to,
  children,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  /** Baseline or period, e.g. "за 30 дней", "из 12". */
  context?: ReactNode;
  tone?: KpiTone;
  /** Level-3 drill-down: the records behind the number. */
  to?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value num">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {context && <span className="kpi-context">{context}</span>}
      {children}
      {to && <ChevronRight size={16} className="kpi-go" aria-hidden="true" />}
    </>
  );
  const cls = `kpi kpi-${tone}`;
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  /** Formatted value; defaults to the number. */
  display?: ReactNode;
  sub?: ReactNode;
  to?: string;
  tone?: 'problem' | 'warn' | 'muted';
}

/** Ranked horizontal bars: the default for comparing categories (length encodes quantity). */
export function HBarList({ rows, label, max, empty = 'Нет данных' }: { rows: BarRow[]; label: string; max?: number; empty?: string }) {
  const top = max ?? Math.max(0, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="muted" style={{ fontSize: 13 }}>{empty}</p>;
  return (
    <ul className="hbars" aria-label={label}>
      {rows.map((r) => {
        const pct = top > 0 ? Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100) : 0;
        const inner = (
          <>
            <span className="hb-label">
              {r.label}
              {r.sub && <small>{r.sub}</small>}
            </span>
            <span className="hb-value num">{r.display ?? r.value}</span>
            <span className="hb-track" aria-hidden="true">
              <i className={r.tone ? `t-${r.tone}` : undefined} style={{ width: `${pct}%` }} />
            </span>
          </>
        );
        return (
          <li key={r.key}>
            {r.to ? (
              <Link to={r.to} className="hb-row">
                {inner}
              </Link>
            ) : (
              <div className="hb-row">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Daily columns for small counts (two series side by side). Columns are used instead of a
 * smoothed line: values are small integers, so a curve would invent in-between values.
 */
export function DailyColumns({
  days,
  series,
  label,
  height = 96,
}: {
  days: string[];
  series: { name: string; color: string; values: number[] }[];
  label: string;
  height?: number;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
  return (
    <figure className="dcols" aria-label={label}>
      <div className="dcols-plot" style={{ height }}>
        <span className="dcols-max num" aria-hidden="true">{max}</span>
        {days.map((d, i) => (
          <div key={d} className="dcols-day" title={`${fmt(d)}: ${series.map((s) => `${s.name} ${s.values[i] ?? 0}`).join(', ')}`}>
            {series.map((s) => (
              <i key={s.name} style={{ height: `${((s.values[i] ?? 0) / max) * 100}%`, background: s.color }} />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="dcols-axis">
        <span>{days[0] ? fmt(days[0]) : ''}</span>
        <span className="legend" style={{ marginTop: 0 }}>
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name} <b className="num">{s.values.reduce((a, b) => a + b, 0)}</b>
            </span>
          ))}
        </span>
        <span>{days.at(-1) ? fmt(days.at(-1)!) : ''}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {days.map((d, i) => (
            <tr key={d}>
              <th scope="row">{d}</th>
              {series.map((s) => (
                <td key={s.name}>{s.values[i] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Segmented share bar: composition of a whole with few parts (instead of a donut). */
export function ShareBar({ parts, label }: { parts: { key: string; label: string; value: number; color: string; display?: string }[]; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="share" aria-label={label} role="img">
      <div className="share-track">
        {total === 0 ? <i style={{ flex: 1, background: 'var(--surface-3)' }} /> : parts.filter((p) => p.value > 0).map((p) => <i key={p.key} style={{ flex: p.value, background: p.color }} />)}
      </div>
      <div className="legend">
        {parts.map((p) => (
          <span key={p.key}>
            <i style={{ background: p.color }} />
            {p.label} <b className="num">{p.display ?? p.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Visible single-choice control for 2–5 options (replaces dropdowns for small sets). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly (readonly [T, ReactNode])[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([k, text]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

/** Client-side sort for small, fully loaded lists. `get` returns a comparable value per column. */
export function useSort<T, K extends string>(rows: T[], initial: SortState<K>, get: (row: T, key: K) => string | number | null) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const va = get(a, sort.key);
      const vb = get(b, sort.key);
      if (va === vb) return 0;
      if (va === null) return 1; // missing values always last
      if (vb === null) return -1;
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ru');
      return sort.dir === 'asc' ? c : -c;
    });
    return out;
  }, [rows, sort, get]);
  const toggle = (key: K) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  return { sorted, sort, toggle };
}

export function SortTh<K extends string>({
  k,
  sort,
  onSort,
  children,
  align,
}: {
  k: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  children: ReactNode;
  align?: 'r';
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={align} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} scope="col">
      <button type="button" className="sort-btn" onClick={() => onSort(k)}>
        {children}
        <Icon size={12} aria-hidden="true" style={{ opacity: active ? 1 : 0.4 }} />
      </button>
    </th>
  );
}

/** Attention row: problem → context → action, the action on the row itself. */
export function AttentionItem({ tone, title, meta, to, action }: { tone: 'problem' | 'warn' | 'info'; title: ReactNode; meta?: ReactNode; to: string; action: string }) {
  return (
    <li>
      <Link to={to} className={`attn attn-${tone}`}>
        <span className="attn-title">{title}</span>
        {meta && <span className="attn-meta">{meta}</span>}
        <span className="attn-action">
          {action}
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}
