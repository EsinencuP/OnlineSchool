import assert from 'node:assert/strict';
import test from 'node:test';
import { wcagContrast } from 'culori';
import { readFileSync } from 'node:fs';
import { measured, resolveTokens, contrast, composite, tokenCss } from './contrast-contract.mjs';
const tokens = resolveTokens();
const minPairs = [
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
];
for (const [fg, bg, min] of minPairs)
  test(`contrast ${fg}/${bg} >= ${min}`, () => {
    assert.ok(contrast(tokens[fg], tokens[bg]) >= min);
  });
for (const [fg, bg, expected] of measured)
  test(`CSS + independent culori ${fg}/${bg} = ${expected}`, () => {
    const actual = contrast(tokens[fg], tokens[bg]);
    assert.equal(actual.toFixed(2), expected.toFixed(2));
    assert.ok(Math.abs(actual - wcagContrast(tokens[fg], tokens[bg])) < 1e-10);
  });
test('accent text/button white and sand graphics are known failures, including 2.78', () => {
  assert.ok(contrast(tokens['--k8k-accent'], tokens['--surface']) < 4.5);
  assert.ok(contrast(tokens['--surface'], tokens['--k8k-accent']) < 4.5);
  const sand = contrast(tokens['--k8k-accent'], tokens['--k8k-sand']);
  assert.equal(sand.toFixed(2), '2.78');
  assert.ok(sand < 3);
});
test('mutating brand-text to accent fails normal-text contract on every supported surface', () => {
  const bad = resolveTokens(
    tokenCss.replace(/--brand-text:\s*[^;]+;/, '--brand-text: var(--k8k-accent);'),
  );
  for (const bg of ['--surface', '--bg-page', '--k8k-sand', '--surface-warm']) {
    assert.ok(contrast(tokens['--brand-text'], tokens[bg]) >= 4.5);
    assert.ok(contrast(bad['--brand-text'], bad[bg]) < 4.5);
  }
});
for (const bg of [
  '--surface',
  '--bg-page',
  '--k8k-sand',
  '--surface-warm',
  '--danger-bg',
  '--warning-bg',
])
  test(`link and hover/focus on ${bg}`, () => {
    assert.ok(contrast(tokens['--brand-text'], tokens[bg]) >= 4.5);
    assert.ok(contrast(tokens['--k8k-action-hover'], tokens[bg]) >= 4.5);
    assert.ok(contrast(tokens['--focus'], tokens[bg]) >= 3);
  });
test('hover, disabled without alpha fade, field error and two-layer sidebar focus', () => {
  for (const bg of ['--k8k-action-hover', '--k8k-danger-hover'])
    assert.ok(contrast(tokens['--surface'], tokens[bg]) >= 4.5);
  assert.ok(contrast(tokens['--k8k-disabled-text'], tokens['--k8k-disabled-bg']) >= 4.5);
  assert.ok(contrast(tokens['--k8k-disabled-border'], tokens['--k8k-disabled-bg']) >= 3);
  assert.ok(contrast(tokens['--danger'], tokens['--surface']) >= 3);
  assert.ok(contrast(tokens['--surface'], tokens['--brand-900']) >= 3);
  assert.ok(contrast(tokens['--focus'], tokens['--surface']) >= 3);
});
test('alpha overlays are composited; shadows do not excuse illegible foreground', () => {
  for (const overlay of ['--k8k-nav-hover', '--k8k-nav-soft']) {
    const bg = composite(tokens[overlay], tokens['--brand-900']);
    assert.ok(contrast(tokens['--sidebar-text'], bg) >= 4.5);
    assert.ok(
      Math.abs(
        contrast(tokens['--sidebar-text'], bg) - wcagContrast(tokens['--sidebar-text'], bg),
      ) < 1e-10,
    );
  }
  assert.throws(() => contrast(tokens['--k8k-nav-hover'], tokens['--brand-900']), /Opaque/);
  assert.throws(() => composite(tokens['--k8k-nav-hover'], 'transparent'), /backdrop/);
});
test('aliases resolve with cycle/missing detection; controls consume size tokens', () => {
  assert.equal(tokens['--blue'], tokens['--brand-text']);
  assert.throws(() => resolveTokens('--a: var(--b); --b: var(--a);'), /cycle/);
  assert.throws(() => resolveTokens('--a: var(--missing);'), /missing/);
  assert.equal(tokens['--k8k-control-primary'], '48px');
  assert.equal(tokens['--k8k-control-touch'], '44px');
  assert.equal(tokens['--k8k-control-desktop'], '36px');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /min-(?:height|width):\s*(?:44|48)px/);
});
