/** Small hand-drawn SVG charts; data is always also exposed as text for screen readers. */

export function Sparkline({
  series,
  height = 110,
  colors,
  label,
}: {
  series: number[][];
  height?: number;
  colors: string[];
  label: string;
}) {
  const w = 320;
  const max = Math.max(1, ...series.flat());
  const pts = (s: number[]) =>
    s.map((v, i) => [(i / Math.max(1, s.length - 1)) * w, height - 8 - (v / max) * (height - 24)] as const);
  const path = (s: number[]) => {
    const p = pts(s);
    return p
      .map(([x, y], i) => {
        if (i === 0) return `M${x},${y}`;
        const [px, py] = p[i - 1]!;
        const cx = (px + x) / 2;
        return `C${cx},${py} ${cx},${y} ${x},${y}`;
      })
      .join(' ');
  };
  const last = series[0] ? pts(series[0]).at(-1) : undefined;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img" aria-label={label} preserveAspectRatio="none">
      {series.map((s, i) => (
        <path key={i} d={path(s)} fill="none" stroke={colors[i]} strokeWidth={i === 0 ? 2.5 : 2} strokeLinecap="round" strokeDasharray={i === 0 ? undefined : '4 5'} vectorEffect="non-scaling-stroke" />
      ))}
      {last && (
        <>
          <line x1={last[0]} x2={last[0]} y1={last[1]} y2={height} stroke={colors[0]} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <circle cx={last[0] - 3} cy={last[1]} r="5" fill={colors[0]} />
        </>
      )}
    </svg>
  );
}

export function Bars({
  values,
  highlight,
  color = 'var(--ink)',
  height = 96,
  label,
}: {
  values: number[];
  highlight?: number;
  color?: string;
  height?: number;
  label: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div role="img" aria-label={label} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(6, (v / max) * 100)}%`,
            borderRadius: 99,
            background: i === highlight ? color : 'transparent',
            border: i === highlight ? 0 : `2px dashed ${color}`,
            opacity: i === highlight ? 1 : 0.45,
          }}
        />
      ))}
    </div>
  );
}

export function Ring({ value, max, size = 120, color, label, children }: {
  value: number;
  max: number;
  size?: number;
  color: string;
  label: string;
  children?: React.ReactNode;
}) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(13 26 56 / 10%)" strokeWidth="12" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}
