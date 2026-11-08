import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Avatar, Icon, IconButton } from '../dist/index.js';
import { evaluateRoute, FONT_METHOD_V2 } from '../../../scripts/k8k-route-budget-core.mjs';
const req = createRequire(new URL('../package.json', import.meta.url));
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
test('all local faces match real exports/ranges; one family, swap, no CDN/subset CSS guess', () => {
  const unicode = JSON.parse(
    readFileSync(req.resolve('@fontsource-variable/golos-text/unicode.json'), 'utf8'),
  );
  const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((m) => m[1]);
  assert.equal(faces.length, 3);
  for (const face of faces) {
    assert.match(face, /font-display:\s*swap/);
    assert.match(face, /font-family:\s*'Golos Text Variable'/);
    assert.match(face, /font-weight:\s*400 900/);
    assert.doesNotMatch(face, /https?:/);
  }
  for (const subset of ['latin', 'cyrillic']) {
    assert.ok(
      readFileSync(
        req.resolve(`@fontsource-variable/golos-text/files/golos-text-${subset}-wght-normal.woff2`),
      ).length > 0,
    );
    const face = faces.find((f) => f.includes(`golos-text-${subset}-wght-normal`));
    assert.equal(/unicode-range:\s*([^;]+);/.exec(face)[1].replaceAll(/\s/g, ''), unicode[subset]);
  }
  const provenance = JSON.parse(
    readFileSync(new URL('../src/fonts/provenance.json', import.meta.url), 'utf8'),
  );
  assert.equal(
    provenance.bytes,
    readFileSync(new URL('../src/fonts/golos-text-romanian-wght-normal.woff2', import.meta.url))
      .length,
  );
  assert.equal(
    /unicode-range:\s*([^;]+);/
      .exec(faces.find((f) => f.includes('romanian')))[1]
      .replaceAll(/\s/g, ''),
    provenance.unicodeRange,
  );
});
test('decorative icons are hidden/nonfocusable, named control has exactly one label', () => {
  for (const label of ['Открыть расписание', 'Deschide orarul']) {
    const html = renderToStaticMarkup(h(IconButton, { label }, h(Icon, { name: 'calendar' })));
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /focusable="false"/);
    assert.equal((html.match(/aria-label=/g) ?? []).length, 1);
    assert.ok(html.includes(label));
    assert.doesNotMatch(html, /<title|role="img"/);
  }
});
test('icon library uses static named imports, fixed glyph catalog, no dynamic icon downloads', () => {
  const source = readFileSync(new URL('../src/icon.tsx', import.meta.url), 'utf8');
  assert.match(source, /import\s*\{[^}]+\}\s*from 'lucide-react'/s);
  assert.doesNotMatch(source, /import\s*\(|dynamicIcon|import\s+\*|icons\[/);
});
test('Avatar preserves grapheme initials and full long names without an image', () => {
  for (const [name, initials] of [
    ['A\u0306na Ștefănescu', 'A\u0306Ș'],
    ['李 小龍', '李小'],
    ['Анна ' + 'Длинноеимя'.repeat(30), 'АД'],
  ]) {
    const html = renderToStaticMarkup(h(Avatar, { name }));
    assert.ok(html.includes(`>${initials}</span>`));
    assert.ok(html.includes(`aria-label="${name}"`));
    assert.match(html, /role="img"/);
    assert.doesNotMatch(html, /<img/);
  }
});
test('all three fonts count once; Romanian missing/overbudget fail explicitly', () => {
  const assets = new Map([
    ['main.js', Buffer.from('export{}')],
    [
      'main.css',
      Buffer.from(
        '@font-face{src:url(golos-text-cyrillic-wght-normal.woff2)}@font-face{src:url(golos-text-latin-wght-normal.woff2)}@font-face{src:url(golos-text-romanian-wght-normal.woff2)}',
      ),
    ],
    ...['cyrillic', 'latin', 'romanian'].map((s, i) => [
      `golos-text-${s}-wght-normal.woff2`,
      Buffer.alloc([22032, 37916, 3544][i]),
    ]),
  ]);
  const manifest = {
    entry: { file: 'main.js', css: ['main.css'], imports: ['shared'] },
    shared: { file: 'main.js' },
  };
  const input = {
    assets,
    manifest,
    seeds: ['entry', 'shared'],
    requiredFonts: ['cyrillic', 'latin', 'romanian'],
  };
  const result = evaluateRoute(input);
  assert.equal(result.method, FONT_METHOD_V2);
  assert.equal(result.font.total, 63492);
  assert.equal(result.files.length, 2);
  assert.equal(result.pass, true);
  assert.equal(evaluateRoute({ ...input, limit: 100 }).pass, false);
  const missing = new Map(assets);
  missing.delete('golos-text-romanian-wght-normal.woff2');
  const failed = evaluateRoute({ ...input, assets: missing });
  assert.equal(failed.pass, false);
  assert.equal(failed.total, null);
});
