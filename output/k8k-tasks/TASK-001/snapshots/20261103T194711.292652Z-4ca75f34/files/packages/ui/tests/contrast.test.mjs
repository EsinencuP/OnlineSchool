import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries(
  [...css.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/gi)].map((m) => [m[1], m[2]]),
);
function luminance(hex) {
  return [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
}
for (const [fg, bg, min] of [
  ['--k8k-ink', '--k8k-sand', 4.5],
  ['--k8k-ink', '--bg-page', 4.5],
  ['--surface', '--brand-700', 4.5],
  ['--surface', '--brand-hero', 4.5],
  ['--brand-text', '--surface', 4.5],
  ['--text-2', '--surface', 4.5],
  ['--text-muted', '--bg-page', 4.5],
  ['--border', '--bg-page', 3],
  ['--sidebar-text', '--brand-900', 4.5],
  ['--sidebar-muted', '--brand-900', 4.5],
  ['--success', '--success-bg', 4.5],
  ['--warning', '--warning-bg', 4.5],
  ['--danger', '--danger-bg', 4.5],
  ['--surface', '--danger', 4.5],
  ['--info', '--info-bg', 4.5],
  ['--focus', '--k8k-sand', 3],
  ['--focus', '--surface', 3],
])
  test(`contrast ${fg} / ${bg} >= ${min}`, () => {
    const values = [luminance(tokens[fg]), luminance(tokens[bg])].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= min);
  });

const measured = [
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
for (const [fg, bg, expected] of measured)
  test(`documented ${fg}/${bg} = ${expected}`, () => {
    const a = luminance(tokens[fg]),
      b = luminance(tokens[bg]);
    assert.equal(
      ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2),
      expected.toFixed(2),
    );
  });
test('accent is unsuitable for text or for graphics on sand', () => {
  const a = luminance(tokens['--k8k-accent']);
  assert.ok((luminance(tokens['--surface']) + 0.05) / (a + 0.05) < 4.5);
  assert.ok((luminance(tokens['--k8k-sand']) + 0.05) / (a + 0.05) < 3);
});
