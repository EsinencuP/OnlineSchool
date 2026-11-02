import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
const root = resolve(import.meta.dirname, '..');
const baseline = JSON.parse(
  await readFile(resolve(root, 'output/k8k-phase0/bundle-baseline.json'), 'utf8'),
);
const rows = [];
for (const app of ['student-cabinet', 'manager-web', 'platform']) {
  const dir = resolve(root, 'apps', app, 'dist');
  const assets = await readdir(resolve(dir, 'assets'));
  const sizes = new Map(
    await Promise.all(
      assets
        .filter((f) => /\.(css|js)$/.test(f))
        .map(async (f) => [
          `assets/${f}`,
          gzipSync(await readFile(resolve(dir, 'assets', f))).byteLength,
        ]),
    ),
  );
  const fonts = assets.filter((f) => f.endsWith('.woff2'));
  const fontBytes = (
    await Promise.all(fonts.map((f) => readFile(resolve(dir, 'assets', f))))
  ).reduce((sum, b) => sum + b.length, 0);
  const manifest =
    app === 'manager-web'
      ? JSON.parse(await readFile(resolve(dir, '.vite/manifest.json'), 'utf8'))
      : null;
  const entry = manifest ? Object.keys(manifest).find((k) => manifest[k].isEntry) : 'index.html';
  const routes = manifest
    ? Object.keys(manifest).filter((k) => k === entry || manifest[k].src?.startsWith('src/pages/'))
    : [entry];
  for (const route of routes) {
    const loaded = new Set();
    function collect(k) {
      const item = manifest[k];
      if (loaded.has(item.file)) return;
      loaded.add(item.file);
      for (const css of item.css ?? []) loaded.add(css);
      for (const child of item.imports ?? []) collect(child);
    }
    if (manifest) {
      collect(entry);
      collect(route);
    } else for (const key of sizes.keys()) loaded.add(key);
    const codeGzipBytes = [...loaded].reduce((sum, f) => sum + sizes.get(f), 0);
    const old = baseline.rows.find((r) => r.app === app && r.route === route);
    assert.ok(old, `Missing phase 0 baseline for ${app}/${route}`);
    rows.push({
      app,
      route,
      codeGzipBytes,
      fontBytes,
      totalBytes: codeGzipBytes + fontBytes,
      baselineCodeGzipBytes: old.bytes,
      codeDeltaBytes: codeGzipBytes - old.bytes,
      totalDeltaBytes: codeGzipBytes + fontBytes - old.bytes,
      files: [...loaded],
    });
  }
}
await mkdir(resolve(root, 'output/k8k-phase2'), { recursive: true });
await writeFile(
  resolve(root, 'output/k8k-phase2/bundle.json'),
  JSON.stringify(
    {
      budget: 250 * 1024,
      baseline: baseline.source,
      method:
        'Per-route recursive static JS/CSS gzip plus both local WOFF2 at full byte size. Unified legacy/opt-in build; fonts load only when used. Phase 0 isolated account-ui source vs current emitted package can alter chunk boundaries.',
      rows,
    },
    null,
    2,
  ),
);
for (const row of rows)
  assert.ok(
    row.totalBytes <= 250 * 1024,
    `${row.app}/${row.route}: ${row.totalBytes} exceeds 250 KiB`,
  );
console.log(
  `${rows.length} routes within 250 KiB including both fonts; max ${Math.max(...rows.map((r) => r.totalBytes))} bytes`,
);
