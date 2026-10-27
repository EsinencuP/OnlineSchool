// Local browser smoke only. No database credentials and no privileged test routes.
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Passwords } from '../../apps/api/dist/modules/identity/passwords.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const privateFile = new URL('../../.codex/private/task15-accounts.json', import.meta.url);
if (process.argv.includes('--prepare')) {
  const accounts = [];
  for (const label of ['enroll', 'limited']) {
    const password = randomBytes(24).toString('base64url');
    const hash = await new Passwords().hash(password);
    if (!hash.ok) throw new Error('Password hash unavailable');
    accounts.push({
      label,
      id: randomUUID(),
      staffId: randomUUID(),
      email: `task15-${label}-${randomUUID()}@online-school.invalid`,
      password,
      hash: hash.value,
    });
  }
  await mkdir(new URL('./', privateFile), { recursive: true });
  await writeFile(privateFile, JSON.stringify(accounts), { mode: 0o600, flag: 'wx' });
  // Hashes go only to the connector provisioning call; plaintext stays local and is never logged.
  console.log(
    JSON.stringify(
      accounts.map((a) => ({
        label: a.label,
        id: a.id,
        staffId: a.staffId,
        email: a.email,
        hash: a.hash,
      })),
    ),
  );
} else if (process.argv.includes('--forget')) {
  await unlink(privateFile);
} else {
  const accounts = JSON.parse(await readFile(privateFile, 'utf8'));
  const credentials = Object.fromEntries(
    accounts.map((a) => [a.label, { email: a.email, password: a.password }]),
  );
  const child = spawn(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.config.mjs'],
    {
      cwd: root,
      env: { ...process.env, FND_E2E_CREDENTIALS: JSON.stringify(credentials) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const safe = (data) => {
    let text = String(data);
    for (const account of accounts)
      for (const value of [account.password, account.hash])
        text = text.replaceAll(value, '[redacted]');
    return text;
  };
  child.stdout.on('data', (data) => process.stdout.write(safe(data)));
  child.stderr.on('data', (data) => process.stderr.write(safe(data)));
  child.once('error', () => {
    console.error('Browser process could not start');
    process.exitCode = 1;
  });
  child.once('exit', (code) => {
    process.exitCode = code ?? 1;
  });
}
