import { useEffect, useId, useRef, useState } from 'react';
import { t } from './actionCopy.js';

// Lightweight SVG charts in the cabinet palette. Colors were checked with the dataviz
// validator (light surface): violet #6642cc, green #1f9d74, orange #c2571d.
export const chartColors = { violet: '#6642cc', green: '#1f9d74', orange: '#c2571d' } as const;

export type Series = { key: string; label: string; color: string; values: number[] };

function useWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(260, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const quarter = value / 4;
  const power = 10 ** Math.floor(Math.log10(quarter));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * power >= quarter)! * power;
  return step * 4;
}
const compact = (value: number) =>
  new Intl.NumberFormat(t('ru', 'ro'), { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );

// Rounded data end, square at the baseline.
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function GroupedBars({
  title,
  categories,
  series,
  format,
  height = 230,
}: {
  title: string;
  categories: string[];
  series: Series[];
  format: (value: number) => string;
  height?: number;
}) {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const titleId = useId();
  const margin = { top: 12, right: 8, bottom: 30, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const groupW = plotW / Math.max(categories.length, 1);
  const gap = 2;
  const barW = Math.max(
    4,
    Math.min(30, (groupW * 0.72 - gap * (series.length - 1)) / Math.max(series.length, 1)),
  );
  const clusterW = barW * series.length + gap * (series.length - 1);
  const y = (value: number) => margin.top + plotH - (value / max) * plotH;
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  return (
    <figure className="cab-chart" aria-labelledby={titleId}>
      <figcaption className="cab-chart-head">
        <strong id={titleId}>{title}</strong>
        <div className="cab-chart-tools">
          {series.length > 1 && (
            <ul className="cab-chart-legend">
              {series.map((s) => (
                <li key={s.key}>
                  <span style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="cab-chart-toggle"
            aria-pressed={table}
            onClick={() => setTable((value) => !value)}
          >
            {table ? t('График', 'Grafic') : t('Таблица', 'Tabel')}
          </button>
        </div>
      </figcaption>
      {table ? (
        <div className="cab-chart-table">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('Период', 'Perioadă')}</th>
                {series.map((s) => (
                  <th scope="col" key={s.key}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((category, index) => (
                <tr key={category}>
                  <th scope="row">{category}</th>
                  {series.map((s) => (
                    <td key={s.key}>{format(s.values[index] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cab-chart-plot" ref={ref}>
          <svg width={width} height={height} role="img" aria-labelledby={titleId}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  className={tick === 0 ? 'cab-chart-base' : 'cab-chart-grid'}
                />
                <text x={margin.left - 8} y={y(tick)} className="cab-chart-axis" textAnchor="end" dy="0.32em">
                  {compact(tick)}
                </text>
              </g>
            ))}
            {categories.map((category, index) => {
              const x0 = margin.left + groupW * index + (groupW - clusterW) / 2;
              return (
                <g key={category}>
                  {series.map((s, si) => {
                    const value = s.values[index] ?? 0;
                    const top = y(value);
                    return (
                      <path
                        key={s.key}
                        d={barPath(x0 + si * (barW + gap), top, barW, margin.top + plotH - top)}
                        fill={s.color}
                        opacity={active === null || active === index ? 1 : 0.45}
                      />
                    );
                  })}
                  <text
                    x={margin.left + groupW * index + groupW / 2}
                    y={height - 9}
                    textAnchor="middle"
                    className="cab-chart-axis"
                  >
                    {category}
                  </text>
                  <rect
                    x={margin.left + groupW * index}
                    y={margin.top}
                    width={groupW}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${category}: ${series.map((s) => `${s.label} ${format(s.values[index] ?? 0)}`).join(', ')}`}
                    onMouseEnter={() => setActive(index)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  />
                </g>
              );
            })}
          </svg>
          {active !== null && (
            <div
              className="cab-chart-tip"
              style={{
                left: Math.min(
                  Math.max(margin.left + groupW * active + groupW / 2, 90),
                  width - 90,
                ),
              }}
              role="status"
            >
              <strong>{categories[active]}</strong>
              {series.map((s) => (
                <span key={s.key}>
                  <i style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                  <b>{format(s.values[active] ?? 0)}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

export function HorizontalBars({
  title,
  items,
  color = chartColors.violet,
  format = (value: number) => String(value),
}: {
  title: string;
  items: { label: string; value: number }[];
  color?: string;
  format?: (value: number) => string;
}) {
  const titleId = useId();
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <figure className="cab-chart" aria-labelledby={titleId}>
      <figcaption className="cab-chart-head">
        <strong id={titleId}>{title}</strong>
      </figcaption>
      <ul className="cab-hbars">
        {items.map((item) => (
          <li key={item.label}>
            <span className="cab-hbars-label">{item.label}</span>
            <span className="cab-hbars-track">
              <span
                style={{ width: `${(item.value / max) * 100}%`, background: color }}
                aria-hidden="true"
              />
            </span>
            <b>{format(item.value)}</b>
          </li>
        ))}
      </ul>
    </figure>
  );
}
