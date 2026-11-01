import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
const dir = path.resolve('apps/manager-web/dist');
const manifest = JSON.parse(await readFile(path.join(dir, '.vite/manifest.json'), 'utf8'));
const entry = Object.keys(manifest).find((key) => manifest[key].isEntry);
async function measure(route) {
  const seen = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    seen.add(key);
    for (const dep of manifest[key]?.imports ?? []) visit(dep);
  }
  visit(entry);
  if (route) visit(route);
  const files = [...seen].map((key) => manifest[key]?.file).filter((file) => file?.endsWith('.js'));
  let bytes = 0;
  for (const file of files) bytes += gzipSync(await readFile(path.join(dir, file))).length;
  return { gzipBytes: bytes, budgetBytes: 250 * 1024, passed: bytes <= 250 * 1024, files };
}
const routes = Object.keys(manifest).filter((key) =>
  /pages\/(?:Dashboard|Login|Students)\.tsx$/.test(key),
);
const report = {
  measuredAt: new Date().toISOString(),
  mode: 'production',
  entry: await measure(),
  routes: Object.fromEntries(
    await Promise.all(routes.map(async (route) => [route, await measure(route)])),
  ),
};
await mkdir('output/mgr10', { recursive: true });
await writeFile('output/mgr10/bundle.json', JSON.stringify(report, null, 2) + '\n');
for (const [name, result] of Object.entries({ entry: report.entry, ...report.routes }))
  console.log(
    `${name}: ${(result.gzipBytes / 1024).toFixed(2)} KiB gzip; ${result.passed ? 'PASS' : 'FAIL'} (250 KiB)`,
  );
if ([report.entry, ...Object.values(report.routes)].some((result) => !result.passed))
  process.exitCode = 1;
const index = await readFile(path.join(dir, 'index.html'), 'utf8');
if (/<script(?![^>]*\bsrc=)[^>]*>\s*\S/.test(index)) throw new Error('Inline script found');
if (
  Object.values(manifest).some(
    (chunk) => chunk.file.includes('mockServiceWorker') || /src\/test\//.test(chunk.src ?? ''),
  )
)
  throw new Error('Mock code included in production manifest');
