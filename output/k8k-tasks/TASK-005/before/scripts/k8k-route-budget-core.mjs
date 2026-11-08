// Pure route evaluator: missing inputs are explicit failures, never zero-byte passes.
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
export const LIMIT = 256000;
export const METHOD =
  'k8k-route-v1: unique cold-entry+explicit-route-lazy-seeds recursive static JS/CSS; gzip(level=9) per file; raw cyrillic+latin WOFF2 once each; limit=256000';
export function evaluateRoute({ manifest, seeds, assets, limit = LIMIT }) {
  try {
    if (!manifest || typeof manifest !== 'object') throw new Error('Manifest unavailable');
    if (!seeds?.length) throw new Error('Route seeds unavailable');
    const visited = new Set(),
      loaded = new Set(),
      deferred = new Set();
    function visit(key) {
      if (visited.has(key)) return;
      const item = manifest[key];
      if (!item?.file) throw new Error(`Manifest key unavailable: ${key}`);
      visited.add(key);
      loaded.add(item.file);
      for (const css of item.css ?? []) loaded.add(css);
      for (const child of item.imports ?? []) visit(child);
      for (const child of item.dynamicImports ?? []) deferred.add(child);
    }
    seeds.forEach(visit);
    const fontPaths = new Map();
    for (const file of loaded)
      if (file.endsWith('.css')) {
        const bytes = assets.get(file);
        if (!bytes) throw new Error(`CSS unavailable: ${file}`);
        for (const match of bytes.toString().matchAll(/url\((?:["']?)([^)'"\s]+)(?:["']?)\)/g)) {
          const url = match[1];
          if (url.startsWith('data:')) continue;
          if (/^https?:/.test(url)) throw new Error('External CSS asset is not a local budget');
          if (!url.endsWith('.woff2')) continue;
          const name = url.split('/').at(-1);
          const target = [...assets.keys()].find((p) => p.split('/').at(-1) === name);
          if (!target) throw new Error(`Referenced font unavailable: ${name}`);
          const subset = /golos-text-(cyrillic|latin)-wght-normal/.exec(name)?.[1];
          if (!subset) throw new Error(`Unclassified WOFF2 subset: ${name}`);
          if (fontPaths.has(subset) && fontPaths.get(subset) !== target)
            throw new Error(`Multiple ${subset} fonts require review`);
          fontPaths.set(subset, target);
        }
      }
    for (const subset of ['cyrillic', 'latin'])
      if (!fontPaths.has(subset)) throw new Error(`Required ${subset} font unavailable`);
    const files = [...loaded].sort().map((file) => {
      const bytes = assets.get(file);
      if (!bytes) throw new Error(`Asset unavailable: ${file}`);
      if (!/\.(js|css)$/.test(file)) throw new Error(`Unclassified route asset: ${file}`);
      return {
        file,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        raw: bytes.length,
        gzip: gzipSync(bytes, { level: 9 }).length,
        kind: file.endsWith('.css') ? 'css' : 'js',
      };
    });
    const font = Object.fromEntries(
      [...fontPaths].map(([subset, file]) => [
        subset,
        {
          file,
          bytes: assets.get(file).length,
          sha256: createHash('sha256').update(assets.get(file)).digest('hex'),
        },
      ]),
    );
    font.total = font.cyrillic.bytes + font.latin.bytes;
    const gzip = files.reduce((sum, file) => sum + file.gzip, 0),
      total = gzip + font.total;
    return {
      status: 'available',
      files,
      manifestKeys: [...visited].sort(),
      deferredDynamicImports: [...deferred].filter((key) => !visited.has(key)).sort(),
      method: METHOD,
      gzip,
      font,
      total,
      limit,
      pass: total <= limit,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error.message,
      files: null,
      method: METHOD,
      gzip: null,
      font: null,
      total: null,
      limit,
      pass: false,
    };
  }
}
