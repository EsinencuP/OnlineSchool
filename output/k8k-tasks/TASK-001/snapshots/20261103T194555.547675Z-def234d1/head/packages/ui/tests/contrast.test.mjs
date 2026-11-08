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
