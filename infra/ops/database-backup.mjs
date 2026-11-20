import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const format = Buffer.from('OSPG1');
const headerSize = format.length + 12;
const tagSize = 16;
const key = Buffer.from(process.env.ONLINESCHOOL_BACKUP_KEY ?? '', 'base64');
const bin = process.env.ONLINESCHOOL_PG_BIN;
delete process.env.ONLINESCHOOL_BACKUP_KEY;

function connection(value, restore) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_BACKUP_TARGET_INVALID');
  }
  const database = url.pathname.slice(1);
  const allowed = restore
    ? url.hostname === '127.0.0.1' && /^online_school_restore_[a-z0-9_]+$/.test(database)
    : /^ep-(?![^.]*-pooler\.)[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(url.hostname) &&
      database === 'online_school';
  if (!allowed || url.protocol !== 'postgresql:' || !url.username || !url.password || url.hash)
    throw new Error('DATABASE_BACKUP_TARGET_INVALID');
  const env = { ...process.env };
  for (const name of Object.keys(env))
    if (name.startsWith('PG') || /^ONLINESCHOOL_(?:BACKUP|RESTORE)_URL$/.test(name))
      delete env[name];
  Object.assign(env, {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: database,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: restore ? 'disable' : 'verify-full',
    PGCONNECT_TIMEOUT: '15',
    PGOPTIONS: restore ? '-c timezone=UTC' : '-c default_transaction_read_only=on -c timezone=UTC',
    ...(!restore ? { PGSSLROOTCERT: process.env.ONLINESCHOOL_PG_CA_FILE || 'system' } : {}),
  });
  return env;
}

function postgres(command, args, env, stdin) {
  const child = spawn(join(bin, command + (process.platform === 'win32' ? '.exe' : '')), args, {
    env,
    windowsHide: true,
    stdio: [stdin ? 'pipe' : 'ignore', stdin ? 'ignore' : 'pipe', 'ignore'],
  });
  const done = new Promise((resolve, reject) => {
    const error = new Error(`DATABASE_BACKUP_${command.toUpperCase()}_FAILED`);
    child.once('error', () => reject(error));
    child.once('close', (code) => (code === 0 ? resolve() : reject(error)));
  });
  return { child, done };
}

async function capture(directory) {
  const env = connection(process.env.ONLINESCHOOL_BACKUP_URL, false);
  await mkdir(directory, { recursive: true });
  const name = `online_school-${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(3).toString('hex')}.pgdump.enc`;
  const path = join(directory, name);
  const partial = path + '.partial';
  const nonce = randomBytes(12);
  const header = Buffer.concat([format, nonce]);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(header);
  const out = createWriteStream(partial, { flags: 'wx', mode: 0o600 });
  out.write(header);
  const { child, done } = postgres(
    'pg_dump',
    ['--format=custom', '--compress=6', '--lock-wait-timeout=15s', '--no-password'],
    env,
  );
  try {
    await Promise.all([done, pipeline(child.stdout, cipher, out, { end: false })]);
    await new Promise((resolve, reject) => {
      out.once('error', reject);
      out.end(cipher.getAuthTag(), resolve);
    });
    await rename(partial, path);
    console.log(JSON.stringify({ status: 'DATABASE_BACKUP_CAPTURED', archive: name }));
  } catch (error) {
    child.kill();
    out.destroy();
    await rm(partial, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function restore(path) {
  const env = connection(process.env.ONLINESCHOOL_RESTORE_URL, true);
  const archive = await open(path, 'r');
  try {
    const { size } = await archive.stat();
    const header = Buffer.alloc(headerSize);
    const tag = Buffer.alloc(tagSize);
    if (
      size <= headerSize + tagSize ||
      (await archive.read(header, 0, headerSize, 0)).bytesRead !== headerSize ||
      !header.subarray(0, format.length).equals(format) ||
      (await archive.read(tag, 0, tagSize, size - tagSize)).bytesRead !== tagSize
    )
      throw new Error('DATABASE_BACKUP_ARCHIVE_INVALID');
    function decrypt(destination) {
      const stream = archive.createReadStream({
        start: headerSize,
        end: size - tagSize - 1,
        autoClose: false,
      });
      const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(format.length));
      decipher.setAAD(header);
      decipher.setAuthTag(tag);
      return pipeline(stream, decipher, destination);
    }
    try {
      // Authenticate the whole archive before opening a PostgreSQL write connection.
      await decrypt(
        new Writable({
          write(_chunk, _encoding, ack) {
            ack();
          },
        }),
      );
    } catch {
      throw new Error('DATABASE_BACKUP_AUTHENTICATION_FAILED');
    }
    const { child, done } = postgres(
      'pg_restore',
      ['--single-transaction', '--exit-on-error', '--no-password', '--dbname=' + env.PGDATABASE],
      env,
      true,
    );
    try {
      await Promise.all([done, decrypt(child.stdin)]);
    } catch (error) {
      child.kill();
      throw error;
    }
    console.log(JSON.stringify({ status: 'DATABASE_BACKUP_RESTORED', archive: basename(path) }));
  } finally {
    await archive.close();
  }
}

try {
  const [command, target] = process.argv.slice(2);
  if (key.length !== 32 || !bin || !target || !['capture', 'restore'].includes(command))
    throw new Error('DATABASE_BACKUP_CONFIGURATION_INVALID');
  await (command === 'capture' ? capture(target) : restore(target));
} catch (error) {
  const code = /^DATABASE_BACKUP_[A-Z_]+$/.test(error?.message)
    ? error.message
    : 'DATABASE_BACKUP_FAILED';
  console.error(JSON.stringify({ status: code }));
  process.exitCode = 1;
}
