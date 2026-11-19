import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';

type SecretError = { code: 'MEET_SECRET_NOT_CONFIGURED' | 'MEET_SECRET_UNREADABLE' };
type Binding =
  | { purpose: 'pkce'; teacherId: string; sessionId: string; stateHash: string }
  | { purpose: 'refresh'; teacherId: string; googleSubject: string; generation: number };

const keyIdPattern = /^[A-Za-z0-9_-]{1,40}$/;

function authenticatedContext(keyId: string, binding: Binding): Buffer {
  const context =
    binding.purpose === 'pkce'
      ? [binding.purpose, binding.teacherId, binding.sessionId, binding.stateHash]
      : [binding.purpose, binding.teacherId, binding.googleSubject, binding.generation];
  return Buffer.from(JSON.stringify(['online-school-meet:v1', keyId, ...context]));
}

export class MeetSecretStore {
  private constructor(
    private readonly activeId: string,
    private readonly keys: ReadonlyMap<string, Buffer>,
  ) {}

  static fromEnvironment(env: NodeJS.ProcessEnv): Result<MeetSecretStore, SecretError> {
    const activeId = env.GOOGLE_MEET_ACTIVE_KEY_ID ?? '';
    const encodedKeys = env.GOOGLE_MEET_TOKEN_KEYS ?? '';
    if (!keyIdPattern.test(activeId) || !encodedKeys || encodedKeys.length > 8192)
      return err({ code: 'MEET_SECRET_NOT_CONFIGURED' });
    const keys = new Map<string, Buffer>();
    try {
      const input: unknown = JSON.parse(encodedKeys);
      if (!input || typeof input !== 'object' || Array.isArray(input))
        return err({ code: 'MEET_SECRET_NOT_CONFIGURED' });
      for (const [keyId, encoded] of Object.entries(input)) {
        if (
          !keyIdPattern.test(keyId) ||
          typeof encoded !== 'string' ||
          !/^[A-Za-z0-9_-]{43}$/.test(encoded)
        )
          return err({ code: 'MEET_SECRET_NOT_CONFIGURED' });
        const key = Buffer.from(encoded, 'base64url');
        if (key.length !== 32 || key.toString('base64url') !== encoded)
          return err({ code: 'MEET_SECRET_NOT_CONFIGURED' });
        keys.set(keyId, key);
      }
    } catch {
      return err({ code: 'MEET_SECRET_NOT_CONFIGURED' });
    }
    return keys.has(activeId)
      ? ok(new MeetSecretStore(activeId, keys))
      : err({ code: 'MEET_SECRET_NOT_CONFIGURED' });
  }

  seal(secret: string, binding: Binding): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keys.get(this.activeId)!, iv);
    cipher.setAAD(authenticatedContext(this.activeId, binding));
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const envelope = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    return `v1.${this.activeId}.${envelope.toString('base64url')}`;
  }

  open(sealed: string, binding: Binding): Result<string, SecretError> {
    const [version, id, envelope, ...rest] = sealed.split('.');
    const key = id && this.keys.get(id);
    if (
      version !== 'v1' ||
      !key ||
      !envelope ||
      rest.length ||
      !/^[A-Za-z0-9_-]{39,14000}$/.test(envelope)
    )
      return err({ code: 'MEET_SECRET_UNREADABLE' });
    const raw = Buffer.from(envelope, 'base64url');
    if (raw.length <= 28 || raw.toString('base64url') !== envelope)
      return err({ code: 'MEET_SECRET_UNREADABLE' });
    try {
      const cipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
      cipher.setAAD(authenticatedContext(id!, binding));
      cipher.setAuthTag(raw.subarray(12, 28));
      return ok(Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString('utf8'));
    } catch {
      return err({ code: 'MEET_SECRET_UNREADABLE' });
    }
  }
}
