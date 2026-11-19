const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function createHealthchecksReporter(env, fetcher = fetch) {
  if (env.OPS_RUNTIME_MONITOR_ENABLED !== 'true') throw new Error('INCIDENT_DELIVERY_DISABLED');
  const configured = env.OPS_RUNTIME_PING_URL;
  let base;
  try {
    const url = new URL(configured);
    if (
      url.origin === 'https://hc-ping.com' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      uuid.test(url.pathname.slice(1))
    )
      base = url.href;
  } catch {
    // A ping URL is an authentication secret.
  }
  if (!base) throw new Error('INVALID_HEALTHCHECKS_PING_URL');

  return async function report(state) {
    if (!['HEALTHY', 'API_UNAVAILABLE', 'WORKER_UNAVAILABLE'].includes(state)) {
      throw new Error('INVALID_RUNTIME_HEALTH_STATE');
    }
    const endpoint = state === 'HEALTHY' ? base : `${base}/fail`;
    let response;
    try {
      response = await fetcher(endpoint, {
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: state,
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new Error('INCIDENT_DELIVERY_UNREACHABLE');
    }
    await response.body?.cancel().catch(() => undefined);
    if (!response.ok) throw new Error(`INCIDENT_DELIVERY_HTTP_${response.status}`);
  };
}
