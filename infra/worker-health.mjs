import { createPoolClient } from '../packages/db/dist/index.js';

const result = createPoolClient();
if (!result.ok) process.exitCode = 1;
else {
  try {
    const rows = await result.value.$queryRaw`SELECT EXISTS(SELECT 1 FROM runtime_heartbeats
      WHERE component='worker' AND stopped_at IS NULL
      AND last_seen_at>clock_timestamp()-interval '30 seconds') AS live`;
    if (!rows[0]?.live) process.exitCode = 1;
  } catch {
    process.exitCode = 1;
  } finally {
    await result.value.$disconnect();
  }
}
