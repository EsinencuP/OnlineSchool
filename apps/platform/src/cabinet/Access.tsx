import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SessionResponse, WebAuthnStartResponse } from '@online-school/api-contracts';
import { Icon } from '@online-school/ui';
import { AcademyMark, Brand, SubjectIcon } from './Brand.js';
import { homes, readableError, request } from './contract.js';

export function StageArt({ subject }: { subject?: string }) {
  return (
    <div className="cab-stage-art" aria-hidden="true">
      <span className="cab-stage-orbit cab-stage-orbit-one" />
      <span className="cab-stage-orbit cab-stage-orbit-two" />
      <span className="cab-stage-shape cab-stage-back">
        <Icon name="calendar" size={48} />
      </span>
      <span className="cab-stage-shape cab-stage-front">
        {subject ? <SubjectIcon subject={subject} /> : <AcademyMark />}
      </span>
      <span className="cab-stage-spark cab-stage-spark-one">✦</span>
      <span className="cab-stage-spark cab-stage-spark-two">✧</span>
    </div>
  );
}

type CredentialConstructor = typeof PublicKeyCredential & {
  parseRequestOptionsFromJSON: (value: unknown) => PublicKeyCredentialRequestOptions;
  parseCreationOptionsFromJSON: (value: unknown) => PublicKeyCredentialCreationOptions;
};
async function credentialAnswer(options: WebAuthnStartResponse, register: boolean) {
  const api = globalThis.PublicKeyCredential as CredentialConstructor | undefined;
  if (!api || !navigator.credentials) return Promise.reject(new Error('PASSKEY_UNSUPPORTED'));
  const credential = register
    ? await navigator.credentials.create({
        publicKey: api.parseCreationOptionsFromJSON(options.options),
      })
    : await navigator.credentials.get({
        publicKey: api.parseRequestOptionsFromJSON(options.options),
      });
  if (!(credential instanceof api)) return Promise.reject(new Error('PASSKEY_CANCELLED'));
  const serializable = credential as unknown as { toJSON: () => Record<string, unknown> };
  return { challengeId: options.challengeId, response: serializable.toJSON() };
}

export function canEnter(session: SessionResponse) {
  return (
    !session.recovery_only &&
    (session.account.kind === 'STUDENT' ||
      session.mfa_completed ||
      session.password_only ||
      session.manager_password_only)
  );
}

export function AccessScreen({
  session,
  signedIn,
  signOut,
}: {
  session?: SessionResponse | null;
  signedIn: (session: SessionResponse) => void;
  signOut: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recover, setRecover] = useState(false);
  const [recoveryId, setRecoveryId] = useState('');
  async function execute(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setIssue('');
    try {
      await task();
    } catch (error) {
      setIssue(readableError(error));
    } finally {
      setBusy(false);
    }
  }
  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void execute(async () => {
      const result = await request<SessionResponse>('createSession', {
        body: {
          method: 'password',
          email: email.trim(),
          password: String(data.get('password') ?? ''),
        },
      });
      form.reset();
      signedIn(result);
    });
  }
  async function passkey(register = false) {
    await execute(async () => {
      const start = session
        ? await request<WebAuthnStartResponse>(
            register ? 'registerPasskeyStart' : 'authenticatePasskeyStart',
          )
        : await request<WebAuthnStartResponse>('createSession', {
            body: { method: 'passkey', email: email.trim() },
          });
      const body = await credentialAnswer(start, register);
      if (register) {
        await request('registerPasskeyFinish', { body });
        signedIn(await request<SessionResponse>('currentSession'));
      } else {
        signedIn(await request<SessionResponse>('authenticatePasskeyFinish', { body }));
      }
    });
  }
  function recovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void execute(async () => {
      if (!recoveryId) {
        const started = await request<{ recoveryId: string; token: string }>('initiateRecovery', {
          body: { authorizationId: String(data.get('authorizationId')) },
        });
        if (!started.recoveryId) return Promise.reject(new Error('INVALID_RESPONSE'));
        setRecoveryId(started.recoveryId);
      } else {
        await request('completeRecovery', {
          body: { recoveryId, token: String(data.get('token')) },
        });
        signedIn(await request<SessionResponse>('currentSession'));
      }
    });
  }
  return (
    <main className="cab-login">
      <section className="cab-login-form">
        <header>
          <Brand full />
        </header>
        <div className="cab-login-content">
          <h1>
            {session ? 'Подтвердите вход' : recover ? 'Восстановление доступа' : 'Вход в кабинет'}
          </h1>
          <p>
            {session
              ? 'Используйте ключ доступа, чтобы продолжить.'
              : recover
                ? 'Введите данные, выданные для восстановления.'
                : 'Введите электронную почту и пароль вашего аккаунта.'}
          </p>
          {session ? (
            <div className="cab-login-buttons">
              <button
                className="cab-button cab-primary"
                onClick={() => void passkey()}
                disabled={busy}
              >
                <Icon name="health" size={19} /> Войти с ключом
              </button>
              <button
                className="cab-button cab-secondary"
                onClick={() => void passkey(true)}
                disabled={busy}
              >
                Зарегистрировать ключ
              </button>
              <button className="cab-text-button" onClick={signOut} disabled={busy}>
                Выйти
              </button>
            </div>
          ) : recover ? (
            <form onSubmit={recovery} className="cab-login-form-fields">
              <label className="cab-form-label">
                <span>{recoveryId ? 'Токен восстановления' : 'Код разрешения'}</span>
                <input
                  name={recoveryId ? 'token' : 'authorizationId'}
                  required
                  key={recoveryId}
                  type={recoveryId ? 'password' : 'text'}
                  maxLength={43}
                />
              </label>
              <button className="cab-button cab-primary" type="submit" disabled={busy}>
                {busy ? 'Проверяем…' : 'Продолжить'}
              </button>
              <button
                className="cab-text-button"
                type="button"
                onClick={() => {
                  setRecover(false);
                  setRecoveryId('');
                  setIssue('');
                }}
              >
                Вернуться ко входу
              </button>
            </form>
          ) : (
            <form onSubmit={login} className="cab-login-form-fields">
              <label className="cab-form-label">
                <span>Электронная почта</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@example.com"
                  maxLength={254}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <div className="cab-form-label">
                <label htmlFor="cab-login-password">Пароль</label>
                <span className="cab-password">
                  <input
                    id="cab-login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    maxLength={256}
                  />
                  <button
                    type="button"
                    className="cab-text-button"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Скрыть' : 'Показать'}
                  </button>
                </span>
              </div>
              <button type="submit" className="cab-button cab-primary" disabled={busy}>
                {busy ? 'Проверяем…' : 'Войти'} <Icon name="arrow" size={19} />
              </button>
              <button
                className="cab-button cab-secondary"
                type="button"
                onClick={() => void passkey()}
                disabled={busy || !/^[^@]+@[^@]+\.[^@]+$/.test(email.trim())}
              >
                <Icon name="health" size={17} /> Войти с ключом
              </button>
              <button
                className="cab-text-button"
                type="button"
                onClick={() => {
                  setRecover(true);
                  setIssue('');
                }}
                disabled={busy}
              >
                Восстановить доступ
              </button>
            </form>
          )}
          {issue && (
            <p className="cab-form-error" role="alert">
              {issue}
            </p>
          )}
        </div>
      </section>
      <div className="cab-login-art" aria-hidden="true">
        <StageArt />
      </div>
    </main>
  );
}
export function sessionHome(session: SessionResponse) {
  const matched = session.account.roles.find((role) => role in homes);
  return matched ? homes[matched] : '/account';
}
