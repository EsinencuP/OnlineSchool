import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  /** One value per label; null = no data (drawn as a gap, shown as "—"). */
  values: (number | null)[];
  type: 'bar' | 'line' | 'area';
  format?: (v: number) => string;
}

const PAD = { l: 40, r: 10, t: 12, b: 26 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const compact = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : String(Math.round(v * 10) / 10));

/**
 * Interactive SVG chart (no library): bars and/or lines over shared categories.
 * Hover or arrow keys move a crosshair; the tooltip shows every series for that point.
 * Bars and the y axis start at zero; missing values are gaps, never zeros.
 */
export function Chart({
  labels,
  series,
  label,
  height = 210,
  tipTitle,
  extra,
}: {
  labels: string[];
  series: ChartSeries[];
  label: string;
  height?: number;
  /** Tooltip heading for a point (defaults to the label). */
  tipTitle?: (i: number) => string;
  /** Extra tooltip line, e.g. a derived rate for that point. */
  extra?: (i: number) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  // Measure synchronously before paint (no flash of a 600 px chart), then follow resizes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const n = labels.length;
  const innerW = width - PAD.l - PAD.r;
  const innerH = height - PAD.t - PAD.b;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null))));
  const band = innerW / Math.max(1, n);
  const x = (i: number) => PAD.l + band * i + band / 2;
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;
  const bars = series.filter((s) => s.type === 'bar');
  const groupW = Math.min(band * 0.72, 46);
  const barW = groupW / Math.max(1, bars.length);
  // As many x labels as fit (~64 px each); the last point is always labelled.
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))));
  const fmt = (s: ChartSeries, v: number | null) => (v === null ? '—' : s.format ? s.format(v) : String(v));

  const pick = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const i = Math.floor((clientX - r.left - PAD.l) / band);
    setHover(i >= 0 && i < n ? i : null);
  };

  const linePath = (s: ChartSeries) => {
    let d = '';
    let open = false;
    s.values.forEach((v, i) => {
      if (v === null) {
        open = false;
        return;
      }
      d += `${open ? 'L' : 'M'}${x(i)},${y(v)}`;
      open = true;
    });
    return d;
  };

  const tipLeft = hover === null ? 0 : x(hover) > width - 190 ? x(hover) - 178 : x(hover) + 12;

  return (
    <figure
      ref={ref}
      className="ichart"
      tabIndex={0}
      aria-label={`${label}. Стрелки влево и вправо показывают значения по точкам.`}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerLeave={() => setHover(null)}
      onBlur={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
        else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
        else if (e.key === 'Escape') setHover(null);
        else return;
        e.preventDefault();
      }}
    >
      <svg width={width} height={height} role="img" aria-hidden="true">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="rgb(13 26 56 / 10%)" strokeDasharray={f === 0 ? undefined : '3 4'} />
            <text className="axis" x={PAD.l - 8} y={y(max * f) + 4} textAnchor="end">
              {compact(max * f)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          (i % every === 0 && n - 1 - i >= every / 2) || i === n - 1 ? (
            <text key={i} className="axis" x={x(i)} y={height - 6} textAnchor="middle">
              {l}
            </text>
          ) : null,
        )}
        {hover !== null && <rect x={PAD.l + band * hover} y={PAD.t} width={band} height={innerH} fill="rgb(13 26 56 / 5%)" rx={6} />}
        {bars.map((s, k) =>
          s.values.map((v, i) =>
            v === null || v <= 0 ? null : (
              <rect key={`${s.key}${i}`} x={x(i) - groupW / 2 + k * barW + 1} y={y(v)} width={Math.max(2, barW - 2)} height={y(0) - y(v)} rx={Math.min(6, barW / 3)} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55} />
            ),
          ),
        )}
        {series
          .filter((s) => s.type === 'area')
          .map((s) => (
            <path key={`a${s.key}`} d={`${linePath(s)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={s.color} opacity={0.16} />
          ))}
        {series
          .filter((s) => s.type !== 'bar')
          .map((s) => (
            <path key={`l${s.key}`} d={linePath(s)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          ))}
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + innerH} stroke="var(--ink)" strokeDasharray="3 3" opacity={0.5} />
            {series
              .filter((s) => s.type !== 'bar' && s.values[hover] !== null)
              .map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover]!)} r={5} fill="#fff" stroke={s.color} strokeWidth={3} />
              ))}
          </>
        )}
      </svg>
      {hover !== null && (
        <div className="ichart-tip" style={{ left: tipLeft, top: PAD.t }} role="status">
          <b>{tipTitle ? tipTitle(hover) : labels[hover]}</b>
          {series.map((s) => (
            <div key={s.key} className="row">
              <span>
                <i style={{ background: s.color }} />
                {s.name}
              </span>
              <strong>{fmt(s, s.values[hover] ?? null)}</strong>
            </div>
          ))}
          {extra && <div className="extra">{extra(hover)}</div>}
        </div>
      )}
      <figcaption className="ichart-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </figcaption>
      <div className="sr-only">
        <table>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Точка</th>
            {series.map((s) => (
              <th key={s.key} scope="col">{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={i}>
              <th scope="row">{tipTitle ? tipTitle(i) : l}</th>
              {series.map((s) => (
                <td key={s.key}>{fmt(s, s.values[i] ?? null)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
