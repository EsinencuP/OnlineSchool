import { readFileSync } from 'node:fs';
export const tokenCss = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
export function resolveTokens(css = tokenCss) {
  const raw = Object.fromEntries(
    [...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
  function resolve(key, seen = new Set()) {
    if (seen.has(key)) throw new Error(`Token cycle: ${key}`);
    if (!raw[key]) throw new Error(`Token missing: ${key}`);
    const alias = /^var\((--[\w-]+)\)$/.exec(raw[key]);
    return alias ? resolve(alias[1], new Set([...seen, key])) : raw[key];
  }
  return Object.fromEntries(Object.keys(raw).map((key) => [key, resolve(key)]));
}
export function luminance(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Opaque sRGB required: ${hex}`);
  return [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(fg, bg) {
  const a = luminance(fg),
    b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
// Source-over in encoded sRGB; translucent colors require an explicit opaque backdrop.
export function composite(fg, bg) {
  if (!/^#[\da-f]{8}$/i.test(fg) || !/^#[\da-f]{6}$/i.test(bg))
    throw new Error('Explicit opaque backdrop required');
  const alpha = parseInt(fg.slice(7, 9), 16) / 255;
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(fg.slice(i, i + 2), 16) * alpha + parseInt(bg.slice(i, i + 2), 16) * (1 - alpha),
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export const measured = [
  ['--k8k-accent', '--surface', 3.59],
  ['--k8k-accent', '--bg-page', 3.36],
  ['--k8k-accent', '--k8k-sand', 2.78],
  ['--k8k-ink', '--k8k-sand', 12.32],
  ['--k8k-ink', '--bg-page', 14.89],
  ['--k8k-ink', '--surface', 15.91],
  ['--surface', '--brand-900', 12.62],
  ['--surface', '--brand-700', 5.46],
  ['--surface', '--brand-hero', 5.5],
  ['--brand-text', '--surface', 6.15],
  ['--brand-text', '--bg-page', 5.75],
  ['--brand-text', '--k8k-sand', 4.76],
  ['--k8k-ink', '--surface-warm', 13.36],
  ['--text-2', '--bg-page', 8.29],
  ['--text-muted', '--bg-page', 6.07],
  ['--border', '--bg-page', 3.25],
  ['--sidebar-text', '--brand-900', 9.91],
  ['--sidebar-muted', '--brand-900', 6.47],
  ['--success', '--success-bg', 5.7],
  ['--warning', '--warning-bg', 6.09],
  ['--danger', '--danger-bg', 5.72],
  ['--surface', '--danger', 6.54],
  ['--info', '--info-bg', 6.25],
  ['--focus', '--k8k-sand', 9.77],
  ['--focus', '--surface', 12.62],
];
