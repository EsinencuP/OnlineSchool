import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
const reportPath = process.env.MGR09_LOAD_REPORT ?? 'tests/evidence/mgr09-load-report.json';
const report = {
  task: 'MGR-09',
  date: new Date().toISOString(),
  status: 'NOT_RUN',
  target: { portfolioSize: 500, p95Milliseconds: 300 },
  method:
    '10 warmup requests, 100 measured GET requests, concurrency4; includes HTTP/JSON latency; nearest-rank p95. No fixture writes.',
};
async function run() {
  const base = process.env.MGR09_LOAD_BASE_URL,
    cookie = process.env.MGR09_LOAD_COOKIE;
  if (!base || !cookie) {
    report.reason = 'WORKING_ORIGIN_AND_MANAGER_SESSION_REQUIRED';
    return;
  }
  let url;
  try {
    url = new URL(base);
  } catch {
    report.reason = 'INVALID_ORIGIN';
    return;
  }
  if (
    url.username ||
    url.password ||
    !['https:', 'http:'].includes(url.protocol) ||
    (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  ) {
    report.reason = 'INVALID_ORIGIN';
    return;
  }
  const get = async (path) => {
    const response = await fetch(new URL(path, url.origin), {
      headers: { Cookie: cookie, 'Cache-Control': 'no-cache' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status !== 200) throw Error('LOAD_REQUEST_REJECTED');
    return response.json();
  };
  let cursor = null,
    total = 0,
    pages = 0;
  do {
    const q = new URLSearchParams({ limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const page = await get('/api/v1/manager/students?' + q);
    if (
      !Array.isArray(page.items) ||
      !(page.nextCursor === null || typeof page.nextCursor === 'string')
    )
      throw Error('INVALID_PREFLIGHT_RESPONSE');
    total += page.items.length;
    cursor = page.nextCursor;
    pages++;
    if (pages > 6 || total > 500) break;
  } while (cursor);
  report.observedPortfolioSize = total;
  if (total !== 500 || cursor) {
    report.reason = 'EXACT_500_STUDENT_PORTFOLIO_REQUIRED';
    return;
  }
  for (let i = 0; i < 10; i++) await get('/api/v1/manager/dashboard');
  const durations = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next++ < 100) {
        const start = performance.now();
        await get('/api/v1/manager/dashboard');
        durations.push(performance.now() - start);
      }
    }),
  );
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
  report.status = p95 <= 300 ? 'PASS' : 'FAIL';
  report.samples = durations.length;
  report.concurrency = 4;
  report.p95Milliseconds = Number(p95.toFixed(3));
  report.maximumMilliseconds = Number(durations.at(-1).toFixed(3));
}
try {
  await run();
} catch {
  report.status = 'FAILED_TO_MEASURE';
  report.reason = 'LOAD_REQUEST_FAILED';
}
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report) + '\n');
if (report.status !== 'PASS') process.exitCode = 2;
