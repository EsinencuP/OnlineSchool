import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { createHealthchecksReporter } from './healthchecks-reporter.mjs';

const probes = [
  ['api', '/api/health'],
  ['worker', '/api/health/worker'],
];

export function healthOrigin(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    )
      return url.origin;
  } catch {
    // Keep configuration details out of logs.
  }
  throw new Error('INVALID_HEALTH_ORIGIN');
}

async function smallJson(body) {
  if (!body) return null;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(content + decoder.decode());
      size += value.byteLength;
      if (size > 4096) return null;
      content += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

async function probe(fetcher, origin, service, path) {
  let response;
  try {
    response = await fetcher(`${origin}${path}`, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'manual',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const httpStatus = response.status;
    if (httpStatus !== 200 && httpStatus !== 503) {
      await response.body?.cancel();
      return { result: 'HTTP_ERROR', httpStatus };
    }
    const body = await smallJson(response.body);
    const cacheControl = response.headers.get('cache-control')?.toLowerCase().split(',');
    const expected = httpStatus === 200 ? 'ok' : 'unavailable';
    if (
      !cacheControl?.some((directive) => directive.trim() === 'no-store') ||
      body?.service !== service ||
      body?.status !== expected
    ) {
      return { result: 'INVALID_RESPONSE', httpStatus };
    }
    return { result: httpStatus === 200 ? 'OK' : 'UNAVAILABLE', httpStatus };
  } catch {
    return response
      ? { result: 'INVALID_RESPONSE', httpStatus: response.status }
      : { result: 'NO_RESPONSE', httpStatus: null };
  }
}

export async function checkRuntime(origin, { fetcher = fetch, wait = delay } = {}) {
  const target = healthOrigin(origin);
  async function sample() {
    const [api, worker] = await Promise.all(
      probes.map(([service, path]) => probe(fetcher, target, service, path)),
    );
    const state =
      api.result !== 'OK'
        ? 'API_UNAVAILABLE'
        : worker.result !== 'OK'
          ? 'WORKER_UNAVAILABLE'
          : 'HEALTHY';
    return { state, api, worker, checkedAt: new Date().toISOString() };
  }
  const first = await sample();
  if (first.state === 'HEALTHY') return { ...first, samples: 1 };
  await wait(5000);
  return { ...(await sample()), samples: 2 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const flags = process.argv.slice(2);
    const publish = flags.length === 1 && flags[0] === '--publish';
    if (flags.length && !publish) throw new Error('INVALID_ARGUMENTS');
    const report = publish ? createHealthchecksReporter(process.env) : null;
    const snapshot = await checkRuntime(process.env.OPS_RUNTIME_ORIGIN);
    if (report) {
      await report(snapshot.state);
      console.log(JSON.stringify({ event: 'runtime.health.forwarded' }));
    } else {
      console.log(JSON.stringify({ event: 'runtime.health.sample', ...snapshot }));
      if (snapshot.state !== 'HEALTHY') process.exitCode = 1;
    }
  } catch (error) {
    const code =
      error instanceof Error && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.message)
        ? error.message
        : 'RUNTIME_MONITOR_FAILED';
    console.error(JSON.stringify({ event: 'runtime.health.error', code }));
    process.exitCode = 2;
  }
}
