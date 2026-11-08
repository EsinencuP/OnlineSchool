import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
const budget = 250 * 1024;
const results = [];
for (const app of ['student-cabinet', 'manager-web', 'platform']) {
  const root = resolve('apps', app, 'dist');
  const files = await readdir(resolve(root, 'assets'));
  const fonts = files.filter((file) => file.endsWith('.woff2'));
  const fontBytes = (
    await Promise.all(fonts.map((f) => readFile(resolve(root, 'assets', f))))
  ).reduce((n, b) => n + b.byteLength, 0);
  const sizes = new Map();
  for (const file of files)
    if (/\.(js|css)$/.test(file))
      sizes.set(
        `assets/${file}`,
        gzipSync(await readFile(resolve(root, 'assets', file))).byteLength,
      );
  if (app === 'manager-web') {
    const manifest = JSON.parse(await readFile(resolve(root, '.vite/manifest.json'), 'utf8'));
    const entry = Object.keys(manifest).find((key) => manifest[key].isEntry);
    for (const key of Object.keys(manifest).filter(
      (k) => k === entry || manifest[k].src?.startsWith('src/pages/'),
    )) {
      const loaded = new Set();
      function collect(k) {
        if (loaded.has(manifest[k].file)) return;
        loaded.add(manifest[k].file);
        for (const file of manifest[k].css ?? []) loaded.add(file);
        for (const child of manifest[k].imports ?? []) collect(child);
      }
      collect(entry);
      collect(key);
      const codeBytes = [...loaded].reduce((n, f) => n + (sizes.get(f) ?? 0), 0);
      results.push({
        app,
        route: key,
        codeGzipBytes: codeBytes,
        fontBytes,
        totalBytes: codeBytes + fontBytes,
      });
    }
  } else {
    const codeBytes = [...sizes.values()].reduce((a, b) => a + b, 0);
    results.push({
      app,
      route: 'all',
      codeGzipBytes: codeBytes,
      fontBytes,
      totalBytes: codeBytes + fontBytes,
    });
  }
}
await mkdir('output/k8k-redesign', { recursive: true });
await writeFile(
  'output/k8k-redesign/bundle.json',
  JSON.stringify(
    {
      budget,
      method:
        'JS+CSS gzip, both WOFF2 subsets at full byte size, recursive static imports plus app entry, per lazy page.',
      results,
    },
    null,
    2,
  ),
);
for (const result of results)
  assert.ok(
    result.totalBytes <= budget,
    `${result.app}/${result.route}: ${result.totalBytes} > ${budget}`,
  );
console.log(
  `K8K: ${results.length} route bundles fit 250 KiB including CSS and local fonts. Largest: ${Math.max(...results.map((r) => r.totalBytes))} bytes.`,
);
